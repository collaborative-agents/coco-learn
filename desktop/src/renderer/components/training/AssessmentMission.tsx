import type { ReactNode } from 'react';

export default function AssessmentMission({
  title,
  children,
  winConditions,
}: {
  title: string;
  children: ReactNode;
  winConditions: ReactNode;
}) {
  return (
    <div className="post-assessment-mission">
      <div className="post-assessment-mission-title">
        <span aria-hidden>🎯</span>
        <div>
          <h3>{title}</h3>
        </div>
      </div>
      {children}
      <div className="post-assessment-win-conditions">
        <strong>Win conditions</strong>
        <ul>{winConditions}</ul>
      </div>
    </div>
  );
}
