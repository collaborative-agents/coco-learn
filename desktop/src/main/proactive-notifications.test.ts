/** @jest-environment node */
import { BrowserWindow } from 'electron';
import createProactiveNotifications from './proactive-notifications';
import type { InstantSuggestion } from './proactive-types';

jest.mock('electron', () => {
  const { EventEmitter } = require('events');
  return {
    BrowserWindow: jest.fn().mockImplementation((options) => {
      const window = new EventEmitter();
      window.options = options;
      window.destroyed = false;
      window.webContents = { send: jest.fn() };
      window.isDestroyed = () => window.destroyed;
      window.isVisible = () => true;
      window.loadURL = jest.fn();
      window.showInactive = jest.fn();
      window.getBounds = () => ({
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height,
      });
      window.setBounds = jest.fn();
      window.destroy = jest.fn(() => {
        window.destroyed = true;
        window.emit('closed');
      });
      return window;
    }),
    screen: {
      getPrimaryDisplay: () => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      }),
      getDisplayMatching: () => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      }),
    },
  };
});
jest.mock('electron-log', () => ({ info: jest.fn(), warn: jest.fn() }));
jest.mock('./services/fullscreen-companion-window', () => jest.fn());
jest.mock('./util', () => ({ resolveHtmlPath: () => 'file:///index.html' }));

function setup() {
  const handlers: Record<string, (...args: any[]) => void> = {};
  const state = {
    allowed: true,
    sleeping: false,
    assessment: false,
    active: false,
    suspended: false,
    hidden: true,
    task: '',
  };
  const gateway = {
    addNotification: jest.fn(async (_notification: { id: string }) => {}),
    resolveNotification: jest.fn(async () => {}),
  };
  const avatar = {
    webContents: { send: jest.fn() },
    isDestroyed: () => false,
    isVisible: () => true,
  };
  const deps = {
    ipc: {
      on: (channel: string, handler: any) => {
        handlers[channel] = handler;
      },
      removeAllListeners: jest.fn(),
    },
    gateway: () => gateway,
    avatar: () => avatar,
    prepareAvatar: jest.fn(async () => avatar),
    showAvatar: jest.fn(),
    recapOpen: () => false,
    allowed: () => state.allowed,
    sleeping: () => state.sleeping,
    assessmentActive: () => state.assessment,
    suspended: () => state.suspended,
    avatarHidden: () => state.hidden,
    sessionActive: () => state.active,
    sessionId: () => 'session',
    taskLabel: () => state.task,
    setTaskLabel: (label: string) => {
      state.task = label;
    },
    clearHiddenSuggestion: jest.fn(),
    preload: () => '/preload',
    profile: () => ({ scenario: 'ai_upskilling' }),
    precompute: jest.fn(() =>
      Promise.resolve(null as InstantSuggestion | null),
    ),
    availableTools: () => [],
    openChat: jest.fn(),
    startSession: jest.fn(async () => 'session'),
  };
  const controller = createProactiveNotifications(
    deps as unknown as Parameters<typeof createProactiveNotifications>[0],
  );
  return { controller, handlers, state, gateway, avatar, deps };
}
const payload = { message: 'Help?', actionLabel: 'Open' };
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('suppresses proactive notifications when asleep, denied, or taking an assessment', () => {
  const t = setup();
  for (const key of ['sleeping', 'assessment'] as const) {
    t.state[key] = true;
    expect(t.controller.showNotification(payload)).toBe(false);
    t.state[key] = false;
  }
  t.state.allowed = false;
  expect(t.controller.showNotification(payload)).toBe(false);
  expect(BrowserWindow).not.toHaveBeenCalled();
});

it('keeps a hovered notification and records its accepted outcome only once', async () => {
  const t = setup();
  t.controller.showNotification(payload);
  const first = t.controller.window as any;
  first.emit('ready-to-show');
  const id = t.gateway.addNotification.mock.calls[0][0].id;
  t.handlers['notification-hover-state']({}, { hovered: true });
  expect(t.controller.showNotification(payload)).toBe(false);
  t.handlers['notification-response'](
    {},
    { notificationId: id, outcome: 'accepted' },
  );
  t.controller.dismissNotification();
  jest.advanceTimersByTime(5 * 60_000);
  await Promise.resolve();
  expect(t.gateway.resolveNotification).toHaveBeenCalledTimes(1);
  expect(t.gateway.resolveNotification).toHaveBeenCalledWith(id, 'accepted');
});

it('does not let an old window closing clear a replacement', async () => {
  const t = setup();
  t.controller.showNotification(payload);
  const old = t.controller.window as any;
  old.destroy.mockImplementation(() => {
    old.destroyed = true;
  });
  t.controller.showNotification(payload);
  const replacement = t.controller.window;
  old.emit('closed');
  expect(t.controller.window).toBe(replacement);
  t.controller.dispose();
  await Promise.resolve();
  expect(t.gateway.resolveNotification).toHaveBeenCalledTimes(2);
});

