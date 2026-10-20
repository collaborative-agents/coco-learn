export const FOLLOW_UP_TOOLKIT = [
  {
    filename: 'draft_allocations.docx',
    description: 'Three unchecked AI staffing plans',
  },
  {
    filename: 'roster.xlsx',
    description: 'Engineer skills and available hours',
  },
  {
    filename: 'requirements.docx',
    description:
      'Project requirements and consequences of staffing below the recommended level',
  },
  {
    filename: 'quality_history.docx',
    description: 'What happened in earlier planning cycles',
  },
  {
    filename: 'answer_template.docx',
    description: 'Your answer sheet to complete and export as a PDF',
  },
];

export default function FollowUpBriefing() {
  return (
    <div className="post-assessment-mission follow-up-briefing">
      <div className="post-assessment-mission-title">
        <span aria-hidden>🎯</span>
        <h3>Decide Where the Risk Goes</h3>
      </div>
      <p>
        Choose an AI staffing plan, verify it, and decide where your team can
        accept the risks of working below the recommended skill level.
      </p>

      <section>
        <h4>Your situation</h4>
        <p>
          You are a resourcing planner at Meridian Analytics Inc., a fictional
          company. Today is August 31, 2026. Three projects start on September
          7, but there are not enough senior engineers to staff every project at
          its recommended skill level. An AI tool has drafted three staffing
          plans. None has been checked by a person.
        </p>
      </section>

      <section>
        <h4>What to do</h4>
        <ol>
          <li>
            <strong>Choose a draft.</strong> Compare the three plans and pick
            one to take forward.
          </li>
          <li>
            <strong>Check and correct it.</strong> Verify assignments, hours,
            skill levels, and claims against the reference files. Fix anything
            that is wrong.
          </li>
          <li>
            <strong>Decide where the risk goes.</strong> Identify work below the
            recommended level. Explain what could go wrong, who would deal with
            it, and when it would show up.
          </li>
          <li>
            <strong>Complete the answer sheet.</strong> Include your decision,
            corrected allocation, and evidence for your changes.
          </li>
        </ol>
      </section>

      <section className="post-assessment-win-conditions">
        <h4>Requirements your plan must meet</h4>
        <ul>
          <li>Fully staff every project line.</li>
          <li>Meet every line’s minimum skill level.</li>
          <li>Keep each person within their available hours.</li>
          <li>
            State exactly how many hours fall below the recommended level, and
            on which project lines.
          </li>
        </ul>
        <p>All hours are per week.</p>
      </section>

      <section>
        <h4>Include in your answer sheet</h4>
        <ol>
          <li>
            <strong>Your decision and tradeoffs:</strong> the draft you chose,
            why you placed the work below the recommended level where you did,
            and why you rejected one other draft. Use the consequences in the
            reference files to explain the risks.
          </li>
          <li>
            <strong>Your corrected allocation:</strong> who works on what, hours
            per week, each person’s level versus the recommended level, and the
            total hours below that level.
          </li>
          <li>
            <strong>Your changes and evidence:</strong> what the draft said,
            what you changed, and the evidence supporting each change.
          </li>
        </ol>
        <p>
          There is no single correct plan. We are interested in how you make
          decisions, use AI, and check that the final plan and its claims hold
          up.
        </p>
      </section>

      <section>
        <h4>Your reference files</h4>
        <ul>
          {FOLLOW_UP_TOOLKIT.map(({ filename, description }) => (
            <li key={filename}>
              <strong>{filename}</strong> — {description}
            </li>
          ))}
        </ul>
      </section>

      <section className="post-assessment-win-conditions">
        <h4>Submission checklist</h4>
        <ul>
          <li>
            Start the task and activity recording before you begin. Task
            duration is recorded automatically.
          </li>
          <li>Complete the answer sheet and export it as a PDF.</li>
          <li>
            Review your recorded activity report and answer the questionnaire
            below.
          </li>
          <li>
            Submit your answer sheet, recorded activity report, and
            questionnaire together in the app.
          </li>
        </ul>
      </section>
    </div>
  );
}
