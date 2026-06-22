import { useCallback, useRef, useState } from 'react';
import { auth } from '../services/firebase';
import { clearChatSession, streamChat } from '../services/chatApi';
import type { ChatMessage } from '../types';

function makeId() {
  return crypto.randomUUID();
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Use ref so newChat can swap session ID without stale closures in sendMessage
  const sessionIdRef = useRef<string>(makeId());

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;
      setError(null);

      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let firebaseToken: string | undefined;
      try {
        firebaseToken = (await auth.currentUser?.getIdToken()) ?? undefined;
      } catch {
        // proceed without token — tools that need auth handle it gracefully
      }

      try {
        const gen = streamChat(text.trim(), sessionIdRef.current, firebaseToken, controller.signal);
        for await (const token of gen) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: m.content + token } : m
            )
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
              : m
          )
        );
      } finally {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, streaming: false } : m
          )
        );
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const newChat = useCallback(async () => {
    abortRef.current?.abort();
    const oldId = sessionIdRef.current;
    sessionIdRef.current = makeId();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    // Fire-and-forget — session cleanup failure is non-fatal
    clearChatSession(oldId).catch(() => undefined);
  }, []);

  return { messages, isStreaming, error, sendMessage, stopStreaming, newChat };
}
