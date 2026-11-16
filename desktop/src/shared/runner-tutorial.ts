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
    text: 'Deciding which parts of a task to hand to the agent and which to keep for yourself. Here, I write the code for your game, while you stay in charge of the idea and the final call on whether it works.',
    help: 'You get work done faster without giving up control. Handing off the routine parts frees you to focus on the decisions that need your judgment, like what the game should be and whether it’s good enough.',
  },
  {
    title: 'Description',
    text: 'Explaining what you want clearly enough for the agent to act on: your goal, the context, and any must-haves. For a game, that could be who it’s for, how it should feel, and how the controls work.',
    help: 'A clear description means fewer rounds of back-and-forth and results closer to what you pictured. When something comes out wrong, a sharper description is often the fastest fix.',
  },
  {
    title: 'Discernment',
    text: 'Judging the agent’s output instead of accepting it as-is. Play the game: does it run, do the controls respond, and does it match what you asked for? Notice anything that looks off.',
    help: 'Agents can sound confident and still be wrong. Checking the result yourself catches mistakes early, before they end up in something you share or rely on.',
  },
  {
    title: 'Diligence',
    text: 'Taking responsibility for what you and the agent make together. Know what changed in your files, understand enough to explain it, and keep track of what still needs a closer look.',
    help: 'You stay accountable for the work even when an agent did much of it. Keeping up with the changes protects you from surprises and builds the understanding you need to use agents well.',
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
