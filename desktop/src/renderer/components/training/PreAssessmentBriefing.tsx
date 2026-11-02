import AssessmentMission from './AssessmentMission';

export const PRE_ASSESSMENT_TOOLKIT = [
  { filename: 'draft_plans.docx' },
  { filename: 'inventory.xlsx' },
  { filename: 'orders.docx' },
  { filename: 'ops_notes.docx' },
  { filename: 'answer_template.docx' },
];

export default function PreAssessmentBriefing() {
  return (
    <AssessmentMission
      title="Count Before You Commit"
      winConditions={
        <>
          <li>
            Meet the committed demand of 600 complete Mk3 kits with no more than
            30 units unfilled.
          </li>
          <li>
            Count a unit as filled only if it can be delivered inside the
            window, or a contract term says otherwise.
          </li>
          <li>
            Every source of units uses numbers you checked. Fix anything wrong
            in the chosen draft with evidence.
          </li>
          <li>
            Explain what your plan gives up, who absorbs it, and why you did not
            choose another plan.
          </li>
          <li>
            Start the task timer and activity recording before you begin, and
            include your complete AI interaction history. Submit the recorded
            activity report, answer sheet PDF, and questionnaire. Task duration
            is recorded automatically.
          </li>
        </>
      }
    >
      <p>
        You are a supply planner at Meridian Analytics Inc., a fictional
        company. Today is July 20, 2026. Meridian ships FieldSense sensor kits
        to customer sites. Orders committed for September 1–November 30, 2026
        add up to more kits than there is stock to fill them. An AI planning
        tool has produced three rough draft supply plans. None has been checked
        by a person.
      </p>
      <p>
        Choose one draft to take forward, check its numbers and claims against
        the provided files, fix anything that is wrong, and update the plan so
        it still meets the target. Then complete the answer sheet with:
      </p>
      <ol>
        <li>
          The plan you chose, where it leaves units unfilled and why, and why
          you did not choose another plan.
        </li>
        <li>
          Your corrected plan, including each source of units, how many, and
          where the number comes from.
        </li>
        <li>
          What you changed from the AI draft and the evidence for each change.
        </li>
      </ol>
      <p>
        There is no single correct plan. Explain what your plan gives up, who
        absorbs it, and why. Every line needs a checked source. Units are
        complete Mk3 kits; the target is no more than 30 unfilled units out of
        the committed demand of 600.
      </p>
    </AssessmentMission>
  );
}
