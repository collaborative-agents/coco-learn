import AssessmentMission from './AssessmentMission';

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
    <AssessmentMission
      title="Decide Where the Risk Goes"
      winConditions={
        <>
          <li>
            Fully staff every project line and meet every line’s minimum skill
            level.
          </li>
          <li>Keep each person within their available hours.</li>
          <li>
            State exactly how many hours fall below the recommended level, and
            on which project lines.
          </li>
          <li>
            Fix anything wrong in the chosen draft with evidence. Explain what
            could go wrong, who would deal with it, and when it would show up.
          </li>
          <li>
            Start the task and activity recording before you begin. Review and
            submit the recorded activity report, answer sheet PDF, and
            questionnaire. Task duration is recorded automatically.
          </li>
        </>
      }
    >
      <p>
        You are a resourcing planner at Meridian Analytics Inc., a fictional
        company. Today is August 31, 2026. Three projects start on September 7,
        but there are not enough senior engineers to staff every project at its
        recommended skill level. An AI tool has drafted three staffing plans.
        None has been checked by a person.
      </p>
      <p>
        Choose one plan to take forward, check its assignments, hours, skill
        levels, and claims against the provided files, and fix anything that is
        wrong. Decide where your team can accept the risks of working below the
        recommended skill level. Then complete the answer sheet with:
      </p>
      <ol>
        <li>
          The draft you chose, why you placed work below the recommended level
          where you did, and why you rejected one other draft. Use the
          consequences in the reference files to explain the risks.
        </li>
        <li>
          Your corrected allocation: who works on what, hours per week, each
          person’s level versus the recommended level, and the total hours below
          that level.
        </li>
        <li>
          What the draft said, what you changed, and the evidence supporting
          each change.
        </li>
      </ol>
      <p>
        There is no single correct plan. We are interested in how you make
        decisions, use AI, and check that the final plan and its claims hold up.
        All hours are per week.
      </p>
    </AssessmentMission>
  );
}
