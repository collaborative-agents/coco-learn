import type { AgentActivity } from './agent-execution';
export type RunnerAction =
  | 'idea-check-suggestion'
  | 'game-suggestion'
  | 'request-build'
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
  framework?: { fourDDimension: 'discernment' | 'diligence'; title: string; body: string; noticed: string; check: string; why: string };
  sessionId: string;
  label: string;
  text: string;
  action?: RunnerAction;
  actionLabel?: string;
  status?: 'observing' | 'progress';
}
export interface RunnerTutorialState {
  selectedStarterDirectory?: string;
  workspaceDirectory?: string;
  starterBuild?: 'waiting' | 'building' | 'ready' | 'error';
  buildActivity?: AgentActivity[];
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

/** Recognize short requests/confirmations without consuming ordinary questions. */
export function isStarterBuildRequest(text: string): boolean {
  const input = text.trim().toLowerCase().replace(/[’‘]/g, "'");
  if (/\b(don't|do not|not now|cancel|stop|never)\b/.test(input)) return false;
  if (/^(yes|sure|ready|let's do it|picked|selected|folder selected|picked a folder|i picked (a |the )?folder)[.!]?$/.test(input)) return true;
  if (/^(who|what|why|how|where|when)\b/.test(input)) return false;
  if (/\b(build|buid|buld|biuld|guid|make|create|start|try|play)\b.*\b(game|something)\b/.test(input)) return true;
  return /^(?:(?:a|an|the)\s+)?(?:number[- ]guessing|guessing|running|runner|platformer|quiz|trivia|clicker|maze|dodge|rock[- ]paper[- ]scissors)(?:\s+game)?[.!]?$/.test(input);
}
