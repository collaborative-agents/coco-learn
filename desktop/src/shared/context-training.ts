export interface ContextChapterProgress {
  workspaceSet: boolean;
  fileLinked: boolean;
  fileRead: boolean;
  completedAt: string | null;
}
export const emptyContextProgress = (): ContextChapterProgress => ({
  workspaceSet: false,
  fileLinked: false,
  fileRead: false,
  completedAt: null,
});
export interface ContextTrainingSession {
  user: string;
  sessionId: string;
  directory: string | null;
  linkedFiles: string[];
}
export const contextPracticePrompts = [
  'What workspace are you working in? Does choosing this folder mean you’ve already read its files?',
  'What information did linking this file give you? Without opening it, tell me what you know about it.',
  'Read the linked file. Show me a short excerpt, and explain what you can now see that you couldn’t before.',
] as const;
