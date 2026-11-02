/* eslint-disable react/require-default-props -- React 19 uses default function parameters. */
import { useEffect, useState, type ReactNode } from 'react';
import type { TrainingDocument } from '../../../shared/training-materials';
import { cachedTaskBrief, loadTaskBrief } from './task-brief-cache';
import { briefParagraphs, type TaskBrief } from './task-brief';
import './TaskBrief.css';

function SectionText({ text }: { text: string }) {
  const blocks = briefParagraphs(text).reduce<
    { list: boolean; texts: string[] }[]
  >((groups, block) => {
    const previous = groups.at(-1);
    if (block.list && previous?.list) previous.texts.push(block.text);
    else groups.push({ list: block.list, texts: [block.text] });
    return groups;
  }, []);
  return (
    <>
      {blocks.map((block, index) =>
        block.list ? (
          // These immutable blocks have no identity other than their order in the source.
          // eslint-disable-next-line react/no-array-index-key
          <ol className="training-brief-items" key={index}>
            {block.texts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        ) : (
          // eslint-disable-next-line react/no-array-index-key
          <p key={index}>{block.texts[0]}</p>
        ),
      )}
    </>
  );
}

export default function PdfTaskBrief({
  document,
  referenceDownload = null,
}: {
  document: TrainingDocument;
  referenceDownload?: ReactNode;
}) {
  const [brief, setBrief] = useState<TaskBrief | null>(() =>
    cachedTaskBrief(document),
  );
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setBrief(cachedTaskBrief(document));
    setError('');
    loadTaskBrief(document)
      .then((result) => {
        if (active) setBrief(result);
        return undefined;
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [document, retry]);
  if (error)
    return (
      <>
        <div role="alert" className="training-error">
          {error}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry instructions
          </button>
        </div>
        {referenceDownload}
      </>
    );
  if (!brief) return <p role="status">Preparing your task brief…</p>;
  const mission = brief.sections.filter(
    (section) => section.title === 'Your mission',
  );
  const background = brief.sections.filter(
    (section) => section.title === 'Background',
  );
  const missionContent = mission.length
    ? mission
    : brief.sections.filter((section) => section.title === 'Your task');
  const deliverables = brief.sections.filter(
    (section) => section.title === 'Deliverables',
  );
  const outcomes = brief.sections.filter((section) =>
    ['Success criteria', 'Success checklist', 'Keep in mind'].includes(
      section.title,
    ),
  );
  const references = brief.sections.filter(
    (section) => section.title === 'Reference files',
  );
  const otherSections = brief.sections.filter(
    (section) =>
      ![
        'Background',
        'Your mission',
        'Your task',
        'Deliverables',
        'Success criteria',
        'Success checklist',
        'Keep in mind',
        'Reference files',
        'What happens next',
      ].includes(section.title),
  );
  return (
    <article className="training-task-brief">
      <div className="post-assessment-mission">
        <h3>{brief.title}</h3>
        {background.map((section) => (
          <section className="training-brief-context" key={section.title}>
            <h4>Background</h4>
            <SectionText text={section.text} />
          </section>
        ))}
        {missionContent.length > 0 && (
          <section className="training-brief-context">
            <h4>Your mission</h4>
            {missionContent.map((section) => (
              <SectionText key={section.title} text={section.text} />
            ))}
          </section>
        )}
        {deliverables.length > 0 && (
          <section className="post-assessment-win-conditions">
            <h4>Deliverables</h4>
            {deliverables.map((section) => (
              <SectionText key={section.title} text={section.text} />
            ))}
          </section>
        )}
        {outcomes.length > 0 && (
          <section className="post-assessment-win-conditions">
            <h4>Win conditions</h4>
            {outcomes.map((section) => (
              <div key={section.title}>
                {section.title === 'Keep in mind' && (
                  <strong>Keep in mind</strong>
                )}
                <SectionText text={section.text} />
              </div>
            ))}
          </section>
        )}
      </div>
      {(references.length > 0 || referenceDownload) && (
        <section className="post-assessment-toolkit">
          <div>
            <h4>Reference files</h4>
            {references.map((section) => (
              <SectionText key={section.title} text={section.text} />
            ))}
          </div>
          {referenceDownload}
        </section>
      )}
      {otherSections.map((section) => (
        <section key={section.title}>
          <h4>{section.title}</h4>
          <SectionText text={section.text} />
        </section>
      ))}
    </article>
  );
}
