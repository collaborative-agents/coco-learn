/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IpcMain } from 'electron';
import registerWorkflowTraining, { validateSkill } from './workflow-training';

const draft = {
  name: 'team-update',
  description: 'Use to turn meeting notes into a team update.',
  instructions: [
    'When to use',
    'Inputs',
    'Workflow',
    'Checkpoints',
    'Output',
    'Quality checks',
    'Examples',
  ]
    .map(
      (name) =>
        `## ${name}\nAsk for missing details; draft an update and check the facts.`,
    )
    .join('\n\n'),
  files: [
    { name: 'template.md', content: '# Update\n## Decisions\n## Action items' },
  ],
};
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-quest-'));
  let user = 'alice';
  const handlers: Record<string, (...args: any[]) => any> = {};
  const options = {
    ipc: {
      handle: (name: string, handler: any) => {
        handlers[name] = handler;
      },
    } as unknown as IpcMain,
    root: () => root,
    user: () => user,
    currentUser: () => user,
    canStart: jest.fn(() => true),
    changed: jest.fn(),
    open: jest.fn(),
    run: jest.fn(async () => JSON.stringify(draft)),
    reveal: jest.fn(async (directory: string) => directory && ''),
  };
  const service = registerWorkflowTraining(options);
  return {
    root,
    options,
    service,
    call: (name: string, ...args: unknown[]) => handlers[name]({}, ...args),
    setUser: (value: string) => {
      user = value;
    },
  };
}
test('requires a tested current version, saves a complete package, resumes, and isolates accounts', async () => {
  const t = setup();
  try {
    t.options.canStart.mockReturnValue(false);
    expect(() => t.call('workflow-chapter-start')).toThrow('Chapter 4');
    t.options.canStart.mockReturnValue(true);
    const session = t.call('workflow-chapter-start');
    expect(t.call('workflow-chapter-start').sessionId).toBe(session.sessionId);
    await t.call(
      'workflow-chapter-generate',
      session.sessionId,
      'Weekly updates',
    );
    expect(() => t.call('workflow-chapter-save', session.sessionId)).toThrow(
      'Test the latest',
    );
    t.options.run.mockResolvedValue('Draft update: we shipped the feature.');
    await t.call(
      'workflow-chapter-test',
      session.sessionId,
      'We shipped the feature yesterday.',
    );
    t.call('workflow-chapter-edit', session.sessionId, {
      ...draft,
      instructions: `${draft.instructions}\nKeep it short.`,
    });
    expect(() => t.call('workflow-chapter-save', session.sessionId)).toThrow(
      'Test the latest',
    );
    await t.call(
      'workflow-chapter-test',
      session.sessionId,
      'We shipped the feature yesterday.',
    );
    const skill = t.call('workflow-chapter-save', session.sessionId);
    expect(skill.markdown).toContain('name: team-update');
    expect(t.call('workflow-chapter-progress').completedAt).toBeTruthy();
    expect(t.call('workflow-chapter-save', session.sessionId).id).toBe(
      skill.id,
    );
    await t.call('curated-skills-reveal', skill.id);
    const folder = t.options.reveal.mock.calls[0][0];
    expect(folder).toContain(path.join(t.root, 'skills'));
    expect(t.service.runtimeSkills('alice').paths).toEqual([folder]);
    expect(t.service.runtimeSkills('bob').paths).toEqual([]);
    expect(fs.readFileSync(path.join(folder, 'SKILL.md'), 'utf8')).toBe(
      skill.markdown,
    );
    expect(fs.readFileSync(path.join(folder, 'template.md'), 'utf8')).toContain(
      'Decisions',
    );
    registerWorkflowTraining(t.options);
    expect(t.call('curated-skills-list')).toHaveLength(1);
    const second = t.call('workflow-chapter-start', true);
    expect(second.sessionId).not.toBe(session.sessionId);
    expect(t.call('curated-skills-list')).toHaveLength(1);
    t.setUser('bob');
    expect(t.call('curated-skills-list')).toEqual([]);
    expect(t.call('workflow-chapter-session', second.sessionId)).toBeNull();
    await expect(t.call('curated-skills-reveal', skill.id)).rejects.toThrow(
      'not found',
    );
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});
test('rejects unsafe supporting paths and incomplete skill instructions', () => {
  expect(() => validateSkill({ ...draft, name: '../outside' })).toThrow(
    'lowercase',
  );
  expect(() =>
    validateSkill({
      ...draft,
      files: [{ name: '../outside.md', content: 'x' }],
    }),
  ).toThrow('filenames');
  expect(() =>
    validateSkill({ ...draft, instructions: 'Do something' }),
  ).toThrow('When to use');
});
test('does not mark failed or stale requests as successful, and blocks concurrent mutations', async () => {
  const t = setup();
  try {
    const session = t.call('workflow-chapter-start');
    t.options.run.mockResolvedValue('not json');
    await expect(
      t.call('workflow-chapter-generate', session.sessionId, 'Task'),
    ).rejects.toThrow();
    expect(
      t.call('workflow-chapter-session', session.sessionId).draft,
    ).toBeNull();
    let finish!: (result: string) => void;
    t.options.run.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = t.call(
      'workflow-chapter-generate',
      session.sessionId,
      'Task',
    );
    await expect(
      t.call('workflow-chapter-generate', session.sessionId, 'Again'),
    ).rejects.toThrow('Wait');
    expect(() => t.call('workflow-chapter-start')).toThrow('Wait');
    t.setUser('bob');
    finish(JSON.stringify(draft));
    await expect(pending).rejects.toThrow('account changed');
    t.setUser('alice');
    expect(
      t.call('workflow-chapter-session', session.sessionId).draft,
    ).toBeNull();
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});

test('chat clarifies, drafts, runs a real trial, and requires confirmation before saving', async () => {
  const t = setup();
  try {
    const session = t.call('workflow-chapter-start');
    const reply = (action: string, extra = {}) =>
      JSON.stringify({
        action,
        message: 'Here is the next question.',
        ...extra,
      });
    t.options.run.mockResolvedValueOnce(reply('reply'));
    await t.call(
      'workflow-chapter-chat',
      session.sessionId,
      'Help with weekly updates',
    );
    expect(
      t.call('workflow-chapter-session', session.sessionId).messages,
    ).toHaveLength(2);
    t.options.run.mockResolvedValueOnce(reply('draft', { draft }));
    await t.call(
      'workflow-chapter-chat',
      session.sessionId,
      'The audience is my team. Ask before finalizing.',
    );
    const created = t.call('workflow-chapter-session', session.sessionId);
    expect(created.version).toBe(1);
    expect(created.trials).toHaveLength(0);
    expect(created.messages.at(-1).text).toContain('team-update / SKILL.md');
    expect(created.messages.at(-1).text).toContain('name: team-update');
    expect(created.messages.at(-1).text).toContain(draft.instructions);
    expect(created.messages.at(-1).text).toContain('### template.md');
    expect(created.messages.at(-1).text).toContain(draft.files[0].content);
    t.options.run.mockResolvedValueOnce(reply('save'));
    await t.call('workflow-chapter-chat', session.sessionId, 'Save');
    expect(t.call('workflow-chapter-progress').completedAt).toBeNull();
    t.options.run
      .mockResolvedValueOnce(
        reply('test', { testInput: 'Notes: we shipped a feature.' }),
      )
      .mockResolvedValueOnce('Team update: we shipped a feature.');
    await t.call(
      'workflow-chapter-chat',
      session.sessionId,
      'Try these notes: we shipped a feature.',
    );
    expect(
      t.call('workflow-chapter-session', session.sessionId).trials[0].output,
    ).toBe('Team update: we shipped a feature.');
    t.options.run.mockResolvedValueOnce(reply('save'));
    await t.call(
      'workflow-chapter-chat',
      session.sessionId,
      'Looks good, save it.',
    );
    expect(t.call('workflow-chapter-progress').completedAt).toBeNull();
    expect(
      t.call('workflow-chapter-session', session.sessionId).awaitingSave,
    ).toBe(true);
    t.options.run.mockResolvedValueOnce(reply('save'));
    const saved = await t.call(
      'workflow-chapter-chat',
      session.sessionId,
      'Yes, save it.',
    );
    expect(saved.savedSkillId).toBeTruthy();
    expect(t.call('curated-skills-list')).toHaveLength(1);
    expect(saved.messages.at(-1).text).toContain('Your skill is saved');
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});

test('migrates legacy skills once and retains the library after quest records are removed', () => {
  const t = setup();
  try {
    t.call('workflow-chapter-start');
    const account = fs.readdirSync(path.join(t.root, 'workflow-chapter'))[0];
    const stateFile = path.join(
      t.root,
      'workflow-chapter',
      account,
      'state.json',
    );
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const skill = {
      ...draft,
      id: 'legacy',
      savedAt: 'today',
      markdown: `---\nname: ${draft.name}\ndescription: ${draft.description}\n---\n${draft.instructions}`,
    };
    state.skills = [skill];
    fs.writeFileSync(stateFile, JSON.stringify(state));
    fs.rmSync(path.join(t.root, 'skills'), { recursive: true });
    expect(t.call('curated-skills-list')).toEqual([skill]);
    const runtime = t.service.runtimeSkills('alice');
    expect(
      fs.readFileSync(path.join(runtime.paths[0], 'SKILL.md'), 'utf8'),
    ).toBe(skill.markdown);
    expect(
      fs.readFileSync(path.join(runtime.paths[0], 'template.md'), 'utf8'),
    ).toBe(draft.files[0].content);
    fs.rmSync(path.join(t.root, 'workflow-chapter'), { recursive: true });
    expect(t.call('curated-skills-list')).toEqual([skill]);
    expect(t.service.runtimeSkills('alice')).toEqual(runtime);
    expect(t.service.runtimeSkills('bob').paths).toEqual([]);
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});
