import asyncio
import logging
import os
import socket
from urllib.parse import urlparse
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx

from backend.config import (
    OLLAMA_BASE_URL,
    DEFAULT_OLLAMA_MODEL,
    EMBEDDING_MODEL_NAME,
    RERANKER_MODEL_NAME,
    GROQ_API_KEY,
    DEFAULT_GROQ_MODEL,
)
from backend.rag_pipeline import (
    ingest_documents,
    list_documents,
    delete_all_documents,
    get_knowledge_base_stats,
    get_vector_store,
)
from backend.generator import stream_rag_response

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def check_ollama_port(timeout: float = 0.2) -> bool:
    """Fast socket-level connectivity check for Ollama before attempting HTTP requests."""
    try:
        parsed = urlparse(OLLAMA_BASE_URL)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 11434
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


app = FastAPI(
    title="Local Open-Source RAG API",
    description="Locally runnable Q&A system with dense retrieval, cross-encoder re-ranking, and local Ollama runtime.",
    version="1.0.0",
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    query: str
    model: Optional[str] = None


@app.get("/api/health")
def health_check():
    """Check system health, vector store count, and Ollama connection status."""
    stats = get_knowledge_base_stats()

    ollama_ok = False
    if GROQ_API_KEY:
        ollama_ok = True
    elif check_ollama_port():
        try:
            with httpx.Client(timeout=2.0) as client:
                resp = client.get(f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags")
                ollama_ok = resp.status_code == 200
        except Exception:
            ollama_ok = False

    return {
        "status": "healthy",
        "ollama_online": ollama_ok,
        "runtime": "cloud-groq" if GROQ_API_KEY else "local-ollama",
        "embedding_model": EMBEDDING_MODEL_NAME,
        "reranker_model": RERANKER_MODEL_NAME,
        "knowledge_base": stats,
    }


@app.get("/api/models")
def list_models():
    """Query local Ollama instance or return Cloud Groq models."""
    if GROQ_API_KEY:
        return {
            "ollama_running": True,
            "models": [
                "llama-3.2-3b-preview",
                "llama-3.1-8b-instant",
                "llama-3.3-70b-versatile",
                "mixtral-8x7b-32768",
            ],
            "default_model": DEFAULT_GROQ_MODEL,
            "provider": "Groq Cloud (Free)",
        }

    if not check_ollama_port():
        return {
            "ollama_running": False,
            "models": [],
            "default_model": DEFAULT_OLLAMA_MODEL,
            "error": f"Ollama is offline or unreachable at {OLLAMA_BASE_URL}",
        }

    try:
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                raw_models = data.get("models", [])
                models = [m.get("name", "") for m in raw_models if m.get("name")]
                return {
                    "ollama_running": True,
                    "models": models,
                    "default_model": DEFAULT_OLLAMA_MODEL,
                }
    except Exception as e:
        logger.warning(f"Could not connect to Ollama at {OLLAMA_BASE_URL}: {e}")

    return {
        "ollama_running": False,
        "models": [],
        "default_model": DEFAULT_OLLAMA_MODEL,
        "error": f"Ollama is offline or unreachable at {OLLAMA_BASE_URL}",
    }


@app.get("/api/documents")
def get_documents():
    """List all indexed documents with their chunk count and page count."""
    docs = list_documents()
    stats = get_knowledge_base_stats()
    return {
        "documents": docs,
        "total_documents": stats["document_count"],
        "total_chunks": stats["chunk_count"],
    }


@app.delete("/api/documents")
def clear_documents():
    """Clear all indexed documents, chunks, and reset FAISS vector index."""
    try:
        delete_all_documents()
        return {"success": True, "message": "Knowledge base cleared successfully."}
    except Exception as e:
        logger.error(f"Error resetting documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    """
    Accept multi-file uploads (.pdf, .txt, .md), extract text, chunk, embed, and index in FAISS + SQLite.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    supported_exts = {".pdf", ".txt", ".md", ".markdown"}
    prepared_files = []

    for file in files:
        ext = f".{file.filename.split('.')[-1].lower()}" if "." in file.filename else ""
        if ext not in supported_exts:
            raise HTTPException(
                status_code=400,
                detail=f"File '{file.filename}' has unsupported type '{ext}'. Allowed: {', '.join(supported_exts)}",
            )
        content = await file.read()
        if len(content) == 0:
            continue
        prepared_files.append((file.filename, content))

    if not prepared_files:
        raise HTTPException(status_code=400, detail="Uploaded files were empty.")

    try:
        metrics = ingest_documents(prepared_files)
        return {
            "success": True,
            "indexed_files": metrics["indexed_files"],
            "total_chunks_added": metrics["total_chunks"],
            "total_indexed_chunks": metrics["total_indexed_chunks"],
            "elapsed_ms": metrics["elapsed_ms"],
        }
    except Exception as e:
        logger.error(f"Error during document ingestion: {e}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Two-Stage Retrieval + Streaming SSE LLM generation.
    Emits events: status, citations, token, done, error.
    """
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    return StreamingResponse(
        stream_rag_response(query=query, model_name=request.model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Mount and serve built frontend SPA if available (e.g. on Hugging Face Spaces / Production)
dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(dist_path):
    assets_path = os.path.join(dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(dist_path, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
