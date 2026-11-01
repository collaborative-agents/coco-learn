import type { LLMCallMetrics } from '../renderer/components/observation-types';

export const modelQuestPrompts = {
  rewrite:
    'Rewrite this more clearly in one sentence: “We should probably find some time to discuss how things are going with the project.”',
  ideas:
    'Draw a cozy treehouse at sunset using HTML and CSS. Include a wooden house, a ladder, leafy branches, and a warm sky. Make it fit in a 400 × 300 pixel frame. Return one self-contained HTML code block, with no JavaScript or external images.',
};
export type ModelQuestKind = keyof typeof modelQuestPrompts;
export interface QuestModel {
  id: string;
  model: string;
  label: string;
}
export interface ModelQuestResponse {
  requestId: string;
  runSessionId: string;
  model: QuestModel;
  text: string;
  status: 'running' | 'done' | 'error' | 'stopped' | 'interrupted';
  startedAt: number;
  firstResponseMs: number | null;
  finishedMs: number | null;
  metrics: LLMCallMetrics | null;
  error?: string;
}
export interface ModelQuestRound {
  id: string;
  kind: ModelQuestKind;
  prompt: string;
  responses: ModelQuestResponse[];
}
export interface ModelQuestSession {
  user: string;
  sessionId: string;
  models: QuestModel[];
  rounds: ModelQuestRound[];
  selectedModelId?: string;
  reflection: { choice: 'luna' | 'sol' | 'both'; reason: string } | null;
}
export interface ModelChapterState {
  completedAt: string | null;
  session: ModelQuestSession | null;
}
export const completedModelRound = (round: ModelQuestRound) =>
  round.responses.length === 2 &&
  round.responses.every(
    (response) => response.status === 'done' && response.text.trim(),
  );
