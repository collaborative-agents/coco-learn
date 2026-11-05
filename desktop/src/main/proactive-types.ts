import type { ChatSuggestion } from '../shared/chat-suggestion';
import type {
  AiToolButton,
  LLMCallMetrics,
} from '../renderer/components/observation-types';

export interface ChatSeed {
  phrase: string;
  label: string;
  rawObservation: string;
  /** Attach context to the user's next turn instead of sending immediately. */
  deferUntilUserMessage?: boolean;
  /** Text to prefill in the chat composer for the user to edit and send. */
  draft?: string;
  /** The suggestion the user chose to chat about, shown as Coco's message. */
  suggestion?: ChatSuggestion;
  /**
   * What the observer saw on screen. Sent with the user's next message as
   * separate, removable context, never as part of what they wrote.
   */
  screenObservation?: string;
}

export interface InstantSuggestion {
  kind: 'content' | 'delegate';
  title: string;
  body?: string;
  targetTool?: string;
  prompt?: string;
  copyText: string;
  availableTools?: AiToolButton[];
  llm_metrics?: LLMCallMetrics;
  fourDDimension?: 'delegation' | 'description' | 'discernment' | 'diligence';
  teachingDepth?: 'introduce' | 'reinforce' | 'deepen';
  /** One-sentence explanation shown before the suggestion's action. */
  noticed?: string;
  aiCan?: string;
  why?: string;
  check?: string;
  triggerType?: string;
  interventionSource?: 'judge' | 'observer';
}

export interface SuggestionObservation {
  observation_id?: string;
  observation?: string;
  status?: string;
  task_label?: string;
  scenario?: string;
  image_paths?: string[];
  intervention_source?: 'judge';
  trigger_type?: string;
  teaching_depth?: 'introduce' | 'reinforce' | 'deepen' | 'not_applicable';
}
