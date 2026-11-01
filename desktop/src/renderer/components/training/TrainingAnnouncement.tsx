import { useId } from 'react';

export default function TrainingAnnouncement() {
  const descriptionId = useId();
  return (
    <aside className="training-announcement" aria-label="Announcements">
      <button
        type="button"
        className="training-award-tag"
        aria-describedby={descriptionId}
      >
        <span aria-hidden="true">✦</span> Camp awards · Three $50 awards
      </button>
      <p id={descriptionId} role="tooltip" className="training-award-tooltip">
        Finish all seven daily tasks and complete both the pre- and
        post-assessments to qualify. Three eligible participants will each
        receive a $50 cash award: Most Active Participant, Most Improved
        Participant, and Top Performer.
      </p>
    </aside>
  );
}
