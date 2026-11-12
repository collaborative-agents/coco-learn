export interface UnderstandingRecap {
  summary_title: string;
  bullets: string[];
  quiz: { question: string; choices: string[]; correct_index: number; explanation: string };
}
export type UnderstandingCheckResult =
  | { success: false; error: string }
  | { success: true; kind: 'quiz' };
