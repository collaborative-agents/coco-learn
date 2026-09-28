export interface TrainingDay {
  day: number;
  title: string;
  available: boolean;
  filename: string | null;
  unlocked: boolean;
  unlocks_at: string | null;
  completed_at: string | null;
}
export interface StudyState {
  user_id: string;
  role: 'super_admin' | 'admin' | 'participant';
  tutoring_allowed: boolean;
  started_at: string | null;
  timezone: string | null;
  days: TrainingDay[];
}
