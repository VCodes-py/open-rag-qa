import os
import sqlite3
import time
import uuid
import logging
import contextlib
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import threading

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

from backend.config import (
    FAISS_INDEX_PATH,
    SQLITE_DB_PATH,
    EMBEDDING_MODEL_NAME,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
)

logger = logging.getLogger(__name__)

# Global lock for FAISS and DB operations
_pipeline_lock = threading.Lock()

# Cached model instance
_embedding_model: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    """Lazy-load and cache the SentenceTransformer embedding model."""
    global _embedding_model
    if _embedding_model is None:
        logger.info(f"Loading dense embedding model: {EMBEDDING_MODEL_NAME}")
        try:
            _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME, local_files_only=True)
        except Exception:
            _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _embedding_model


@contextlib.contextmanager
def get_db():
    """Context manager for SQLite connections that guarantees closing and unlocks immediately."""
    conn = sqlite3.connect(str(SQLITE_DB_PATH), timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_database() -> None:
    """Initialize SQLite tables for documents and chunks if not existing."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                doc_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                page_count INTEGER NOT NULL,
                chunk_count INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS chunks (
                faiss_id INTEGER PRIMARY KEY,
                doc_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                page_number INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                text TEXT NOT NULL,
                char_count INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (doc_id) REFERENCES documents (doc_id) ON DELETE CASCADE
            )
            """
        )
        conn.commit()


# Initialize database schema immediately
init_database()


def recursive_character_split(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
    separators: Optional[List[str]] = None,
) -> List[str]:
    """
    Split text recursively using a hierarchy of separators to maintain semantic boundaries.
    Default separators: ["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""]
    """
    if separators is None:
        separators = ["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""]

    text = text.strip()
    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    # Find the appropriate separator
    chosen_sep = ""
    for sep in separators:
        if sep == "":
            chosen_sep = ""
            break
        if sep in text:
            chosen_sep = sep
            break

    # Split text using chosen separator
    if chosen_sep != "":
        splits = text.split(chosen_sep)
    else:
        splits = list(text)

    chunks: List[str] = []
    current_chunk = ""

    for split in splits:
        piece = split if chosen_sep == "" else split + chosen_sep
        if not piece:
            continue

        if len(current_chunk) + len(piece) <= chunk_size:
            current_chunk += piece
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())

            # Apply overlap if possible
            if chunk_overlap > 0 and len(current_chunk) > chunk_overlap:
                overlap_text = current_chunk[-chunk_overlap:]
                current_chunk = overlap_text + piece
            else:
                current_chunk = piece

            # If a single piece is still longer than chunk_size, split recursively with remaining separators
            if len(current_chunk) > chunk_size and len(separators) > 1:
                sub_seps = separators[separators.index(chosen_sep) + 1 :] if chosen_sep in separators else [""]
                sub_chunks = recursive_character_split(current_chunk, chunk_size, chunk_overlap, sub_seps)
                if sub_chunks:
                    chunks.extend(sub_chunks[:-1])
                    current_chunk = sub_chunks[-1]

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    # Filter out empty or duplicate trailing chunks
    return [c for c in chunks if c.strip()]


def extract_text_from_file(filename: str, content_bytes: bytes) -> List[Tuple[int, str]]:
    """
    Extract text per page/section from PDF, TXT, or Markdown bytes.
    Returns list of tuples: (page_number, text)
    """
    ext = Path(filename).suffix.lower()
    pages_data: List[Tuple[int, str]] = []

    if ext == ".pdf":
        try:
            import pymupdf as fitz  # PyMuPDF
            doc = fitz.open(stream=content_bytes, filetype="pdf")
            for page_idx in range(len(doc)):
                page = doc.load_page(page_idx)
                text = page.get_text("text").strip()
                if text:
                    pages_data.append((page_idx + 1, text))
            doc.close()
        except Exception as e:
            logger.error(f"Error parsing PDF '{filename}' with PyMuPDF: {e}")
            raise RuntimeError(f"Failed to parse PDF {filename}: {str(e)}")

    elif ext in [".txt", ".md", ".markdown"]:
        # Try decoding as utf-8, fallback to latin-1
        try:
            text = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = content_bytes.decode("latin-1", errors="replace")

        # For text / markdown, break by form feed or double form feed if present, else treat as page 1
        raw_pages = text.split("\x0c") if "\x0c" in text else [text]
        for p_idx, page_content in enumerate(raw_pages, start=1):
            cleaned = page_content.strip()
            if cleaned:
                pages_data.append((p_idx, cleaned))
    else:
        raise ValueError(f"Unsupported file type '{ext}'. Supported formats: .pdf, .txt, .md")

    return pages_data


