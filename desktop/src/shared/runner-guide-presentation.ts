import type { RunnerGuide } from './runner-tutorial';

export interface RunnerChatView {
  sessionId: string | null;
  inChat: boolean;
  visible: boolean;
  focused: boolean;
}

/** Navigation back to the idea is redundant while that composer is in front. */
export default function presentRunnerGuide(guide: RunnerGuide, view: RunnerChatView): RunnerGuide {
  if (guide.action === 'focus' && view.inChat && view.visible && view.focused && view.sessionId === guide.sessionId)
    return { ...guide, action: undefined, actionLabel: undefined };
  return guide;
}
