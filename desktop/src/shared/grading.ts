export interface GradeSection {
  label: string;
  score: number;
  max_score: number;
}

/** What a participant sees. Judge output and research fields stay on the server. */
export interface Grade {
  task_id: string;
  title: string;
  status: 'none' | 'pending' | 'graded';
  score?: number;
  max_score?: number;
  band?: 'Strong' | 'Adequate' | 'Weak' | null;
  bonus?: number;
  sections?: GradeSection[];
  strengths?: string[];
  gaps?: string[];
  feedback?: string;
  corrected?: boolean;
  correction_note?: string | null;
  graded_at?: string;
}
