/**
 * Local & Cloud RAG API Client Service
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/api/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function fetchDocuments() {
  const res = await fetch(`${API_BASE}/api/documents`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function uploadFiles(files) {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(errorData.detail || 'Upload failed');
  }

  return res.json();
}

export async function clearKnowledgeBase() {
  const res = await fetch(`${API_BASE}/api/documents`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear knowledge base');
  return res.json();
}

/**
 * Stream RAG chat completion using Server-Sent Events (SSE).
 */
export async function streamChat({
  query,
  model,
  onStatus,
  onCitations,
  onToken,
  onDone,
  onError,
  signal,
}) {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, model }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
      throw new Error(err.detail || 'Failed to start chat stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep partial line in buffer

      for (const block of lines) {
        if (!block.trim()) continue;

        let eventType = 'message';
        let dataStr = '';

        const blockLines = block.split('\n');
        for (const line of blockLines) {
          if (line.startsWith('event:')) {
            eventType = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            dataStr = line.replace('data:', '').trim();
          }
        }

        if (!dataStr) continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (eventType === 'status') {
            onStatus?.(parsed);
          } else if (eventType === 'citations') {
            onCitations?.(parsed);
          } else if (eventType === 'token') {
            onToken?.(parsed.token || '');
          } else if (eventType === 'done') {
            onDone?.(parsed);
          } else if (eventType === 'error') {
            onError?.(parsed);
          }
        } catch {
          // Fallback if data is raw string
          if (eventType === 'token') {
            onToken?.(dataStr);
          }
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone?.({ stats: { stopped_by_user: true } });
    } else {
      onError?.({ error: err.message || 'Stream connection error' });
    }
  }
}
