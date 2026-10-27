export interface ToolChapterProgress {
  externalInformation: boolean;
  approved: boolean;
  denied: boolean;
  completedAt: string | null;
}
export const emptyToolProgress = (): ToolChapterProgress => ({
  externalInformation: false,
  approved: false,
  denied: false,
  completedAt: null,
});

export interface ToolTrainingSession {
  user: string;
  sessionId: string;
  peerSessionId: string;
  directory: string;
  mode: 'with' | 'without';
}
