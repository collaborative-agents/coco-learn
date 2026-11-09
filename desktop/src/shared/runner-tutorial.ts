export type RunnerAction =
  | 'open-training'
  | 'play'
  | 'customize'
  | 'dismiss'
  | 'focus'
  | 'finish'
  | 'tour-play'
  | 'why-tips'
  | 'explain-buttons'
  | 'skip-tour'
  | 'finish-setup'
  | 'retry';
export interface RunnerGuide {
  sessionId: string;
  label: string;
  text: string;
  action?: RunnerAction;
  actionLabel?: string;
  status?: 'observing' | 'progress';
}
export interface RunnerTutorialState {
  version: string;
  sessionId: string;
  phase: 'play' | 'writing' | 'building' | 'review' | 'complete';
  canUndo: boolean;
  hasChanges: boolean;
  error: string | null;
  previewError?: string;
  previewRevision?: string;
  previewKind?: 'original' | 'checking' | 'updated';
  lastRequest?: string;
  introAcknowledged?: boolean;
  firstGameOver?: boolean;
  tour?: 'meet' | 'active' | 'done' | 'skipped' | 'finished';
  failure?: { kind: string; detail: string; message: string };
}
export const runnerSuggestedPrompts = [
  'Change it to a daylight game!',
  'Make a flying version, so I can fly, not just jump.',
  'Make the fox a cat running through a snowy night.',
] as const;
