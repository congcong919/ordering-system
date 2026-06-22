export async function* streamChat(
  message: string,
  sessionId: string,
  firebaseToken?: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const body: Record<string, string> = { message, session_id: sessionId };
  if (firebaseToken) body.firebase_token = firebaseToken;

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.text) yield parsed.text;
        } catch {
          // skip non-JSON SSE frames (e.g. event: done)
        }
      }
    }
  }
}

export async function clearChatSession(sessionId: string): Promise<void> {
  await fetch(`/api/ai/session/${sessionId}`, { method: 'DELETE' });
}
