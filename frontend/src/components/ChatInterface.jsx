import React, { useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Sparkles,
  Menu,
  Database,
  ArrowRight,
  ShieldCheck,
  Search,
  Cpu,
} from 'lucide-react';
import MessageItem from './MessageItem';

export default function ChatInterface({
  messages = [],
  inputQuery = '',
  setInputQuery,
  onSendMessage,
  onStopStreaming,
  isStreaming = false,
  totalChunks = 0,
  documentCount = 0,
  selectedModel = '',
  ollamaRunning = false,
  onToggleSidebar,
}) {
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom as messages change or stream
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [inputQuery]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputQuery.trim() && !isStreaming) {
        onSendMessage(inputQuery);
      }
    }
  };

  const sampleQuestions = [
    {
      q: "What is the difference between classical bits and quantum superposition?",
      tag: "Quantum Primer",
    },
    {
      q: "What are the propulsion and thrust parameters of the Saturn V rocket stages?",
      tag: "Apollo Mission",
    },
    {
      q: "How does Shor's algorithm impact standard 2048-bit RSA encryption?",
      tag: "Cryptography",
    },
    {
      q: "What triggered Program Alarms 1201 and 1202 during the Apollo 11 descent?",
      tag: "Apollo Guidance",
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 lg:hidden transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-300">Context:</span>
            {documentCount > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                <Database className="w-3 h-3 mr-1" />
                {documentCount} file{documentCount > 1 ? 's' : ''} ({totalChunks} chunks)
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs">
                No documents loaded
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono text-slate-300">{selectedModel || 'No Model'}</span>
          </div>
          <div className="hidden sm:flex items-center space-x-1 text-[11px] text-emerald-400/90 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-md">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Local & Private</span>
          </div>
        </div>
      </header>

      {/* Messages Stream Viewport */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto px-4 py-12 md:py-16 space-y-8">
            {/* Hero */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30 mb-2 shadow-lg shadow-emerald-500/5">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Context-Grounded Local Document Q&A
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                Upload your custom PDFs, Markdown, or text files in the sidebar and ask questions.
                All embeddings and generation stay 100% on your machine.
              </p>
            </div>

            {/* Architecture Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                  <Search className="w-4 h-4" />
                  <span>Stage 1: Dense Retrieval</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Fast vector similarity search across all document chunks using normalized{' '}
                  <code className="text-emerald-300">BAAI/bge-small-en-v1.5</code> embeddings and FAISS.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center space-x-2 text-blue-400 text-xs font-semibold">
                  <Sparkles className="w-4 h-4" />
                  <span>Stage 2: Cross-Encoder Re-Ranking</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Deep pairwise semantic scoring with{' '}
                  <code className="text-blue-300">ms-marco-MiniLM-L-6-v2</code> to extract only the top 3 high-precision passages.
                </p>
              </div>
            </div>

            {/* Suggested Sample Questions */}
            {documentCount > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Suggested Questions from Knowledge Base
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {sampleQuestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSendMessage(item.q)}
                      className="p-3 text-left rounded-xl bg-slate-900/40 hover:bg-slate-850 border border-slate-800/80 hover:border-slate-700 transition-all group flex items-start justify-between space-x-2"
                    >
                      <div className="space-y-1 min-w-0">
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {item.tag}
                        </span>
                        <p className="text-xs text-slate-300 group-hover:text-white transition-colors leading-snug">
                          {item.q}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/20">
            {messages.map((msg, idx) => (
              <MessageItem key={msg.id || idx} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Prompt Section */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex-shrink-0">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="relative flex items-end rounded-2xl bg-slate-900 border border-slate-700/80 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all shadow-lg overflow-hidden">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                documentCount > 0
                  ? "Ask anything about the uploaded documents..."
                  : "Upload a document first, or ask a question..."
              }
              className="w-full px-4 py-3.5 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-48 leading-relaxed"
            />

            <div className="p-2 flex-shrink-0">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  title="Stop generating"
                  className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => inputQuery.trim() && onSendMessage(inputQuery)}
                  disabled={!inputQuery.trim()}
                  title="Send question"
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white transition-all shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Press <kbd className="font-mono text-slate-400 bg-slate-800 px-1 rounded">Enter</kbd> to send, <kbd className="font-mono text-slate-400 bg-slate-800 px-1 rounded">Shift + Enter</kbd> for new line</span>
            <span>Zero cloud APIs • Strictly context-grounded</span>
          </div>
        </div>
      </div>
    </div>
  );
}
