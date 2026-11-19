import React, { useRef, useState } from 'react';
import {
  Upload,
  FileText,
  FileCode,
  File,
  Trash2,
  Database,
  RefreshCw,
  Cpu,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  HardDrive,
  Layers,
  ChevronRight,
} from 'lucide-react';

export default function Sidebar({
  documents = [],
  totalChunks = 0,
  models = [],
  selectedModel = '',
  onSelectModel,
  ollamaRunning = false,
  isRefreshingModels = false,
  onRefreshModels,
  onUploadFiles,
  isUploading = false,
  onClearKB,
  onOpenOllamaModal,
  sidebarOpen = true,
  setSidebarOpen,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = ''; // reset so same files can be re-selected if needed
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return <FileText className="w-4 h-4 text-rose-400" />;
    if (ext === 'md' || ext === 'markdown') return <FileCode className="w-4 h-4 text-emerald-400" />;
    return <File className="w-4 h-4 text-blue-400" />;
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 w-80 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center">
              Local<span className="text-emerald-400">RAG</span>
              <span className="ml-2 px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                100% Offline
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">FAISS • Cross-Encoder • Ollama</p>
          </div>
        </div>
      </div>

      {/* Model & Ollama Runtime Controls */}
      <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-300 flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>LLM Runtime</span>
          </span>
          <button
            onClick={onOpenOllamaModal}
            className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center space-x-1 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Setup Guide</span>
          </button>
        </div>

        {/* Ollama Connection Indicator */}
        <div
          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
            ollamaRunning
              ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
              : 'bg-amber-950/30 border-amber-800/40 text-amber-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <div className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  ollamaRunning ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  ollamaRunning ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </div>
            <span className="font-medium">
              {ollamaRunning ? 'Ollama Connected' : 'Ollama Offline'}
            </span>
          </div>

          <button
            onClick={onRefreshModels}
            disabled={isRefreshingModels}
            title="Refresh Ollama Models"
            className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingModels ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Model Dropdown */}
        <div className="space-y-1">
          <label className="text-[11px] text-slate-400 font-medium">Active Open-Source Model</label>
          <select
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={!ollamaRunning || models.length === 0}
            className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
          >
            {models.length > 0 ? (
              models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            ) : (
              <option value="">{ollamaRunning ? 'No models found (pull one)' : 'Ollama not detected'}</option>
            )}
          </select>
        </div>
      </div>

      {/* Document Uploader */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-300 flex items-center space-x-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>Document Ingestion</span>
          </span>
          <span className="text-[10px] text-slate-500">PDF, TXT, MD</span>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept=".pdf,.txt,.md,.markdown"
          className="hidden"
        />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-xl p-4 text-center transition-all duration-200 ${
            isDragging
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/70'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <Upload className={`w-4 h-4 ${isUploading ? 'animate-bounce text-emerald-400' : ''}`} />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-slate-200">
                {isUploading ? 'Chunking & Embedding...' : 'Drop files or browse'}
              </p>
              <p className="text-[10px] text-slate-400">Recursive split (500 chars, 50 ov)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Indexed Documents List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-medium text-slate-400 flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Knowledge Base ({documents.length})</span>
          </span>
          {totalChunks > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700/60">
              {totalChunks} chunks
            </span>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950/30 border border-slate-800/60 text-xs text-slate-500 space-y-1">
            <p>No documents indexed yet.</p>
            <p className="text-[11px] text-slate-600">Upload a PDF or TXT to start.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <div
                key={doc.doc_id || doc.filename}
                className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-start justify-between space-x-2"
              >
                <div className="flex items-start space-x-2.5 min-w-0">
                  <div className="mt-0.5 flex-shrink-0">{getFileIcon(doc.filename)}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate" title={doc.filename}>
                      {doc.filename}
                    </p>
                    <p className="text-[10px] text-slate-400 space-x-1.5">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{doc.page_count} pg</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-mono">{doc.chunk_count} chk</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Reset Button */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60">
        {showClearConfirm ? (
          <div className="space-y-2 p-2 rounded-xl bg-rose-950/30 border border-rose-800/50">
            <p className="text-[11px] text-rose-300 text-center font-medium">
              Clear FAISS vectors and all indexed files?
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  onClearKB();
                  setShowClearConfirm(false);
                }}
                className="flex-1 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={documents.length === 0}
            className="w-full py-2 px-3 flex items-center justify-center space-x-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/60 rounded-xl transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Knowledge Base</span>
          </button>
        )}
      </div>
    </aside>
  );
}
