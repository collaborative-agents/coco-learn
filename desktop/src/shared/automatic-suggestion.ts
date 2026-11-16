import type { InstantSuggestion } from '../renderer/components/observation-types';

/** Generated advice shown beside Coco, independent of chat visibility. */
export interface AutomaticSuggestion {
  sessionId: string | null;
  observationId: string;
  status: string;
  rawObservation: string;
  scenario: string;
  suggestion: InstantSuggestion;
}
