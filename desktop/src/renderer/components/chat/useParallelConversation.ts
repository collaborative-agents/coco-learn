/* eslint-disable default-param-last -- Match the normal chat send API; optional context and retry follow defaults. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, SavedConversation } from './types';
import type { AgentActivity } from '../../../shared/agent-execution';
import type { TutorToolCall, LLMCallMetrics } from '../observation-types';
import { makeMessageId } from './message-format';

interface StreamEvent {
  sessionId?: string;
  requestId?: string;
  type?: string;
  text?: string;
  call?: TutorToolCall;
  activity?: AgentActivity[];
  stopped?: boolean;
  guidance?: string;
  error?: string;
  observerMetrics?: LLMCallMetrics | null;
  llm_metrics?: LLMCallMetrics | null;
  tool_calls?: TutorToolCall[];
}
export function applyConversationEvent(
  current: ChatMessage[],
  event: StreamEvent,
): ChatMessage[] {
  if (event.type === 'transcription') {
    const tutorIndex = current.findIndex(
      (message) => message.requestId === event.requestId,
    );
    const userIndex = tutorIndex - 1;
    if (userIndex >= 0 && current[userIndex]?.role === 'user') {
      return current.map((message, index) =>
        index === userIndex
          ? { ...message, text: event.text?.trim() || message.text }
          : message,
      );
    }
    return current;
  }
  return current.map((message) => {
    if (message.requestId !== event.requestId) return message;
    if (event.type === 'agent_activity') {
      return {
        ...message,
        activity: event.activity,
        text: event.text ?? message.text,
      };
    }
    if (event.type === 'text_delta') {
      return { ...message, text: message.text + (event.text ?? '') };
    }
    if (event.type === 'tool_call_started' && event.call) {
      return {
        ...message,
        toolCalls: [
          ...(message.toolCalls ?? []).filter(
            (call) => call.id !== event.call?.id,
          ),
          event.call,
        ],
      };
    }
    if (event.type === 'tool_call_completed' && event.call) {
      return {
        ...message,
        toolCalls: (message.toolCalls ?? []).some(
          (call) => call.id === event.call?.id,
        )
          ? (message.toolCalls ?? []).map((call) =>
              call.id === event.call?.id ? (event.call as TutorToolCall) : call,
            )
          : [...(message.toolCalls ?? []), event.call],
      };
    }
    if (event.type === 'done') {
      return {
        ...message,
        text: event.guidance ?? message.text,
        activity: event.activity ?? message.activity,
        stopped: event.stopped,
        id: message.id ?? makeMessageId(),
        ts: Date.now(),
        observerMetrics: event.observerMetrics ?? null,
        tutorMetrics: event.llm_metrics ?? null,
        toolCalls: event.tool_calls ?? message.toolCalls ?? [],
        isStreaming: false,
      };
    }
    if (event.type === 'error') {
      return {
        ...message,
        text: event.error ?? 'The tutor could not generate a response.',
        tutorMetrics: event.llm_metrics ?? null,
        isError: true,
        isStreaming: false,
      };
    }
    return message;
  });
}

/** A second normal conversation; main owns persistence and permission routing. */
export default function useParallelConversation(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const currentId = useRef(sessionId);
  currentId.current = sessionId;
  const pending = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    let active = true;
    let loaded = false;
    let revision = 0;
    pending.current = false;
    setMessages([]);
    setError('');
    setLoading(Boolean(sessionId));
    if (!sessionId) return undefined;
    const off = window.electron.ipcRenderer.on(
      'chat-stream-event',
      (data: unknown) => {
        const event = data as StreamEvent;
        if (event.sessionId !== sessionId || !event.requestId) return;
        revision += 1;
        if (!loaded) return;
        setMessages((items) => applyConversationEvent(items, event));
      },
    );
    const load = async () => {
      try {
        // If events arrive during loading, request a fresh main-owned snapshot
        // instead of replaying deltas that may already be in the saved history.
        let saved: SavedConversation[];
        let snapshotRevision: number;
        do {
          snapshotRevision = revision;
          // eslint-disable-next-line no-await-in-loop -- Each snapshot depends on events received during the previous one.
          saved = await window.electron.ipcRenderer.invoke(
            'get-chat-conversations',
          );
          if (!active) return;
        } while (snapshotRevision !== revision);
        const conversation = saved.find((item) => item.sessionId === sessionId);
        if (!conversation)
          throw new Error(
            'The comparison conversation could not be loaded. Reopen the chapter to try again.',
          );
        setMessages(conversation.messages);
        loaded = true;
        setLoading(false);
      } catch (reason) {
        if (active) {
          setError(String(reason));
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
      off();
    };
  }, [sessionId]);
  const send = useCallback(
    async (
      userText: string,
      images: string[] = [],
      displayText = userText,
      hotkeyImages: string[] = [],
      screenContext?: string,
      retry?: ChatMessage,
    ) => {
      if (
        !sessionId ||
        pending.current ||
        messagesRef.current.some((item) => item.isStreaming)
      )
        return;
      pending.current = true;
      const requestId = makeMessageId();
      const reply: ChatMessage = {
        role: 'tutor',
        text: '',
        requestId,
        isStreaming: true,
        retryText: userText,
        retryImages: images,
        retryHotkeyImages: hotkeyImages,
        retryRequestKind: 'chat',
      };
      setMessages((items) =>
        retry
          ? items.map((item) => (item === retry ? reply : item))
          : [
              ...items,
              {
                role: 'user',
                text: displayText,
                images,
                screenContext,
                requestId: `${requestId}:user`,
              },
              reply,
            ],
      );
      try {
        const result = await window.electron.ipcRenderer.invoke(
          'send-chat-message',
          {
            sessionId,
            requestId,
            userText,
            displayText,
            images,
            hotkeyImages,
            screenContext,
            requestKind: 'chat',
            isRetry: Boolean(retry),
          },
        );
        if (result?.error) throw new Error(result.error);
        if (
          !result?.streamed &&
          result?.guidance !== undefined &&
          currentId.current === sessionId
        )
          setMessages((items) =>
            applyConversationEvent(items, {
              requestId,
              type: 'done',
              guidance: result.guidance,
            }),
          );
      } catch (reason) {
        if (currentId.current === sessionId)
          setMessages((items) =>
            applyConversationEvent(items, {
              requestId,
              type: 'error',
              error: String(reason),
            }),
          );
      } finally {
        if (currentId.current === sessionId) pending.current = false;
      }
    },
    [sessionId],
  );
  const stop = async () => {
    await Promise.all(
      messages
        .filter((item) => item.isStreaming && item.requestId)
        .map((item) =>
          window.electron.ipcRenderer.invoke('stop-agent-run', item.requestId),
        ),
    );
  };
  return {
    messages,
    loading,
    error,
    busy: messages.some((item) => item.isStreaming),
    send,
    stop,
    retry: async (message: ChatMessage) => {
      if (message.retryText !== undefined)
        await send(
          message.retryText,
          message.retryImages,
          message.retryText,
          message.retryHotkeyImages,
          undefined,
          message,
        );
    },
    toggleFold: (target: ChatMessage) =>
      setMessages((items) =>
        items.map((item) =>
          item === target ? { ...item, folded: !item.folded } : item,
        ),
      ),
  };
}