class VectorStoreManager:
    """Manages the FAISS IndexFlatIP index and synchronization with SQLite metadata."""

    def __init__(self):
        self.dimension = 384  # BAAI/bge-small-en-v1.5 produces 384-dimensional embeddings
        self._index: Optional[faiss.Index] = None
        self._load_or_create_index()

    def _load_or_create_index(self) -> None:
        if FAISS_INDEX_PATH.exists():
            try:
                logger.info(f"Loading existing FAISS index from {FAISS_INDEX_PATH}")
                self._index = faiss.read_index(str(FAISS_INDEX_PATH))
            except Exception as e:
                logger.warning(f"Could not read existing FAISS index: {e}. Creating new index.")
                self._index = faiss.IndexFlatIP(self.dimension)
        else:
            logger.info("Initializing new FAISS IndexFlatIP")
            self._index = faiss.IndexFlatIP(self.dimension)

    def save_index(self) -> None:
        if self._index is not None:
            FAISS_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
            faiss.write_index(self._index, str(FAISS_INDEX_PATH))
            logger.info(f"FAISS index saved with {self._index.ntotal} vectors.")

    def add_vectors(self, embeddings: np.ndarray) -> int:
        """
        Add normalized embeddings to FAISS index.
        Returns the starting FAISS ID for these vectors.
        """
        if self._index is None:
            self._load_or_create_index()

        start_id = self._index.ntotal
        # Ensure float32 and contiguous
        embeddings_np = np.ascontiguousarray(embeddings, dtype=np.float32)
        self._index.add(embeddings_np)
        self.save_index()
        return start_id

    def search(self, query_embedding: np.ndarray, top_k: int = 10) -> Tuple[np.ndarray, np.ndarray]:
        """
        Search top_k closest vectors in FAISS.
        Returns (scores, indices).
        """
        if self._index is None or self._index.ntotal == 0:
            return np.array([]), np.array([])

        top_k = min(top_k, self._index.ntotal)
        query_np = np.ascontiguousarray(query_embedding, dtype=np.float32)
        scores, indices = self._index.search(query_np, top_k)
        return scores[0], indices[0]

    def reset(self) -> None:
        """Clear FAISS index and delete index file."""
        self._index = faiss.IndexFlatIP(self.dimension)
        if FAISS_INDEX_PATH.exists():
            try:
                FAISS_INDEX_PATH.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete FAISS index file: {e}")

    @property
    def total_vectors(self) -> int:
        return self._index.ntotal if self._index is not None else 0


# Singleton vector store instance
_vector_store: Optional[VectorStoreManager] = None


def get_vector_store() -> VectorStoreManager:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStoreManager()
    return _vector_store


