import { isStarterBuildRequest } from '../../../shared/runner-tutorial';
import { animateOnboardingMessage, preserveOnboardingAnimation } from './OnboardingMessage';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { ChatMessage } from '../chat/types';
import type { RunnerTutorialState } from '../../../shared/runner-tutorial';

export const onboardingMessages = {
  hello:
    'Let’s build your first game! Type “Let’s build a game” to start. Ask questions anytime.',
  folderReady: 'Your workspace is ready. Type “Let’s build a game” to start.',
  selectedWorkspace: 'I’ll build in your selected workspace. Use Access to manage my file and command permissions.',
  workspace:
    'Click Workspace to choose a folder. I’ll create a new game folder inside it.',
  build:
    'I’m building your game.',
  game: 'Your game is ready in your workspace as coco-game.html.',
  review:
    'Try your updated game. Does it match your idea?',
  done: 'You’re ready to explore Coco on your own. Ask me for help anytime.',
} as const;
export const onboardingId = (step: keyof typeof onboardingMessages) =>
  `onboarding-${step}`;
const message = (step: keyof typeof onboardingMessages): ChatMessage => ({
  role: 'tutor',
  id: onboardingId(step),
  text: onboardingMessages[step],
  ts: Date.now(),
});

export default function useOnboardingConversation({
  state,
  sessionId,
  setMessages,
  entry = null,
}: {
  entry?: {sessionId: string; sequence: number} | null;
  state: RunnerTutorialState | null;
  sessionId: string | null;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}) {
  const active = Boolean(state && state.sessionId === sessionId && state.tour !== 'finished' && state.tour !== 'skipped');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const handledEntry = useRef(0);
  useEffect(() => {
    if (!active || !state) return;
    const replayGreeting = state.tour === 'meet' && entry?.sessionId === sessionId && entry.sequence !== handledEntry.current;
    if (replayGreeting) handledEntry.current = entry!.sequence;
    setMessages((current) => {
      let next = replayGreeting ? current.map(item => item.id === onboardingId('hello')
        ? animateOnboardingMessage({...item, text: onboardingMessages.hello}) : item) : current;
      const add = (step: keyof typeof onboardingMessages) => {
        if (!next.some((item) => item.id === onboardingId(step)))
          next = [...next, animateOnboardingMessage(message(step), next[next.length - 1])];
      };
      if (state.tour === 'meet') {
        add('hello');
        if (state.starterBuild) add(state.selectedStarterDirectory ? 'selectedWorkspace' : 'workspace');
        else if (state.selectedStarterDirectory) add('folderReady');
      }
      if (state.starterBuild === 'building' || state.buildActivity?.length) {
        const build = { ...message('build'), activity: state.buildActivity };
        next = next.some((item) => item.id === build.id)
          ? next.map((item) => (item.id === build.id ? preserveOnboardingAnimation(item, build) : item))
          : [...next, animateOnboardingMessage(build, next[next.length - 1])];
      }
      if (state.tour !== 'meet') {
        add('game');
        if (state.hasChanges && state.phase === 'review') add('review');
        if (state.tour === 'done' || state.tour === 'finished') add('done');
      }
      return next;
    });
  }, [
    active,
    entry,
    sessionId,
    state?.sessionId,
    state?.tour,
    state?.starterBuild,
    state?.selectedStarterDirectory,
    state?.buildActivity,
    state?.hasChanges,
    state?.phase,
    setMessages,
  ]);

  const respond = useCallback(
    async (text: string): Promise<boolean> => {
      if (!active || !state) return false;
      if (state.starterBuild === 'building' || busy) return true;
      const wantsGame = isStarterBuildRequest(text);
      const exploreIndependently = /^(?:i(?:[’']?d| would)? (?:like|want) to |i(?:[’']?ll| will) |let me )?explore(?: coco)? (?:on my own|by myself|at my own pace)[.!]?$/i.test(text.trim());
      const approved =
        /^(looks? good|done|i[’']?m happy|happy with it|that[’']?s good|all good|finished)[.!]?$/i.test(
          text.trim(),
        );
      const action =
        state.tour === 'active' && state.starterBuild === 'ready' && exploreIndependently
          ? 'finish-setup'
          : state.tour === 'meet' && wantsGame
          ? 'request-build'
          : state.hasChanges && state.phase === 'review' && approved
            ? 'finish'
            : state.tour === 'done' && approved
              ? 'finish-setup'
              : null;
      if (!action) return false;
      setBusy(true);
      setError('');
      setMessages((current) => [
        ...current,
        { role: 'user', text, ts: Date.now() },
      ]);
      try {
        const invoke = async (value: string) => {
          const result = await window.electron?.ipcRenderer.invoke(
            'runner-action',
            { sessionId: state.sessionId, action: value },
          );
          if (result?.error) throw Error(result.error);
        };
        await invoke(action);
        if (action === 'finish') await invoke('finish-setup');
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'I couldn’t finish that. Please try again.',
        );
      } finally {
        setBusy(false);
      }
      return true;
    },
    [active, state, busy, setMessages],
  );
  return {
    active,
    respond,
    busy: busy || (active && state?.starterBuild === 'building'),
    error:
      error || (active && state?.starterBuild === 'error' ? state.error : ''),
  };
}
