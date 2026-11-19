import React, { useState } from 'react';
import { Terminal, Copy, Check, X, RefreshCw, AlertTriangle, ExternalLink, Cpu } from 'lucide-react';

export default function OllamaStatusModal({ isOpen, onClose, onRefresh, isChecking }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!isOpen) return null;

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: '1. Download & Install Ollama',
      desc: 'Download the free open-source Ollama installer for Windows, macOS, or Linux.',
      cmd: 'https://ollama.com/download',
      isUrl: true,
    },
    {
      title: '2. Start the Ollama Service',
      desc: 'Open your terminal or command prompt and run the background server:',
      cmd: 'ollama serve',
      isUrl: false,
    },
    {
      title: '3. Pull an Open-Source Model',
      desc: 'In a separate terminal window, download your preferred local model:',
      cmd: 'ollama pull llama3.2',
      isUrl: false,
    },
    {
      title: 'Alternative Lightweight Models',
      desc: 'Fast alternatives for systems with lower VRAM or CPU-only execution:',
      cmd: 'ollama pull qwen2.5:3b\n# or\nollama pull mistral',
      isUrl: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Ollama Setup & Connection Guide</h3>
              <p className="text-xs text-slate-400">Run 100% open-source local LLMs on your machine with zero cloud APIs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-start space-x-3 text-xs text-slate-300">
            <Cpu className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              This application connects to Ollama via local REST API (<code className="text-emerald-300 bg-slate-900 px-1.5 py-0.5 rounded">http://localhost:11434</code>).
              Your prompts and documents never leave your physical machine.
            </span>
          </div>

          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">{step.title}</span>
                  {step.isUrl ? (
                    <a
                      href={step.cmd}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      Visit site <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </a>
                  ) : (
                    <button
                      onClick={() => copyToClipboard(step.cmd, idx)}
                      className="inline-flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-0.5 rounded bg-slate-800/50 hover:bg-slate-800"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400">{step.desc}</p>
                <div className="relative flex items-center p-2.5 rounded-lg bg-black/60 border border-slate-800 font-mono text-xs text-emerald-300">
                  <Terminal className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
                  <span className="overflow-x-auto whitespace-pre">{step.cmd}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-850">
          <span className="text-xs text-slate-500">Make sure port 11434 is accessible</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={onRefresh}
              disabled={isChecking}
              className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Testing Connection...' : 'Check Connection'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-sm"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
