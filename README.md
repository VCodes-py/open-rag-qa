# Local RAG • 100% Open-Source Document Q&A Web Application

A completely private, local Retrieval-Augmented Generation (RAG) system with real-time token streaming, two-stage neural re-ranking, and clickable source citations.

> **Zero Cloud APIs. Zero Monthly Subscriptions. 100% Offline & Private.**

---

## 🌟 Key Features

- **Multi-Format Ingestion:** Drag-and-drop parsing for `.pdf` (via PyMuPDF), `.txt`, and `.md` (Markdown).
- **Semantic Recursive Splitting:** Preserves sentence, clause, and paragraph boundaries with configurable chunk size (500 chars) and overlap (50 chars).
- **Stage 1 (Dense Retrieval):** Generates normalized 384-dimensional dense embeddings using `BAAI/bge-small-en-v1.5` and indexes them into a persistent local **FAISS** (`IndexFlatIP` = Cosine Similarity) index.
- **Stage 2 (Cross-Encoder Re-Ranking):** Pairs the query with candidate passages and computes deep cross-attention relevance scores using `cross-encoder/ms-marco-MiniLM-L-6-v2`, filtering down to the top 3 highest-precision excerpts.
- **Local LLM Runtime:** Streams tokens directly from a local **Ollama** server (`http://localhost:11434`), defaulting to `llama3.2`, `mistral`, or `qwen2.5:3b`.
- **Strict Grounding Guardrails:** A system prompt enforces strict factual boundaries, instructing the LLM to answer *only* from verified passages and explicitly refuse if the answer is absent.
- **Modern UI & Source Citations:** Built with React 18, Tailwind CSS, Lucide icons, and real-time Server-Sent Events (SSE). Expandable citation drawer displays file names, page numbers, chunk IDs, and neural confidence percentages.

---

## 💡 Why Local RAG? (Comparison & Value)

| Capability | Standard Cloud AI (ChatGPT / Claude) | **Local Open-Source RAG** |
| :--- | :--- | :--- |
| **Privacy & Security** | ⚠️ Documents uploaded to external servers | 🛡️ **100% Local:** Never leaves your hardware |
| **Cost** | 💸 \$20/month or pay-per-token API bills | 💰 **\$0 Forever:** No API keys or subscriptions |
| **Hallucination Prevention** | ❌ Can fabricate plausible-sounding answers | 🎯 **Strict Grounding:** Answers only from your text |
| **Source Traceability** | ⚠️ Vague or no citations | 🔍 **Clickable Citations:** File, page # & confidence % |
| **Connectivity** | ❌ Requires constant high-speed internet | ✈️ **Fully Offline:** Works on flights & remote areas |
| **Data Retention Limits** | ⚠️ Governed by third-party data policies | 🔒 **Full Ownership:** You own the models & database |

### 🎯 Real-World Use Cases

- ⚖️ **Legal & Contracts:** Safely query NDAs, employment agreements, and vendor contracts without exposing confidential clauses to third-party APIs.
- 📊 **Finance & Taxes:** Search through bank statements, audit trails, and tax filings with complete data security.
- 🔬 **Research & Study:** Ingest 100+ page academic PDFs, textbook chapters, and technical manuals; ask complex questions and jump to the exact cited pages.
- 💼 **Internal Company Knowledge:** Run an on-premise knowledge assistant for internal team documentation without compliance or GDPR concerns.

### ⚡ The Two-Stage Retrieval Advantage

```
Standard (Naive) RAG:
User Query ──► Vector Search ────────► Top Chunks (Noisy / Out-of-Context) ──► Hallucinated Answer ❌

This Two-Stage Pipeline:
User Query ──► FAISS Dense Search ──► Top 10 Candidates ──► MS-MARCO Cross-Encoder ──► Top 3 High-Precision Passages ──► Grounded, Verified Answer ✅
```
*Dense search finds semantic candidates at lightning speed (~10ms); the Cross-Encoder performs deep token-level cross-attention to filter out false positives and ensure 100% precision.*

---

## 🏗️ Architecture Flow

