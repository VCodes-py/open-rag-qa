import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Storage Paths
FAISS_INDEX_PATH = DATA_DIR / "faiss.index"
SQLITE_DB_PATH = DATA_DIR / "metadata.db"

# Enable offline execution if models are already cached
if "HF_HUB_OFFLINE" not in os.environ:
    hf_hub_cache = Path.home() / ".cache" / "huggingface" / "hub"
    if hf_hub_cache.exists():
        os.environ["HF_HUB_OFFLINE"] = "1"

# Model Configurations
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
RERANKER_MODEL_NAME = os.getenv("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")

# Chunking Parameters
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 500))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 50))

# Retrieval Parameters
TOP_K_DENSE = int(os.getenv("TOP_K_DENSE", 10))
TOP_K_RERANK = int(os.getenv("TOP_K_RERANK", 3))

# Local LLM Runtime (Ollama)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("DEFAULT_OLLAMA_MODEL", "llama3.2")

# Cloud LLM Runtime Fallback (Groq - for Render / Cloud deployment)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
DEFAULT_GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.2-3b-preview")
