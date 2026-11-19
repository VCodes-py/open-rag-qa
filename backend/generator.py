import asyncio
import json
import socket
import time
import logging
from urllib.parse import urlparse
from typing import List, Dict, Any, AsyncGenerator, Optional
import numpy as np
import httpx
from sentence_transformers import CrossEncoder

from backend.config import (
    RERANKER_MODEL_NAME,
    TOP_K_DENSE,
    TOP_K_RERANK,
    OLLAMA_BASE_URL,
    DEFAULT_OLLAMA_MODEL,
)
from backend.rag_pipeline import (
    get_embedding_model,
    get_vector_store,
    get_chunks_by_faiss_ids,
)

logger = logging.getLogger(__name__)

# Cached CrossEncoder model
_reranker_model: Optional[CrossEncoder] = None


def get_reranker_model() -> CrossEncoder:
    """Lazy-load and cache the CrossEncoder re-ranking model."""
    global _reranker_model
    if _reranker_model is None:
        logger.info(f"Loading cross-encoder reranker model: {RERANKER_MODEL_NAME}")
        try:
            _reranker_model = CrossEncoder(RERANKER_MODEL_NAME, local_files_only=True)
        except Exception:
            _reranker_model = CrossEncoder(RERANKER_MODEL_NAME)
    return _reranker_model


def sigmoid(x: float) -> float:
    """Map logit score to probability range [0, 1]."""
    return float(1.0 / (1.0 + np.exp(-x)))


def format_sse(event: str, data: Any) -> str:
    """Format data as a Server-Sent Event (SSE) message."""
    payload = json.dumps(data) if isinstance(data, (dict, list)) else data
    return f"event: {event}\ndata: {payload}\n\n"


def retrieve_candidates(query: str, top_k_dense: int = TOP_K_DENSE) -> List[Dict[str, Any]]:
    """
    Stage 1: Dense Retrieval using FAISS and BAAI/bge-small-en-v1.5 embeddings.
    """
    embedding_model = get_embedding_model()
    vector_store = get_vector_store()

    if vector_store.total_vectors == 0:
        return []

    # Encode query with normalization
    query_vector = embedding_model.encode([query], normalize_embeddings=True)
    scores, indices = vector_store.search(query_vector, top_k=top_k_dense)

    if len(indices) == 0:
        return []

    # Filter out -1 indices if FAISS returns fewer than top_k
    valid_pairs = [(int(idx), float(score)) for idx, score in zip(indices, scores) if idx != -1]
    if not valid_pairs:
        return []

    valid_ids = [pair[0] for pair in valid_pairs]
    chunks_map = {c["faiss_id"]: c for c in get_chunks_by_faiss_ids(valid_ids)}

    candidates = []
    for faiss_id, dense_score in valid_pairs:
        if faiss_id in chunks_map:
            chunk = dict(chunks_map[faiss_id])
            chunk["dense_score"] = round(dense_score, 4)
            candidates.append(chunk)

    return candidates


def rerank_passages(
    query: str,
    candidates: List[Dict[str, Any]],
    top_k_rerank: int = TOP_K_RERANK,
) -> List[Dict[str, Any]]:
    """
    Stage 2: Cross-Encoder Re-ranking using ms-marco-MiniLM-L-6-v2.
    Scores query-passage pairs and selects top_k_rerank passages.
    """
    if not candidates:
        return []

    reranker = get_reranker_model()
    pairs = [[query, c["text"]] for c in candidates]

    # Predict cross-encoder logits
    scores = reranker.predict(pairs)

    # Attach scores and sort
    for i, candidate in enumerate(candidates):
        raw_score = float(scores[i])
        candidate["rerank_raw_score"] = round(raw_score, 4)
        # Convert logit to normalized confidence percentage between 0 and 1
        candidate["relevance_score"] = round(sigmoid(raw_score), 4)

    # Sort descending by cross-encoder score
    reranked = sorted(candidates, key=lambda x: x["relevance_score"], reverse=True)
    return reranked[:top_k_rerank]


def check_ollama_port(timeout: float = 1.0) -> bool:
    """Fast socket-level connectivity check for Ollama before attempting generation."""
    try:
        parsed = urlparse(OLLAMA_BASE_URL)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 11434
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def build_system_prompt(passages: List[Dict[str, Any]]) -> str:
    """Build the strict context-grounded system prompt."""
    context_blocks = []
    for idx, p in enumerate(passages, start=1):
        context_blocks.append(
            f"--- [Document Passage {idx}] (File: {p['filename']}, Page: {p['page_number']}) ---\n{p['text']}"
        )

    context_str = "\n\n".join(context_blocks)

    prompt = (
        "You are a strict, helpful, context-grounded AI assistant. Your goal is to answer the user's question "
        "ACCURATELY and CONCISELY based ONLY on the provided document excerpts below.\n\n"
        "STRICT GROUNDING RULES:\n"
        "1. Answer ONLY using the facts directly stated in the Context below.\n"
        "2. If the answer cannot be found in the Context, respond EXACTLY with:\n"
        "   \"I cannot find this information in the uploaded documents.\"\n"
        "3. Do NOT invent, assume, or extrapolate information not supported by the context.\n"
        "4. When citing information, mention the source document and page number.\n"
        "5. Format your response cleanly using GitHub-flavored Markdown (bullet points, bold text, code blocks if applicable).\n\n"
        f"CONTEXT:\n{context_str}\n"
    )
    return prompt