def ingest_documents(
    files: List[Tuple[str, bytes]],
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
) -> Dict[str, Any]:
    """
    Ingest multiple documents: extract text, chunk recursively, generate normalized embeddings,
    save vectors in FAISS, and store chunk metadata in SQLite.
    """
    start_time = time.time()
    vector_store = get_vector_store()
    model = get_embedding_model()

    indexed_documents = []
    all_chunks_metadata = []
    all_chunk_texts = []

    with _pipeline_lock:
        for filename, content_bytes in files:
            doc_id = str(uuid.uuid4())
            file_size = len(content_bytes)

            pages_data = extract_text_from_file(filename, content_bytes)
            if not pages_data:
                continue

            page_count = len(pages_data)
            doc_chunks_count = 0

            for page_num, page_text in pages_data:
                chunks = recursive_character_split(
                    page_text,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                )
                for chunk_idx, chunk_text in enumerate(chunks):
                    doc_chunks_count += 1
                    all_chunk_texts.append(chunk_text)
                    all_chunks_metadata.append(
                        {
                            "doc_id": doc_id,
                            "filename": filename,
                            "page_number": page_num,
                            "chunk_index": chunk_idx,
                            "text": chunk_text,
                            "char_count": len(chunk_text),
                        }
                    )

            indexed_documents.append(
                {
                    "doc_id": doc_id,
                    "filename": filename,
                    "file_size": file_size,
                    "page_count": page_count,
                    "chunk_count": doc_chunks_count,
                }
            )

        if not all_chunk_texts:
            return {
                "indexed_files": [],
                "total_chunks": 0,
                "elapsed_ms": int((time.time() - start_time) * 1000),
            }

        # Generate normalized dense embeddings using sentence-transformers
        logger.info(f"Generating embeddings for {len(all_chunk_texts)} chunks...")
        embeddings = model.encode(
            all_chunk_texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=32,
        )

        # Add to FAISS index
        start_faiss_id = vector_store.add_vectors(embeddings)

        # Insert metadata into SQLite
        with get_db() as conn:
            cursor = conn.cursor()
            for doc in indexed_documents:
                cursor.execute(
                    """
                    INSERT INTO documents (doc_id, filename, file_size, page_count, chunk_count)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        doc["doc_id"],
                        doc["filename"],
                        doc["file_size"],
                        doc["page_count"],
                        doc["chunk_count"],
                    ),
                )

            for i, meta in enumerate(all_chunks_metadata):
                faiss_id = start_faiss_id + i
                cursor.execute(
                    """
                    INSERT INTO chunks (faiss_id, doc_id, filename, page_number, chunk_index, text, char_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        faiss_id,
                        meta["doc_id"],
                        meta["filename"],
                        meta["page_number"],
                        meta["chunk_index"],
                        meta["text"],
                        meta["char_count"],
                    ),
                )
            conn.commit()

    elapsed_ms = int((time.time() - start_time) * 1000)
    logger.info(
        f"Ingested {len(indexed_documents)} documents ({len(all_chunk_texts)} chunks) in {elapsed_ms}ms"
    )

    return {
        "indexed_files": indexed_documents,
        "total_chunks": len(all_chunk_texts),
        "total_indexed_chunks": vector_store.total_vectors,
        "elapsed_ms": elapsed_ms,
    }


def list_documents() -> List[Dict[str, Any]]:
    """List all indexed documents with statistics from SQLite."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT doc_id, filename, file_size, page_count, chunk_count, created_at
            FROM documents
            ORDER BY created_at DESC
            """
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_chunk_by_faiss_id(faiss_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve chunk text and metadata by its FAISS row ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT faiss_id, doc_id, filename, page_number, chunk_index, text, char_count, created_at
            FROM chunks
            WHERE faiss_id = ?
            """,
            (faiss_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_chunks_by_faiss_ids(faiss_ids: List[int]) -> List[Dict[str, Any]]:
    """Retrieve multiple chunks by their FAISS IDs preserving order."""
    if not faiss_ids:
        return []
    with get_db() as conn:
        cursor = conn.cursor()
        placeholders = ",".join("?" for _ in faiss_ids)
        cursor.execute(
            f"""
            SELECT faiss_id, doc_id, filename, page_number, chunk_index, text, char_count, created_at
            FROM chunks
            WHERE faiss_id IN ({placeholders})
            """,
            faiss_ids,
        )
        rows = {row["faiss_id"]: dict(row) for row in cursor.fetchall()}
        return [rows[fid] for fid in faiss_ids if fid in rows]


def delete_all_documents() -> bool:
    """Wipe the FAISS index and clear SQLite tables."""
    with _pipeline_lock:
        vector_store = get_vector_store()
        vector_store.reset()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM chunks")
            cursor.execute("DELETE FROM documents")
            conn.commit()

    logger.info("Successfully wiped all documents, chunks, and FAISS index.")
    return True


def get_knowledge_base_stats() -> Dict[str, Any]:
    """Return summary statistics of the current knowledge base."""
    vector_store = get_vector_store()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM documents")
        doc_count = cursor.fetchone()["count"]
        cursor.execute("SELECT COUNT(*) as count FROM chunks")
        chunk_count = cursor.fetchone()["count"]

    return {
        "document_count": doc_count,
        "chunk_count": chunk_count,
        "faiss_vector_count": vector_store.total_vectors,
    }
