import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import GradeFeedback from './GradeFeedback';

it('separates sentences while preserving decimal values', () => {
  const text =
    'Your result is 84.5/100. Figure 1 shows 5,250, not 4,850. Verify the 22% value before submitting.';
  const { container } = render(<GradeFeedback text={text} />);
  const paragraphs = container.querySelectorAll('p');
  expect(paragraphs).toHaveLength(3);
  expect(Array.from(paragraphs, (p) => p.textContent).join(' ')).toBe(text);
  expect(paragraphs[0]).toHaveClass('grade-summary-takeaway');
});

it('renders feedback as text without interpreting embedded HTML', () => {
  const text = '<img src=x onerror=alert(1)> Check your report.';
  const { container } = render(<GradeFeedback text={text} />);
  expect(container.querySelector('img')).toBeNull();
  expect(container).toHaveTextContent(text);
});
