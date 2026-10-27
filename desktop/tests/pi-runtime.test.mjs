import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRuntime } from '../release/app/agent/pi-runtime.mjs';

// Real SDK + real file tools; only the model and Coco's HTTP service are fake.
test('pi executes built-in and Coco tools, resumes its session, and aborts', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-pi-test-'));
  let requestCount = 0;
  let hang = false;
  let notifyRequest;
  let lastRequest;
  const tools = [
    'observe_screen',
    'get_user_context',
    'get_recent_observations',
  ].map((name) => ({
    type: 'function',
    function: {
      name,
      description: name,
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
    },
  }));
  const server = http.createServer(async (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer test-token');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (req.url === '/agent/tools/execute') {
      assert.equal(body.name, 'get_user_context');
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          count: 1,
          results: [{ text: 'Likes concise replies.' }],
        }),
      );
      return;
    }
    assert.equal(req.url, '/agent/v1/chat/completions');
    lastRequest = body;
    requestCount += 1;
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const emit = (delta, finish_reason = null) =>
      res.write(
        `data: ${JSON.stringify({
          id: 'test',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'coco',
          choices: [{ index: 0, delta, finish_reason }],
        })}\n\n`,
      );
    emit({ role: 'assistant' });
    if (hang) {
      notifyRequest?.();
      return;
    }
    if (requestCount === 1) {
      for (const name of [
        'read',
        'write',
        'edit',
        'bash',
        'ask_user_question',
        ...tools.map((t) => t.function.name),
      ]) {
        assert.ok(
          body.tools.some((t) => t.function.name === name),
          `Missing ${name}`,
        );
      }
      emit({ content: 'I will write the file and check context.' });
      emit({
        tool_calls: [
          {
            index: 2,
            id: 'question-1',
            type: 'function',
            function: {
              name: 'ask_user_question',
              arguments: JSON.stringify({
                questions: [
                  {
                    header: 'Style',
                    question: 'Which style?',
                    options: [
                      { label: 'Brief', description: 'Short answers' },
                      { label: 'Detailed', description: 'Full explanations' },
                    ],
                  },
                ],
              }),
            },
          },
          {
            index: 0,
            id: 'write-1',
            type: 'function',
            function: {
              name: 'write',
              arguments: JSON.stringify({
                path: 'result.txt',
                content: 'Made by pi',
              }),
            },
          },
          {
            index: 1,
            id: 'memory-1',
            type: 'function',
            function: {
              name: 'get_user_context',
              arguments: '{"query":"preferences"}',
            },
          },
          {
            index: 3,
            id: 'denied-shell',
            type: 'function',
            function: {
              name: 'bash',
              arguments: JSON.stringify({
                command: 'touch shell-should-not-run',
              }),
            },
          },
          {
            index: 4,
            id: 'denied-file',
            type: 'function',
            function: {
              name: 'read',
              arguments: JSON.stringify({ path: '../outside.txt' }),
            },
          },
        ],
      });
      emit({}, 'tool_calls');
    } else {
      emit({ content: 'Created result.txt.' });
      emit({}, 'stop');
    }
    res.end('data: [DONE]\n\n');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const context = {
    instructions: 'You are Coco.',
    profile: 'Current task: test',
    model: 'test-model',
    history: [],
    tools,
  };
  const options = {
    cwd: directory,
    sessionId: 'test-session',
    dataDir: directory,
    tutorUrl: `http://127.0.0.1:${server.address().port}`,
    token: 'test-token',
    context,
    requestApproval: async (action) => {
      assert.equal(action.tool, 'bash');
      assert.equal(action.arguments.command, 'touch shell-should-not-run');
      return false;
    },
  };
  let runtime;
  try {
    runtime = await createRuntime(options);
    const events = [];
    runtime.subscribe((event) => {
      events.push(event);
      if (
        event.type === 'tool_execution_update' &&
        event.toolName === 'ask_user_question' &&
        event.partialResult?.details?.waitingForAnswer
      ) {
        assert.throws(
          () => runtime.answerQuestion(event.toolCallId, { answers: [] }),
          /Answer each/,
        );
        runtime.answerQuestion(event.toolCallId, {
          answers: [{ selected: ['Brief'], text: '' }],
        });
        assert.throws(
          () => runtime.answerQuestion(event.toolCallId, { cancelled: true }),
          /no longer/,
        );
      }
    });
    await runtime.prompt('Create the file.', [], context);
    assert.equal(
      fs.existsSync(path.join(directory, 'shell-should-not-run')),
      false,
    );
    for (const id of ['denied-shell', 'denied-file']) {
      assert.ok(
        events.some(
          (event) =>
            event.type === 'tool_execution_end' &&
            event.toolCallId === id &&
            event.isError &&
            JSON.stringify(event.result).includes('Permission denied'),
        ),
      );
    }
    const requestsBeforeInspect = requestCount;
    const inspected = runtime.getContextSnapshot();
    assert.ok(inspected.estimatedTokens > 0);
    assert.ok(inspected.categories.length > 0);
    assert.equal(inspected.reported.contextWindow, 64000);
    assert.match(JSON.stringify(inspected), /Create the file/);
    assert.equal(
      requestCount,
      requestsBeforeInspect,
      'inspection must not prompt',
    );
    assert.equal(
      fs.readFileSync(path.join(directory, 'result.txt'), 'utf8'),
      'Made by pi',
    );
    assert.ok(
      events.some(
        (event) =>
          event.type === 'tool_execution_end' &&
          event.toolName === 'get_user_context' &&
          !event.isError,
      ),
    );
    assert.ok(
      events.some(
        (event) =>
          event.type === 'tool_execution_end' &&
          event.toolName === 'ask_user_question' &&
          event.result?.details?.answers?.[0]?.answer === 'Brief',
      ),
    );
    assert.ok(
      lastRequest.messages.some(
        (message) =>
          message.role === 'tool' && message.content.includes('Brief'),
      ),
    );
    runtime.dispose();
    runtime = await createRuntime(options);
    await runtime.prompt('What did you do?', [], context);
    assert.ok(
      lastRequest.messages.some((message) => message.role === 'tool'),
      'Resumed session retains tool evidence',
    );
    hang = true;
    const started = new Promise((resolve) => {
      notifyRequest = resolve;
    });
    const pending = runtime.prompt('Wait for a long request.', [], context);
    await started;
    await runtime.abort();
    await pending;
  } finally {
    runtime?.dispose();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('two sessions overlap with independent routing and cancellation', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-pi-parallel-'));
  let firstStarted;
  const started = new Promise((resolve) => {
    firstStarted = resolve;
  });
  const received = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const id = req.headers['x-coco-session'];
    received.push({ id, messages: body.messages });
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    if (id === 'a') {
      res.write(': waiting\n\n');
      firstStarted();
      return;
    }
    res.end(
      `data: ${JSON.stringify({
        id: 'b-reply',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'coco',
        choices: [
          {
            index: 0,
            delta: { content: 'B completed independently.' },
            finish_reason: 'stop',
          },
        ],
      })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const context = {
    model: 'fake',
    instructions: 'Be helpful.',
    profile: '',
    history: [],
    tools: [],
  };
  let a;
  let b;
  try {
    const tutorUrl = `http://127.0.0.1:${server.address().port}`;
    const aDir = path.join(directory, 'a');
    const bDir = path.join(directory, 'b');
    fs.mkdirSync(aDir);
    fs.mkdirSync(bDir);
    a = await createRuntime({
      cwd: aDir,
      sessionId: 'a',
      dataDir: directory,
      tutorUrl,
      token: 'token',
      context,
    });
    b = await createRuntime({
      cwd: bDir,
      sessionId: 'b',
      dataDir: directory,
      tutorUrl,
      token: 'token',
      context,
    });
    const first = a
      .prompt('Task A private context', [], context)
      .catch(() => {});
    await started;
    await b.prompt('Task B private context', [], context);
    assert.deepEqual(
      received.map((entry) => entry.id),
      ['a', 'b'],
    );
    assert.ok(
      !JSON.stringify(received[1].messages).includes('Task A private context'),
    );
    await a.abort();
    await first;
    await b.prompt('Continue B', [], context);
    assert.equal(received.at(-1).id, 'b');
  } finally {
    a?.dispose();
    b?.dispose();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('training exposes no tools on the left and only approval-gated Bash on the right', async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'coco-tool-training-'),
  );
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const sessionId = req.headers['x-coco-session'];
    requests.push({ sessionId, body });
    const first =
      requests.filter((item) => item.sessionId === sessionId).length === 1;
    const name = sessionId === 'without' ? 'write' : 'bash';
    const args =
      name === 'write'
        ? { path: 'should-not-exist.txt', content: 'bad' }
        : { command: 'echo approved > approved.txt' };
    const delta = first
      ? {
          tool_calls: [
            {
              index: 0,
              id: `${sessionId}-call`,
              type: 'function',
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        }
      : { content: 'Finished.' };
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(
      `data: ${JSON.stringify({ id: 'reply', object: 'chat.completion.chunk', created: 1, model: 'coco', choices: [{ index: 0, delta, finish_reason: first ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const context = {
    model: 'fake',
    instructions: 'Answer honestly.',
    profile: '',
    history: [],
    tools: [],
  };
  const runtimes = [];
  try {
    let approvals = 0;
    for (const [sessionId, toolMode] of [
      ['without', 'none'],
      ['with', 'bash'],
    ]) {
      const runtime = await createRuntime({
        cwd: directory,
        sessionId,
        dataDir: directory,
        tutorUrl: `http://127.0.0.1:${server.address().port}`,
        token: 'token',
        context,
        toolMode,
        persistTraining: true,
        requestApproval: async () => {
          approvals += 1;
          return false;
        },
      });
      runtimes.push(runtime);
      await runtime.prompt('Inspect the practice file.', [], context);
    }
    assert.deepEqual(
      requests.find((entry) => entry.sessionId === 'without').body.tools ?? [],
      [],
    );
    assert.deepEqual(
      requests
        .find((entry) => entry.sessionId === 'with')
        .body.tools.map((tool) => tool.function.name),
      ['bash'],
    );
    runtimes.splice(0).forEach((runtime) => runtime.dispose());
    const reopened = await createRuntime({
      cwd: directory,
      sessionId: 'without',
      dataDir: directory,
      tutorUrl: `http://127.0.0.1:${server.address().port}`,
      token: 'token',
      context,
      toolMode: 'none',
      persistTraining: true,
    });
    runtimes.push(reopened);
    await reopened.prompt('Continue my earlier question.', [], context);
    const resumed = requests.at(-1).body;
    assert.ok(
      JSON.stringify(resumed.messages).includes('Inspect the practice file.'),
    );
    assert.deepEqual(resumed.tools ?? [], []);
    assert.equal(approvals, 1);
    assert.equal(
      fs.existsSync(path.join(directory, 'should-not-exist.txt')),
      false,
    );
    assert.equal(fs.existsSync(path.join(directory, 'approved.txt')), false);
    assert.ok(
      JSON.stringify(
        requests.filter((entry) => entry.sessionId === 'with').at(-1).body
          .messages,
      ).includes('Permission denied by user'),
    );
  } finally {
    runtimes.forEach((runtime) => runtime.dispose());
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Context practice exposes only guarded read and captures the file result in the context viewer', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-context-practice-'));
  const workspace = path.join(directory, 'workspace');
  fs.mkdirSync(workspace);
  fs.writeFileSync(path.join(workspace, 'notes.txt'), 'Unique practice file contents');
  fs.writeFileSync(path.join(directory, 'outside.txt'), 'Private outside contents');
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(body);
    const calling = requests.length === 2;
    const delta = calling ? { tool_calls: [
      { index: 0, id: 'read-1', type: 'function', function: { name: 'read', arguments: JSON.stringify({ path: 'notes.txt', limit: 40 }) } },
      { index: 1, id: 'write-1', type: 'function', function: { name: 'write', arguments: JSON.stringify({ path: 'should-not-exist.txt', content: 'bad' }) } },
      { index: 2, id: 'outside-1', type: 'function', function: { name: 'read', arguments: JSON.stringify({ path: '../outside.txt' }) } },
    ] } : { content: requests.length === 1 ? 'I can see only the linked path.' : 'The file says: Unique practice file contents.' };
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(`data: ${JSON.stringify({ id: 'reply', object: 'chat.completion.chunk', created: 1, model: 'coco', choices: [{ index: 0, delta, finish_reason: calling ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const context = { model: 'fake', instructions: 'Explain access versus file contents honestly.', profile: '', history: [], tools: [] };
  let runtime;
  try {
    runtime = await createRuntime({ cwd: workspace, sessionId: 'context-practice', dataDir: directory, tutorUrl: `http://127.0.0.1:${server.address().port}`, token: 'test', context, toolMode: 'read', persistTraining: true, requestApproval: async () => false });
    await runtime.prompt('Without opening it, what does @"notes.txt" tell you?', [], context);
    assert.ok(!JSON.stringify(runtime.getContextSnapshot()).includes('Unique practice file contents'));
    await runtime.prompt('Read notes.txt and show me an excerpt.', [], context);
    requests.forEach((body) => assert.deepEqual(body.tools.map((tool) => tool.function.name), ['read']));
    const finalContext = JSON.stringify(runtime.getContextSnapshot());
    assert.ok(finalContext.includes('Unique practice file contents'));
    assert.ok(!finalContext.includes('Private outside contents'));
    assert.equal(fs.existsSync(path.join(workspace, 'should-not-exist.txt')), false);
    assert.ok(JSON.stringify(requests.at(-1).messages).includes('Unique practice file contents'));
  } finally {
    runtime?.dispose();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
