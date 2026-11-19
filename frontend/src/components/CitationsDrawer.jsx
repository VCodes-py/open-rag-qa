import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';

export default function CitationsDrawer({ citations = [] }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!citations || citations.length === 0) return null;

  const toggleExpand = (idx) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const copyText = (text, idx, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getScoreBadgeColor = (score) => {
    const percent = Math.round(score * 100);
    if (percent >= 80) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (percent >= 60) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-800/80">
      <div className="flex items-center space-x-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-medium text-slate-300">
          Source Citations ({citations.length} verified passages)
        </span>
      </div>

      <div className="space-y-2">
        {citations.map((cite, idx) => {
          const isExpanded = expandedIndex === idx;
          const percent = Math.round((cite.relevance_score || 0) * 100);

          return (
            <div
              key={idx}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? 'bg-slate-900/90 border-slate-700/80 shadow-md'
                  : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-850/60 hover:border-slate-700/60'
              }`}
            >
              {/* Badge Header Button */}
              <button
                type="button"
                onClick={() => toggleExpand(idx)}
                className="w-full px-3 py-2 flex items-center justify-between text-left space-x-2"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-1 rounded bg-slate-800 text-slate-400 flex-shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {cite.filename}
                  </span>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">
                    • Page {cite.page_number}
                  </span>
                  <span className="text-[11px] text-slate-500 flex-shrink-0 hidden sm:inline">
                    • Chunk #{cite.chunk_index}
                  </span>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getScoreBadgeColor(
                      cite.relevance_score
                    )}`}
                  >
                    {percent}% Match
                  </span>
                  <div className="text-slate-400">
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
              </button>

              {/* Collapsible Chunk Details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-800/60 bg-slate-950/40 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Cross-Encoder Verified Excerpt:</span>
                    <button
                      onClick={(e) => copyText(cite.text, idx, e)}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy snippet</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800/80 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {cite.text}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