async def stream_rag_response(
    query: str,
    model_name: Optional[str] = None,
    stream: bool = True,
) -> AsyncGenerator[str, None]:
    """
    Execute Two-Stage Retrieval and stream answer from local Ollama endpoint via SSE.
    """
    total_start = time.time()
    model = model_name or DEFAULT_OLLAMA_MODEL

    # Check vector store
    vector_store = get_vector_store()
    if vector_store.total_vectors == 0:
        yield format_sse("status", {"step": "empty", "message": "Knowledge base is empty."})
        yield format_sse(
            "token",
            {
                "token": "⚠️ **No documents have been indexed yet.**\n\nPlease upload at least one document (.pdf, .txt, or .md) in the sidebar before asking questions."
            },
        )
        yield format_sse("done", {"stats": {"total_time_ms": 0, "total_chunks": 0}})
        return

    # Stage 1: Dense Retrieval
    s1_start = time.time()
    yield format_sse(
        "status",
        {"step": "searching", "message": f"Searching document index for top {TOP_K_DENSE} passages..."},
    )
    candidates = retrieve_candidates(query, top_k_dense=TOP_K_DENSE)
    s1_elapsed_ms = int((time.time() - s1_start) * 1000)

    if not candidates:
        yield format_sse(
            "token",
            {
                "token": "I cannot find any relevant documents in the uploaded files corresponding to your question."
            },
        )
        yield format_sse("done", {"stats": {"retrieval_ms": s1_elapsed_ms, "total_chunks": 0}})
        return

    # Stage 2: Cross-Encoder Re-ranking
    s2_start = time.time()
    yield format_sse(
        "status",
        {
            "step": "reranking",
            "message": f"Re-ranking {len(candidates)} candidate passages with Cross-Encoder...",
        },
    )
    top_passages = rerank_passages(query, candidates, top_k_rerank=TOP_K_RERANK)
    s2_elapsed_ms = int((time.time() - s2_start) * 1000)

    # Emit source citations to frontend immediately
    citations_data = [
        {
            "faiss_id": p["faiss_id"],
            "filename": p["filename"],
            "page_number": p["page_number"],
            "chunk_index": p["chunk_index"],
            "relevance_score": p["relevance_score"],
            "confidence_percent": int(round(p["relevance_score"] * 100)),
            "text": p["text"],
        }
        for p in top_passages
    ]
    yield format_sse("citations", citations_data)

    # Prepare prompt for LLM
    yield format_sse(
        "status",
        {
            "step": "generating",
            "message": f"Generating answer with local model ({model})...",
        },
    )

    system_prompt = build_system_prompt(top_passages)
    full_prompt = f"{system_prompt}\nUSER QUESTION:\n{query}\n\nANSWER:"

    gen_start = time.time()
    token_count = 0

    # Local Ollama Runtime
    ollama_url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": full_prompt,
        "stream": True,
        "options": {
            "temperature": 0.1,
            "top_p": 0.9,
        },
    }

    if not check_ollama_port():
        error_msg = (
            f"❌ **Could not connect to Ollama server at `{OLLAMA_BASE_URL}`.**\n\n"
            "Please ensure Ollama is installed and running:\n"
            "1. Start Ollama in your terminal: `ollama serve`\n"
            f"2. Pull the model if you haven't already: `ollama pull {model}`\n"
            "3. Refresh or try asking your question again."
        )
        yield format_sse("token", {"token": error_msg})
        yield format_sse(
            "error",
            {
                "error": "Ollama connection refused. Is Ollama running on http://127.0.0.1:11434?",
                "code": "OLLAMA_OFFLINE",
            },
        )
        return

    yield format_sse("status", {"step": "generating", "message": f"Generating answer with {model}..."})

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            req = client.build_request("POST", ollama_url, json=payload)
            response = await client.send(req, stream=True)
            if response.status_code != 200:
                err_msg = f"Ollama returned HTTP {response.status_code}."
                logger.error(err_msg)
                yield format_sse(
                    "error",
                    {
                        "error": f"Ollama error (HTTP {response.status_code}). Ensure model '{model}' is installed via 'ollama pull {model}'.",
                        "code": "OLLAMA_HTTP_ERROR",
                    },
                )
                await response.aclose()
                return

            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                    token = chunk.get("response", "")
                    if token:
                        token_count += 1
                        yield format_sse("token", {"token": token})

                    if chunk.get("done", False):
                        break
                except json.JSONDecodeError:
                    continue
            await response.aclose()

    except (httpx.ConnectError, asyncio.TimeoutError):
        error_msg = (
            f"❌ **Could not connect to Ollama server at `{OLLAMA_BASE_URL}`.**\n\n"
            "Please ensure Ollama is installed and running:\n"
            "1. Start Ollama in your terminal: `ollama serve`\n"
            f"2. Pull the model if you haven't already: `ollama pull {model}`\n"
            "3. Refresh or try asking your question again."
        )
        yield format_sse("token", {"token": error_msg})
        yield format_sse(
            "error",
            {
                "error": "Ollama connection refused or timed out. Is Ollama running on http://127.0.0.1:11434?",
                "code": "OLLAMA_OFFLINE",
            },
        )
        return
    except Exception as e:
        logger.error(f"Unexpected error while streaming from Ollama: {e}")
        yield format_sse(
            "error",
            {"error": f"Generation failed: {str(e)}", "code": "GENERATION_ERROR"},
        )
        return

    gen_elapsed_ms = int((time.time() - gen_start) * 1000)
    total_elapsed_ms = int((time.time() - total_start) * 1000)

    yield format_sse(
        "done",
        {
            "stats": {
                "retrieval_ms": s1_elapsed_ms,
                "rerank_ms": s2_elapsed_ms,
                "generation_ms": gen_elapsed_ms,
                "total_time_ms": total_elapsed_ms,
                "tokens_generated": token_count,
                "citations_count": len(top_passages),
            }
        },
    )
