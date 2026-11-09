export type UnderstandingCheckResult =
  | { success: false; error: string }
  | { success: true; kind: 'idea'; interpretation: string }
  | { success: true; kind: 'quiz' };
