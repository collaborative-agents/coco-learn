import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import AgentActivityList, { groupActivity } from './AgentActivityList';
import ToolViewerAccess from './ToolViewerAccess';
import type { TutorToolCall } from '../observation-types';

const call = (
  id: string,
  command: string,
  status: TutorToolCall['status'] = 'completed',
): TutorToolCall => ({
  id,
  name: 'bash',
  arguments: { command },
  status,
  result: { output: 'Exact raw output' },
});

test('shows a human summary with readable command and output collapsed', () => {
  const { container } = render(
    <AgentActivityList
      activity={[{ kind: 'tool', call: call('1', 'rg token src') }]}
      interactive={false}
    />,
  );
  const disclosure = container.querySelector('details')!;
  expect(disclosure.open).toBe(false);
  expect(disclosure.querySelector('summary')).toHaveTextContent('Search files');
  expect(disclosure.querySelector('summary')).not.toHaveTextContent(
    'rg token src',
  );
  expect(disclosure.querySelector('pre')).toHaveTextContent('rg token src');
  fireEvent.click(disclosure.querySelector('summary')!);
  expect(disclosure.open).toBe(true);
  expect(disclosure.querySelectorAll('pre')[0]).toHaveTextContent(
    'rg token src',
  );
  expect(disclosure.querySelectorAll('pre')[1]).toHaveTextContent(
    'Exact raw output',
  );
  expect(disclosure).not.toHaveTextContent('"id"');
});

test('collapses consecutive calls and makes failures visible in the summary', () => {
  const { container } = render(
    <AgentActivityList
      activity={[
        { kind: 'tool', call: call('1', 'rg token src') },
        { kind: 'tool', call: call('2', 'cat README.md', 'error') },
      ]}
      interactive={false}
    />,
  );
  const group = container.querySelector('.tool-activity-group')!;
  expect(group).not.toHaveAttribute('open');
  const actions = group.querySelectorAll('details');
  expect(actions).toHaveLength(2);
  actions.forEach((action) => {
    expect(action.open).toBe(false);
    expect(action.querySelector('summary')).toHaveTextContent('bash');
    expect(action.querySelector('summary')).not.toHaveTextContent(
      'Run a script',
    );
  });
  fireEvent.click(group.querySelector('summary')!);
  expect(group).toHaveAttribute('open');
  expect(actions[0].open).toBe(false);
  fireEvent.click(actions[0].querySelector('summary')!);
  expect(actions[0].open).toBe(true);
  expect(actions[1].open).toBe(false);
  expect(actions[0]).toHaveTextContent('rg token src');
  expect(actions[1]).toHaveTextContent('cat README.md');
  expect(group.querySelectorAll('.tool-detail-field')).toHaveLength(4);
  expect(group.querySelector('summary')).toHaveTextContent(
    '2 steps · 1 failed',
  );
});

test('never hides a question inside a tool group or moves commentary out of order', () => {
  const groups = groupActivity([
    { kind: 'tool', call: call('1', 'ls') },
    { kind: 'message', text: 'Checking the relevant files.' },
    { kind: 'tool', call: { ...call('2', ''), name: 'ask_user_question' } },
    { kind: 'tool', call: call('3', 'cat README.md') },
  ]);
  expect(groups.map((item) => item.kind)).toEqual([
    'tools',
    'message',
    'question',
    'tools',
  ]);
});

test('hides blank saved messages and groups tools across whitespace', () => {
  const activity = [
    { kind: 'message' as const, text: '' },
    { kind: 'tool' as const, call: call('1', 'ls') },
    { kind: 'message' as const, text: ' \n\t' },
    { kind: 'tool' as const, call: call('2', 'cat README.md') },
    { kind: 'message' as const, text: '\n' },
  ];
  expect(groupActivity(activity)).toEqual([
    { kind: 'tools', key: '1', calls: [activity[1].call, activity[3].call] },
  ]);
  const { container } = render(
    <AgentActivityList activity={activity} interactive={false} />,
  );
  expect(container.querySelector('.tutor-response')).toBeNull();
  expect(container.querySelector('.tool-activity-group')).toHaveTextContent(
    '2 steps · Done',
  );
});

test('groups tool calls across approved requests while retaining denials', () => {
  const permission = {
    id: 'permission',
    kind: 'action' as const,
    tool: 'bash',
    arguments: { command: 'ls' },
    directory: '/work',
    status: 'allowed' as const,
  };
  const groups = groupActivity([
    { kind: 'tool', call: call('1', 'ls') },
    { kind: 'permission', request: permission },
    { kind: 'tool', call: call('2', 'pwd') },
    {
      kind: 'permission',
      request: { ...permission, id: 'denied', status: 'denied' },
    },
  ]);
  expect(groups.map((group) => group.kind)).toEqual(['tools', 'permission']);
  expect(groups[0].kind === 'tools' && groups[0].calls).toHaveLength(2);
});

test('folds finished locked steps into one summary that still opens to the full list', () => {
  const write = (id: string, status: TutorToolCall['status'] = 'completed'): TutorToolCall => ({
    id, name: 'write', arguments: { path: `file-${id}.html` }, status,
  });
  const steps = [write('1'), write('2'), write('3'), call('4', 'rg token src')];
  const locked = (activity: TutorToolCall[]) => (
    <ToolViewerAccess.Provider value={false}>
      <AgentActivityList activity={activity.map(item => ({ kind: 'tool' as const, call: item }))} interactive={false} />
    </ToolViewerAccess.Provider>
  );
  const { container, rerender } = render(locked(steps.map((item, index) => index === 3 ? { ...item, status: 'running' as const } : item)));
  // Live progress stays visible while the run is still working.
  expect(container.querySelector('details.tool-activity-group')).toBeNull();

  rerender(locked(steps));
  const group = container.querySelector('details.tool-activity-group') as HTMLDetailsElement;
  expect(group.open).toBe(false);
  expect(group.querySelector('summary')).toHaveTextContent('Write a file ×3');
  expect(group.querySelector('summary')).toHaveTextContent('4 steps · Done');
  expect(group.querySelector('summary')).toHaveTextContent('Show steps');
  expect(group.querySelector('.tool-activity-steps')?.children).toHaveLength(4);
});
