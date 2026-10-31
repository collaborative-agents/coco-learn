export interface SkillDraft {
  name: string;
  description: string;
  instructions: string;
  files: { name: string; content: string }[];
}
export interface WorkflowTrial {
  input: string;
  output: string;
  draftVersion: number;
}
export interface WorkflowSession {
  user: string;
  sessionId: string;
  brief: string;
  draft: SkillDraft | null;
  version: number;
  trials: WorkflowTrial[];
  feedback: string;
  savedSkillId: string | null;
  messages?: { id: string; role: 'user' | 'assistant'; text: string }[];
  awaitingSave?: boolean;
}
export interface CuratedSkill extends SkillDraft {
  id: string;
  savedAt: string;
  markdown: string;
}
export interface WorkflowState {
  completedAt: string | null;
  session: WorkflowSession | null;
  skills: CuratedSkill[];
}
