import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import OllamaStatusModal from './components/OllamaStatusModal';
import {
  fetchDocuments,
  fetchModels,
  uploadFiles,
  clearKnowledgeBase,
  streamChat,
} from './services/api';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [ollamaRunning, setOllamaRunning] = useState(false);

  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [isOllamaModalOpen, setIsOllamaModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const abortControllerRef = useRef(null);

  // Load initial documents and models
  useEffect(() => {
    loadDocuments();
    loadModels();
  }, []);

  const loadDocuments = async () => {
    try {
      const data = await fetchDocuments();
      setDocuments(data.documents || []);
      setTotalChunks(data.total_chunks || 0);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const loadModels = async () => {
    setIsRefreshingModels(true);
    try {
      const data = await fetchModels();
      setOllamaRunning(Boolean(data.ollama_running));
      const modelList = data.models || [];
      setModels(modelList);

      if (modelList.length > 0) {
        // Keep current model if valid, else pick first or default
        if (!selectedModel || !modelList.includes(selectedModel)) {
          setSelectedModel(modelList[0]);
        }
      } else {
        setSelectedModel(data.default_model || 'llama3.2');
      }
    } catch (err) {
      console.error('Error fetching models:', err);
      setOllamaRunning(false);
    } finally {
      setIsRefreshingModels(false);
    }
  };

  const handleUploadFiles = async (files) => {
    setIsUploading(true);
    try {
      const res = await uploadFiles(files);
      await loadDocuments();

      // Add a system notification in chat
      const sysMsg = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `📁 **Successfully indexed ${res.indexed_files.length} document(s)** into FAISS and SQLite!\n\n` +
          res.indexed_files
            .map((f) => `- **${f.filename}**: ${f.page_count} page(s), ${f.chunk_count} chunks`)
            .join('\n') +
          `\n\n*Total knowledge base chunks: ${res.total_indexed_chunks}*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, sysMsg]);
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearKB = async () => {
    try {
      await clearKnowledgeBase();
      await loadDocuments();
      setMessages([]);
    } catch (err) {
      alert(`Failed to clear knowledge base: ${err.message}`);
    }
  };

  const handleSendMessage = async (queryText) => {
    if (!queryText.trim() || isStreaming) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'Initializing retrieval...',
      citations: [],
      stats: null,
      isStreaming: true,
      model: selectedModel,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInputQuery('');
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    await streamChat({
      query: queryText.trim(),
      model: selectedModel,
      signal: abortControllerRef.current.signal,
      onStatus: (statusData) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, status: statusData.message } : m
          )
        );
      },
      onCitations: (citations) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, citations } : m
          )
        );
      },
      onToken: (token) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + token, status: null }
              : m
          )
        );
      },
      onDone: (doneData) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  isStreaming: false,
                  status: null,
                  stats: doneData.stats || null,
                }
              : m
          )
        );
        setIsStreaming(false);
      },
      onError: (errData) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  isStreaming: false,
                  status: null,
                  content:
                    m.content ||
                    `⚠️ **Error during generation:** ${errData.error || 'Unknown error occurred.'}`,
                }
              : m
          )
        );
        setIsStreaming(false);
      },
    });
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      {/* Sidebar */}
      <Sidebar
        documents={documents}
        totalChunks={totalChunks}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        ollamaRunning={ollamaRunning}
        isRefreshingModels={isRefreshingModels}
        onRefreshModels={loadModels}
        onUploadFiles={handleUploadFiles}
        isUploading={isUploading}
        onClearKB={handleClearKB}
        onOpenOllamaModal={() => setIsOllamaModalOpen(true)}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Chat Interface */}
      <ChatInterface
        messages={messages}
        inputQuery={inputQuery}
        setInputQuery={setInputQuery}
        onSendMessage={handleSendMessage}
        onStopStreaming={handleStopStreaming}
        isStreaming={isStreaming}
        totalChunks={totalChunks}
        documentCount={documents.length}
        selectedModel={selectedModel}
        ollamaRunning={ollamaRunning}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Ollama Troubleshooting Modal */}
      <OllamaStatusModal
        isOpen={isOllamaModalOpen}
        onClose={() => setIsOllamaModalOpen(false)}
        onRefresh={loadModels}
        isChecking={isRefreshingModels}
      />
    </div>
  );
}
