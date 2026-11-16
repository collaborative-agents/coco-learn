import type { AgentActivity } from './agent-execution';
export type RunnerAction =
  | 'idea-check-suggestion'
  | 'game-suggestion'
  | 'four-d-complete'
  | 'request-build'
  | 'open-training'
  | 'play'
  | 'customize'
  | 'show-around'
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
  instructionId?: string;
  learningStep?: 'welcome' | 'training' | 'tool' | 'side-quest' | 'side-quest-intro' | 'new';
  /** The actual interface control this instruction points to. */
  highlight?: 'training' | 'tool' | 'side-quest' | 'new' | 'workspace' | 'understanding';
  /** Milestones are spoken by the avatar even while the game chat is open. */
  milestone?: 'four-d-intro' | 'game-building' | 'game-ready' | 'starter-error' | 'game-created' | 'understanding-complete' | 'customize-prompt' | 'show-around' | 'game-customized';
  pages?: { title: string; text: string; help?: string }[];
  secondaryAction?: RunnerAction;
  secondaryActionLabel?: string;
  prompt?: string;
  framework?: { fourDDimension: 'discernment' | 'diligence'; title: string; body: string; noticed: string; check: string; why: string };
  sessionId: string;
  label: string;
  text: string;
  action?: RunnerAction;
  actionLabel?: string;
  status?: 'observing' | 'progress';
}
export const runnerFourDPages = [
  {
    title: 'Delegation',
    text: 'Choose what to hand to the agent. I write the game code; you choose the idea and decide whether it works.',
    help: 'Save time on routine work while keeping control of the important decisions.',
  },
  {
    title: 'Description',
    text: 'Explain your goal and must-haves. For this game, describe the look, feel, and controls you want.',
    help: 'Clear instructions help the agent get closer to your idea with fewer revisions.',
  },
  {
    title: 'Discernment',
    text: 'Check what the agent makes. Play the game: do the controls work, and does it match your request?',
    help: 'Agents can make mistakes. Trying the result yourself helps you catch them early.',
  },
  {
    title: 'Diligence',
    text: 'Take responsibility for the result. Know what changed in your files and what still needs checking.',
    help: 'Understanding the changes helps you avoid surprises and share your work responsibly.',
  },
];
export interface RunnerTutorialState {
  understandingCompleted?: boolean;
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
