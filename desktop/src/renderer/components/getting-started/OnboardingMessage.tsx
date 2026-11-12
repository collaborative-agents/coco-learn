import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import type { ChatMessage } from '../chat/types';
import { TutorMessage } from '../chat/MessageContent';

const CHARACTER_MS = 24;
const THINKING_MS = 1000;
// Presentation state stays in memory, never in saved chat or model context.
const revealStarts = new WeakMap<ChatMessage, number>();
export function animateOnboardingMessage(
  message: ChatMessage,
  previous?: ChatMessage,
) {
  const previousStart = previous && revealStarts.get(previous);
  revealStarts.set(
    message,
    Math.max(
      Date.now() + THINKING_MS,
      previousStart === undefined
        ? 0
        : previousStart +
            Array.from(previous!.text).length * CHARACTER_MS +
            THINKING_MS,
    ),
  );
  return message;
}
export function preserveOnboardingAnimation(
  previous: ChatMessage,
  updated: ChatMessage,
) {
  const start = revealStarts.get(previous);
  if (start !== undefined) revealStarts.set(updated, start);
  return updated;
}

/** Keep queued turns out of the transcript until their thinking period starts. */
export function OnboardingTurn({ message, children, reviewing = false }: {
  message: ChatMessage; children: ReactNode; reviewing?: boolean;
}) {
  const start = revealStarts.get(message);
  const [, setNow] = useState(Date.now);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const queued = !reviewing && !reduced && start !== undefined && Date.now() < start - THINKING_MS;
  useEffect(() => {
    if (!queued || start === undefined) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, start - THINKING_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [queued, start]);
  return queued ? null : <>{children}</>;
}

export default function OnboardingMessage({
  message,
  onProgress,
  children,
}: {
  children?: ReactNode;
  message: ChatMessage;
  onProgress: () => void;
}) {
  const start = revealStarts.get(message);
  const characters = Array.from(message.text);
  const [now, setNow] = useState(Date.now);
  const [reduceMotion, setReduceMotion] = useState(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media?.matches ?? false);
    media?.addEventListener?.('change', update);
    return () => media?.removeEventListener?.('change', update);
  }, []);
  const count =
    start === undefined || reduceMotion
      ? characters.length
      : Math.min(
          characters.length,
          Math.max(0, Math.floor((now - start) / CHARACTER_MS)),
        );
  useEffect(() => {
    if (count >= characters.length) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 24);
    return () => window.clearInterval(timer);
  }, [start, reduceMotion, count >= characters.length]);
  useLayoutEffect(() => {
    onProgress();
  }, [count]);
  if (start === undefined || reduceMotion)
    return (
      <>
        <TutorMessage text={message.text} />
        {children}
      </>
    );
  // Screen readers get one complete message, rather than character announcements.
  return (
    <>
      <div role="group" aria-label={message.text}>
        <div aria-hidden="true">
          {now < start ? (
            <span>Thinking…</span>
          ) : (
            <TutorMessage
              text={characters.slice(0, count).join('') || '\u200b'}
            />
          )}
        </div>
      </div>
      {count === characters.length && children}
    </>
  );
}
