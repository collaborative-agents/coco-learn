import type { ReactNode } from 'react';
import './ChatComparisonLayout.css';

export interface ComparisonPane {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  actions?: ReactNode;
}

/** Presentation only: panes can compare tools, models, or other settings. */
export default function ChatComparisonLayout({
  panes,
}: {
  panes: ComparisonPane[];
}) {
  return (
    <div className="chat-comparison" aria-label="Compare conversations">
      {panes.map((pane) => (
        <section
          className="chat-comparison-pane"
          key={pane.id}
          aria-label={pane.title}
        >
          <header className="chat-comparison-heading">
            <div>
              <strong>{pane.title}</strong>
              {pane.description && <p>{pane.description}</p>}
            </div>
            {pane.actions}
          </header>
          {pane.content}
        </section>
      ))}
    </div>
  );
}