it('drops stale invite previews and invalidates a preview when observation stops', async () => {
  const t = setup();
  t.state.hidden = false;
  const resolve: ((value: InstantSuggestion | null) => void)[] = [];
  t.deps.precompute.mockImplementation(
    () =>
      new Promise((done) => {
        resolve.push(done);
      }),
  );
  t.controller.showSessionInvite({ observation_id: 'old' }, 'Old task');
  t.controller.showSessionInvite({ observation_id: 'new' }, 'New task');
  resolve[0](null);
  await Promise.resolve();
  expect(BrowserWindow).not.toHaveBeenCalled();
  resolve[1](null);
  await Promise.resolve();
  await Promise.resolve();
  expect(t.state.task).toBe('New task');
  expect(BrowserWindow).not.toHaveBeenCalled();
  expect(t.avatar.webContents.send).toHaveBeenCalledWith('session-invite', expect.objectContaining({taskLabel:'New task'}));
  t.controller.showSessionInvite({ observation_id: 'paused' }, 'Paused task');
  t.controller.invalidateInvite();
  resolve[2](null);
  await Promise.resolve();
  expect(BrowserWindow).not.toHaveBeenCalled();
  expect(t.avatar.webContents.send.mock.calls.filter(([channel]) => channel === 'session-invite')).toHaveLength(1);
  t.controller.dispose();
});

it('records avatar invites only when shown and accepts them with editable screen context', async () => {
  const t = setup();
  t.state.hidden = false;
  t.controller.showSessionInvite(
    { observation_id: 'obs', observation: 'A report is open' },
    'Report',
  );
  await Promise.resolve();
  await Promise.resolve();
  const invite = t.avatar.webContents.send.mock.calls.find(
    ([channel]) => channel === 'session-invite',
  )![1];
  expect(t.gateway.addNotification).not.toHaveBeenCalled();
  t.handlers['session-invite-shown']({}, { inviteId: invite.inviteId });
  t.handlers['session-invite-shown']({}, { inviteId: invite.inviteId });
  expect(t.gateway.addNotification).toHaveBeenCalledTimes(1);
  expect(t.deps.showAvatar).toHaveBeenCalledTimes(1);
  t.handlers['session-invite-response'](
    {},
    { inviteId: invite.inviteId, outcome: 'accepted' },
  );
  await Promise.resolve();
  expect(t.deps.startSession).toHaveBeenCalledWith(
    'Report',
    120,
    'proactive_suggestion',
    expect.objectContaining({
      deferUntilUserMessage: true,
      screenObservation: 'A report is open',
    }),
  );
  expect(t.gateway.resolveNotification).toHaveBeenCalledWith(
    invite.inviteId,
    'accepted',
  );
  t.controller.dispose();
});

it('uses A for hidden-avatar advice without preparing or showing B', async () => {
  const t = setup();
  t.deps.precompute.mockResolvedValue({kind:'content',title:'Review the result',copyText:'Check the controls.'});
  t.controller.showSessionInvite({observation_id:'hidden',observation:'A game is open'},'Game');
  await Promise.resolve();
  await Promise.resolve();
  expect(t.deps.prepareAvatar).not.toHaveBeenCalled();
  expect(BrowserWindow).toHaveBeenCalledTimes(1);
  expect(t.avatar.webContents.send).not.toHaveBeenCalled();
  expect(t.deps.showAvatar).not.toHaveBeenCalled();
  expect(t.gateway.addNotification).toHaveBeenCalledTimes(1);
  t.controller.dispose();
});

it('drops an invitation if the session starts while the avatar renderer loads', async () => {
  const t = setup();
  t.state.hidden = false;
  let ready!: (avatar: typeof t.avatar) => void;
  t.deps.prepareAvatar.mockImplementation(() => new Promise(resolve => {ready=resolve;}));
  t.controller.showSessionInvite({observation_id:'loading'},'Game');
  await Promise.resolve();
  t.state.active = true;
  ready(t.avatar);
  await Promise.resolve();
  expect(t.avatar.webContents.send).not.toHaveBeenCalled();
  expect(BrowserWindow).not.toHaveBeenCalled();
  t.controller.dispose();
});

it('prevents A when Coco is shown and closes only advice when switching modes', () => {
  const t = setup();
  const advice = {message:'Check the game',actionLabel:'Read',notifType:'proactive-suggestion' as const,
    scenario:'ai_upskilling',suggestion:{kind:'content' as const,title:'Check',copyText:'Play a round'}};
  t.state.hidden = false;
  expect(t.controller.showNotification(advice)).toBe(false);
  expect(BrowserWindow).not.toHaveBeenCalled();
  t.state.hidden = true;
  expect(t.controller.showNotification(advice)).toBe(true);
  const window = t.controller.window!;
  t.controller.dismissAdviceNotification();
  expect(window.destroy).toHaveBeenCalledTimes(1);
  t.controller.showNotification({...payload,category:'system'});
  const system = t.controller.window!;
  t.controller.dismissAdviceNotification();
  expect(system.destroy).not.toHaveBeenCalled();
  t.controller.dispose();
});

it('does not fall back to A when B is already holding a lesson or another suggestion', async () => {
  const t = setup();
  t.state.hidden = false;
  t.controller.showSessionInvite({observation_id:'busy'},'Game');
  await Promise.resolve();
  await Promise.resolve();
  const invite = t.avatar.webContents.send.mock.calls.find(([channel]) => channel === 'session-invite')![1];
  t.handlers['session-invite-busy']({}, {inviteId:invite.inviteId});
  expect(BrowserWindow).not.toHaveBeenCalled();
  t.controller.dispose();
});
