const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });

export default function GradeFeedback({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .flatMap((paragraph) =>
      Array.from(sentences.segment(paragraph), ({ segment }) =>
        segment.trim(),
      ).filter(Boolean),
    );
  return (
    <div className="grade-summary">
      {paragraphs.map((paragraph, index) => (
        <p
          key={`${index}-${paragraph}`}
          className={index === 0 ? 'grade-summary-takeaway' : undefined}
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}
