import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, Copy, Check, Clock, Layers, Sparkles, Loader2 } from 'lucide-react';
import CitationsDrawer from './CitationsDrawer';

export default function MessageItem({ message }) {
  const isUser = message.role === 'user';
  const [copiedCode, setCopiedCode] = useState(null);

  const copyCodeToClipboard = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div
      className={`py-5 px-4 md:px-6 transition-colors ${
        isUser ? 'bg-transparent' : 'bg-slate-900/40 border-y border-slate-800/40'
      }`}
    >
      <div className="max-w-4xl mx-auto flex space-x-3 md:space-x-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {isUser ? (
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-medium shadow-sm">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-300">
              {isUser ? 'You' : 'Local RAG Assistant'}
            </span>
            <span className="text-[11px] text-slate-500">
              {message.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isUser && message.model && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                {message.model}
              </span>
            )}
          </div>

          {/* Active Processing Status Pill */}
          {!isUser && message.status && (
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 text-xs animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>{message.status}</span>
            </div>
          )}

          {/* Body */}
          <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed">
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');
                      const codeId = Math.random().toString(36).substring(7);

                      if (!inline && match) {
                        return (
                          <div className="relative group my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950">
                            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
                              <span className="font-mono text-[11px] uppercase">{match[1]}</span>
                              <button
                                onClick={() => copyCodeToClipboard(codeString, codeId)}
                                className="inline-flex items-center space-x-1 text-slate-400 hover:text-slate-200"
                              >
                                {copiedCode === codeId ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400 text-[11px]">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span className="text-[11px]">Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <pre className="!m-0 !p-3 !bg-slate-950 font-mono text-xs overflow-x-auto text-emerald-300">
                              <code>{children}</code>
                            </pre>
                          </div>
                        );
                      }
                      return (
                        <code
                          className="px-1.5 py-0.5 rounded bg-slate-800/80 text-emerald-300 font-mono text-xs border border-slate-700/40"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    table({ children }) {
                      return (
                        <div className="my-3 overflow-x-auto rounded-lg border border-slate-700/60">
                          <table className="min-w-full divide-y divide-slate-800 text-xs">
                            {children}
                          </table>
                        </div>
                      );
                    },
                    th({ children }) {
                      return (
                        <th className="px-3 py-2 bg-slate-800/80 text-left font-semibold text-slate-200">
                          {children}
                        </th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td className="px-3 py-2 border-t border-slate-800/60 text-slate-300">
                          {children}
                        </td>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>

                {/* Blinking cursor while actively streaming */}
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-emerald-400 animate-pulse rounded-sm align-middle" />
                )}
              </div>
            )}
          </div>

          {/* Citations Drawer */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <CitationsDrawer citations={message.citations} />
          )}

          {/* Performance Stats Footer */}
          {!isUser && message.stats && (
            <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-slate-400">
              {message.stats.retrieval_ms !== undefined && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700/50">
                  <Clock className="w-3 h-3 mr-1 text-slate-400" />
                  Dense Retrieval: {message.stats.retrieval_ms}ms
                </span>
              )}
              {message.stats.rerank_ms !== undefined && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700/50">
                  <Layers className="w-3 h-3 mr-1 text-blue-400" />
                  Cross-Encoder Rerank: {message.stats.rerank_ms}ms
                </span>
              )}
              {message.stats.generation_ms !== undefined && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700/50">
                  <Sparkles className="w-3 h-3 mr-1 text-emerald-400" />
                  Generation: {message.stats.generation_ms}ms
                </span>
              )}
              {message.stats.tokens_generated && (
                <span className="text-slate-400">
                  • {message.stats.tokens_generated} tokens
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