```
User Document (.pdf, .txt, .md)
      │
      ▼
PyMuPDF / Text Extractor
      │
      ▼
Recursive Character Chunker (500 chars, 50 overlap)
      │
      ▼
Dense Embedder (BAAI/bge-small-en-v1.5) ───► FAISS (IndexFlatIP) + SQLite (metadata.db)
                                                      │
User Query ───────────────────────────────────────────┤
      │                                               ▼
      │ Dense Vector Search                   Top 10 Candidate Passages
      │                                               │
      └───────────────────────────────────────────────┤
                                                      ▼
                                       Cross-Encoder Re-Ranker
                                     (ms-marco-MiniLM-L-6-v2)
                                                      │
                                                      ▼
                                            Top 3 Relevant Passages
                                                      │
                                                      ▼
                                           Strict Grounding Prompt
                                                      │
                                                      ▼
                                           Local Ollama Instance
                                            (llama3.2 / mistral)
                                                      │
                                                      ▼
                                            Real-Time SSE Stream
                                              (React Frontend)
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & npm
- **Ollama** (for local LLM generation)

---

### 2. Install & Start Ollama

1. Download Ollama from [https://ollama.com/download](https://ollama.com/download) and install it.
2. Open a terminal and start the Ollama background daemon:
   ```bash
   ollama serve
   ```
3. In another terminal, pull your preferred open-source model:
   ```bash
   # Recommended default (compact & fast)
   ollama pull llama3.2

   # Alternative high-capability models:
   ollama pull mistral
   ollama pull qwen2.5:3b
   ```

---

### 3. Backend Setup

1. Create a Python virtual environment and activate it:
   ```bash
   # On Windows (PowerShell):
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # On macOS / Linux:
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. Launch the FastAPI backend server:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *The backend will be live at `http://127.0.0.1:8000` (API Docs at `http://127.0.0.1:8000/docs`).*

---

### 4. Frontend Setup

1. Open a new terminal in the `/frontend` directory:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open your browser at:
   ```
   http://localhost:5173
   ```

---

## 🧪 Testing with Included Sample Documents

Three ready-to-test documents are included in `/sample_documents`:

1. **`quantum_computing_primer.md`** (Markdown)
   - *Sample question:* "How does Shor's algorithm impact standard 2048-bit RSA encryption?"
   - *Sample question:* "What is the difference between classical bits and qubits in superposition?"
2. **`apollo_mission_guidelines.txt`** (Text)
   - *Sample question:* "What engines and fuel were used on the Saturn V first stage?"
   - *Sample question:* "What triggered Program Alarms 1201 and 1202 during the Apollo 11 lunar descent?"
3. **`deep_learning_architectures.pdf`** (Multi-page PDF)
   - *Sample question:* "What was the degradation problem in deep neural networks and how did ResNet solve it?"
   - *Sample question:* "How does Scaled Dot-Product Attention prevent vanishing gradients?"

---

## 📂 Project Directory Structure

```
Rag-model/
├── backend/
│   ├── __init__.py
│   ├── config.py              # File paths, retrieval params, model names
│   ├── main.py                # FastAPI routes (/api/upload, /api/chat, /api/models, /api/documents)
│   ├── rag_pipeline.py        # PDF/TXT/MD extractors, recursive chunker, FAISS & SQLite store
│   ├── generator.py           # Two-stage retrieval (FAISS + Cross-Encoder), Ollama SSE streaming
│   ├── requirements.txt       # Open-source backend requirements
│   └── data/                  # Auto-created: faiss.index, metadata.db, uploads
│
├── frontend/
│   ├── index.html             # HTML entry point
│   ├── package.json           # React, Vite, Tailwind, Lucide dependencies
│   ├── vite.config.js         # Dev server & /api proxy to port 8000
│   ├── tailwind.config.js     # Tailwind CSS setup & styling
│   └── src/
│       ├── main.jsx           # App mounting
│       ├── App.jsx            # State management for chat, documents, and runtime
│       ├── index.css          # Tailwind directives & custom scrollbars
│       ├── components/
│       │   ├── Sidebar.jsx           # File uploader, doc list, model selector, clear button
│       │   ├── ChatInterface.jsx     # Streaming message stream, suggestions, input bar
│       │   ├── MessageItem.jsx       # Markdown rendering, code copy, citations badge
│       │   ├── CitationsDrawer.jsx   # Collapsible citations with neural relevance scores
│       │   └── OllamaStatusModal.jsx # Offline troubleshooting & setup instructions
│       └── services/
│           └── api.js         # API fetch calls & Server-Sent Events stream reader
│
├── sample_documents/          # Ready-to-use .pdf, .txt, .md test files
├── verify_pipeline.py         # Automated end-to-end verification script
├── run_app.bat                # Windows 1-click startup script
└── README.md
```

---

## 🛡️ Offline Execution & Local Cache

- **Embeddings & Re-Ranker:** Model weights for `BAAI/bge-small-en-v1.5` and `cross-encoder/ms-marco-MiniLM-L-6-v2` are automatically downloaded to your local Hugging Face cache directory (`~/.cache/huggingface/hub`) on first run. Subsequent runs execute completely offline with zero network latency.
- **Graceful Offline Warning:** If Ollama is not running, the application displays an in-chat setup guide with copyable commands rather than failing silently.

---

## 📜 License
100% Open-Source under the Apache 2.0 / MIT License.
