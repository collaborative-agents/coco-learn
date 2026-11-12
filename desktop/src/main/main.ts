import { designCharacter } from './game/character-artist';
import { captureCharacterArt } from './game/art-evidence';
import { reviewCharacterArt } from './game/art-review';
import validateGameInBrowser from './game/browser-validator';
import PiHarness from './services/pi-harness';
import WorkspacePermissions from './services/workspace-permissions';
import createProactiveNotifications from './proactive-notifications';
import type { ChatSeed, InstantSuggestion, SuggestionObservation } from './proactive-types';
import registerReactiveChat from './reactive-chat';
import RunnerTutorial from './services/runner-tutorial';
import type { RunnerGuide, RunnerAction } from '../shared/runner-tutorial';
import type { UnderstandingCheckResult } from '../shared/understanding-check';
import presentRunnerGuide from '../shared/runner-guide-presentation';
import ensureChatConversation from './chat-conversation';
import createAgent101Controller from './services/agent101-controller';
/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import isQuestConversation from '../shared/quest-conversations';
import CommandApprovalRules from './services/command-approval-rules';
import fs from 'fs';
import os from 'os';
import { randomUUID } from 'crypto';
import { createServer } from 'net';
import { exec, execFile, spawn } from 'child_process';
import {
  app,
  BrowserWindow,
  shell,
  clipboard,
  ipcMain,
  globalShortcut,
  Menu,
  Tray,
  nativeImage,
  dialog,
  screen,
  powerMonitor,
  systemPreferences,
  desktopCapturer,
} from 'electron';
import type { Rectangle, WebContents } from 'electron';
import { autoUpdater } from 'electron-updater';
import { DesktopAppUpdater } from './app-updater';
import { installDockUpdateMenu } from './dock-menu';
import {
  avatarRecoveryItems,
  cocoNavigationItems,
  placeAvatarMenu,
} from './avatar-menu';
import {
  type AvatarCardPlacement,
  avatarBubbleMaxHeight,
  placeAvatarBubble,
} from './avatar-bubble';
import setupWindowOptions from './setup-window-options';
import { InteractionTracker } from './interaction-tracker';
import { chatSuggestionText } from '../shared/chat-suggestion';
import { getGettingStartedArticle } from '../shared/getting-started';
import type { ChatSuggestion } from '../shared/chat-suggestion';
import {
  SocialService,
  registerSocialIpcHandlers,
} from './services/social-service';
import registerTrainingPanel from './training-panel-controller';
import type { StudyState } from '../shared/study';
import { syncPreAssessmentState } from './pre-assessment-store';
import configureFullscreenCompanionWindow from './services/fullscreen-companion-window';
import configureMainWindow, { resizeMainWindow } from './main-window-behavior';
import log from 'electron-log';
import axios from 'axios';
import { resolveHtmlPath } from './util';
import { serviceManager } from './services/manager';
import { developmentPython, pythonEnvironment } from './services/python-runtime';
import ServiceSupervisor from './services/service-supervisor';
import { runModelProbe, modelFailureMessage } from './services/model-probe';
import { configureServiceModelArguments } from './services/model-arguments';
import {
  retryOperation,
  RetryCancelledError,
} from './services/retry-operation';
import {
  shouldOfferInstantSuggestion,
  shouldSurfaceObservation,
} from './services/intervention-policy';
import {
  startObservationStream,
  stopObservationStream,
} from './services/observation-stream';
import { NextDaySummaryScheduler } from './services/next-day-summary-scheduler';
import type { TutorStreamEvent } from './services/tutor-stream';
import AgentRuns from './services/agent-runs';
import ChatStreamStore from './services/chat-stream-store';
import type { SessionContextInput } from './services/pi-harness';
import isChatOutOfView from './services/chat-visibility';
import AgentProgressReminder from './services/agent-progress-reminder';
import { CocoGatewayClient, GatewayHttpError } from './services/gateway-client';
import { createTutoringAccessRefresher } from './services/tutoring-access';
import {
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
} from './auth-session-store';
import {
  WakeWordService,
  type WakeWordStatusEvent,
} from './services/wake-word-service';
import {
  appendActivity as storeAppendActivity,
  readActivity,
  recordSupportEngagement as storeRecordSupportEngagement,
  recordSupportRating as storeRecordSupportRating,
  recordSupportSuggestion as storeRecordSupportSuggestion,
  pruneActivity,
} from './activity-store';
import {
  markLearningRecapsReviewedThrough,
  readLatestUnreviewedLearningDay,
  saveLearningRecap,
} from './learning-recap-store';
import {
  interruptStaleReplies,
  latestConversation,
  readConversations as readStoredConversations,
  restorableMessages,
  saveConversation,
  saveConversationDirectory,
  setConversationEnded,
  settleStoredReply,
} from './conversation-store';
import type { StoredConversation } from './conversation-store';
import {
  recordSessionEnded,
  recordSessionStarted,
  recordUnderstandingChecked,
} from './session-event-store';
import {
  readSystemPermissionWarning as readPlatformPermissionWarning,
  needsWindowsMicrophoneSettings,
  systemPermissionButtonLabel,
  systemPermissionExplanation,
  type SystemPermissionSettingsTarget,
} from './system-permission-warning';
import { openSystemPermissionSettings } from './open-system-permission-settings';
import {
  defaultTutor,
  isLlmRouterConfigured,
  normalizeRouterManagedModelConfiguration,
  ROUTER_MANAGED_MODEL_CONFIGURATION,
  getModelConfigurationView,
  prepareModelConnectionTest,
  readModelConfiguration,
  resolveModelRuntime,
  saveModelConfiguration,
  type ModelConfigurationInput,
  type ModelConnection,
} from './model-config-store';
import { ObservationSleepGuard } from './observation-sleep-guard';
import {
  cleanObservation,
  AI_TOOLS,
  resolveAiTools,
  parseAiTool,
} from '../renderer/components/observation-types';
import type {
  ObservationStatus,
  AiToolButton,
  LLMCallMetrics,
} from '../renderer/components/observation-types';
import type { AgentModeId } from '../shared/agent-modes';
import type { SessionStartTrigger } from '../shared/session-start';

const dotenv = require('dotenv');

type EmbeddedRouterConfig = { url?: string; gatewayUrl?: string };
declare const __COCO_BUILD_ROUTER_CONFIG__: EmbeddedRouterConfig | undefined;

const embeddedRouterConfig: EmbeddedRouterConfig =
  typeof __COCO_BUILD_ROUTER_CONFIG__ === 'undefined'
    ? {}
    : __COCO_BUILD_ROUTER_CONFIG__;

const PACKAGED_GATEWAY_URL =
  embeddedRouterConfig.gatewayUrl ||
  'https://coco.upskilling.saltlab.stanford.edu';
// Bump this whenever a packaged release must make every participant complete
// onboarding once again. Development builds do not use this release gate.
const PACKAGED_ONBOARDING_VERSION = 'auth-onboarding-v1';

const isNightlyBuild =
  app.isPackaged && /-nightly\.\d{14}$/.test(app.getVersion());
app.setName(isNightlyBuild ? 'Coco Learn Nightly' : 'Coco Learn');

// Set before the instance lock so Coco Learn can coexist with Coco. Existing
// Coco profiles stay in their original directory; users sign in here once.
if (app.isPackaged) {
  const packagedUserDataDir = path.join(
    app.getPath('appData'),
    isNightlyBuild ? 'coco-learn-nightly' : 'coco-learn',
  );
  fs.mkdirSync(packagedUserDataDir, { recursive: true });
  app.setPath('userData', packagedUserDataDir);
}

// Keep development data separate from installed builds. Otherwise `npm start`
// writes onboarding/auth state to the same macOS Application Support folder as
// the packaged app, causing a later installation to inherit the dev profile.
if (!app.isPackaged) {
  const developmentUserDataOverride =
    process.env.COCO_DESKTOP_USER_DATA_DIR?.trim();
  const resolvedUserDataDir = developmentUserDataOverride
    ? path.resolve(developmentUserDataOverride)
    : path.join(app.getPath('appData'), 'coco-learn-development');
  fs.mkdirSync(resolvedUserDataDir, { recursive: true });
  app.setPath('userData', resolvedUserDataDir);
  log.info(`[Development] userData directory: ${resolvedUserDataDir}`);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

if (app.isPackaged) {
  // Packaged: read .env from the user-data folder (e.g. ~/Library/Application
  // Support/coco/.env). Only the Router URL is embedded at build time; a
  // participant-scoped credential is fetched after authentication.
  dotenv.config({ path: path.join(app.getPath('userData'), '.env') });
  if (!process.env.LLM_ROUTER_URL && embeddedRouterConfig.url) {
    process.env.LLM_ROUTER_URL = embeddedRouterConfig.url;
  }
} else {
  // Dev: cwd is the desktop app dir, but the canonical .env (with GEMINI_API_KEY,
  // ANTHROPIC_API_KEY, etc.) lives at the repo root, one level up.
  // Load both — dotenv doesn't override pre-existing process.env entries, so
  // root-level keys win and desktop/.env supplies UI-only overrides.
  dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
  dotenv.config();
}

// Create default workspace directory if it doesn't exist
const ensureDefaultWorkspaceExists = () => {
  const workspaceDir = path.join(os.homedir(), 'coco-learn', 'tmp_workspace');
  try {
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
      log.info(`Created default workspace directory: ${workspaceDir}`);
    }
  } catch (error) {
    log.error(`Failed to create default workspace directory: ${error}`);
  }
};

let installUpdateAfterShutdown = false;
const desktopAppUpdater = new DesktopAppUpdater({
  updater: autoUpdater,
  logger: log,
  isPackaged: app.isPackaged,
  platform: process.platform,
  currentVersion: () => app.getVersion(),
  requestRestartAndInstall: () => {
    installUpdateAfterShutdown = true;
    app.quit();
  },
});

// ── Window state ─────────────────────────────────────────────────────────────
// avatarWindow      : always-on-top 150×150 pet/avatar (loads local index.html)
// chatWindow        : local tutor-chat side panel (loads index.html?view=session);
//                     created on demand, hidden (not destroyed) on close so the
//                     conversation survives a reopen. Talks only to the local
//                     tutor/sensing servers — no external backend or WebSocket.
// imagePreviewWindow: full-display preview for pending and sent chat images.
let avatarWindow: BrowserWindow | null = null;
// Base avatar footprint (just the pet). The avatar window is exactly this size;
// the bubble, menu and Activity panel each have their own window beside it.
const AVATAR_BASE_SIZE = 180;
// avatarMenuWindow: Coco's ••• menu, shown next to the pet on demand.
let avatarMenuWindow: BrowserWindow | null = null;
// Menu content size, reported by its renderer once laid out.
let avatarMenuSize = { width: 0, height: 0 };
let avatarMenuOpen = false;
let avatarMenuClosedAt = 0;
// Transparent room around the menu for its drop shadow; matches the padding of
// .avatar-menu-view.
const AVATAR_MENU_PADDING = 24;
// avatarBubbleWindow: the observation bubble, shown next to the pet.
let avatarBubbleWindow: BrowserWindow | null = null;
// The bubble the avatar renderer is showing (null when none), and the size of
// its card as laid out by the bubble window's renderer.
let avatarBubbleState: unknown = null;
let avatarBubbleCardSize = { width: 0, height: 0 };
// Transparent room around the card for its drop shadow; matches the padding of
// .avatar-bubble-view.
const AVATAR_BUBBLE_PADDING = 24;
// avatarHistoryWindow: Coco's Activity panel, shown next to the pet on demand.
let avatarHistoryWindow: BrowserWindow | null = null;
let avatarHistoryReady = false;
let avatarHistoryOpen = false;
let avatarHistoryCardSize = { width: 0, height: 0 };
// Matches the padding of .avatar-history-view.
const AVATAR_HISTORY_PADDING = 24;
// Whether Coco is being dragged; a drag ends this long after its last move.
let avatarDragging = false;
let avatarDragEndTimer: ReturnType<typeof setTimeout> | null = null;
const AVATAR_DRAG_END_MS = 150;
let chatWindow: BrowserWindow | null = null;
let imagePreviewWindow: BrowserWindow | null = null;
let imagePreviewDataUrl: string | null = null;
let imagePreviewEditable = false;
let imagePreviewSourceWindow: BrowserWindow | null = null;
let imagePreviewAnnotationResult: 'replace' | 'attach' = 'replace';
let imagePreviewFullScreenOverlay = false;
let hotkeyCaptureInProgress = false;
let htmlPreviewWindow: BrowserWindow | null = null;
let htmlPreviewDocument: string | null = null;
let gettingStartedAwaitingHtml: { articleId: string; participantId: string } | null = null;
let gettingStartedChatInviteArticleId: string | null = null;
let wakeWordCaptureWindow: BrowserWindow | null = null;
let nextDaySummaryScheduler: NextDaySummaryScheduler | null = null;
let latestHiddenSuggestionObservationId: string | undefined;
let authWindow: BrowserWindow | null = null;
let onboardingWindow: BrowserWindow | null = null;
let sessionRecapWindow: BrowserWindow | null = null;
let sessionRecapContext: {
  sessionId: string | null;
  userId: string | null;
} | null = null;
let tray: Tray | null = null;
let hideAvatarMode = false;
// The open Activity panel rereads the history file whenever it changes.
const notifyActivityChanged = () => {
  if (
    avatarHistoryOpen &&
    avatarHistoryWindow &&
    !avatarHistoryWindow.isDestroyed()
  ) {
    avatarHistoryWindow.webContents.send('activity-history-changed');
  }
};
const appendActivity: typeof storeAppendActivity = (...args) => {
  storeAppendActivity(...args);
  notifyActivityChanged();
};
const recordSupportEngagement: typeof storeRecordSupportEngagement = (
  ...args
) => {
  storeRecordSupportEngagement(...args);
  notifyActivityChanged();
};
const recordSupportRating: typeof storeRecordSupportRating = (...args) => {
  storeRecordSupportRating(...args);
  notifyActivityChanged();
};
const recordSupportSuggestion: typeof storeRecordSupportSuggestion = (
  ...args
) => {
  storeRecordSupportSuggestion(...args);
  notifyActivityChanged();
};
let cocoSleeping = false;
let postAssessmentActive = false;
const observationSleepGuard = new ObservationSleepGuard();
let wakeWordService: WakeWordService | null = null;
let wakeWordEnabled = false;
let wakeWordStatus: WakeWordStatusEvent = { status: 'disabled' };
let systemSuspended = false;
let wakeWordCapturePaused = false;
let wakeWordCapturePauseTimer: ReturnType<typeof setTimeout> | null = null;
let wakeWordCaptureState = 'stopped';
let wakeWordDetectionSequence = 0;
let pendingWakeWordDetection: {
  id: number;
  keyword: string;
  attempts: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
} | null = null;

const WAKE_WORDS = ['COCO', 'HI COCO', 'HEY COCO'] as const;
const WAKE_WORD_MODEL = 'sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01';

const isObservationPaused = () => cocoSleeping || !tutoringAllowed;
const setPostAssessmentActive = (active: boolean) => {
  if (postAssessmentActive === active) return;
  postAssessmentActive = active;
  log.info(
    `[Post-assessment] Proactive suggestions ${active ? 'disabled' : 'enabled'}`,
  );
  if (active) {
    latestHiddenSuggestionObservationId = undefined;
    proactive.setSuggestionOpen(false);
    proactive.dismissNotification();
    clearAvatarInvite('ignored');
  }
  avatarWindow?.webContents.send('post-assessment-proactive-suppression', {
    active,
  });
};
let tutoringAllowed = false;
let studyPolicyAllowsTutoring = false;
let serverPreAssessmentsComplete = false;
let currentStudyRole: StudyState['role'] | null = null;
let adminStudentMode = false;
let studyAccessStatus:
  | 'checking'
  | 'allowed'
  | 'preassessment'
  | 'disabled'
  | 'unavailable' = 'checking';
process.env.COCO_TUTORING_ALLOWED = '0';

const isStudentExperienceActive = () =>
  currentStudyRole === 'participant' || adminStudentMode;

const areRequiredPreAssessmentsComplete = () =>
  !isAuthenticated ||
  !isStudentExperienceActive() ||
  serverPreAssessmentsComplete;

const wakeWordSettingsPath = () =>
  path.join(app.getPath('userData'), 'wake-word.json');

const readWakeWordEnabled = (): boolean => {
  const settingsPath = wakeWordSettingsPath();
  try {
    const enabled =
      JSON.parse(fs.readFileSync(settingsPath, 'utf8'))?.enabled === true;
    log.info(`[Wake word] Loaded enabled=${enabled} from ${settingsPath}`);
    return enabled;
  } catch (error) {
    log.info(
      `[Wake word] No saved setting at ${settingsPath}; defaulting disabled (${(error as Error).message})`,
    );
    return false;
  }
};

const saveWakeWordEnabled = (enabled: boolean): void => {
  fs.writeFileSync(
    wakeWordSettingsPath(),
    `${JSON.stringify({ enabled }, null, 2)}\n`,
    'utf8',
  );
};

const publishWakeWordStatus = (status: WakeWordStatusEvent): void => {
  wakeWordStatus = status;
  chatWindow?.webContents.send('wake-word-status', status);
  if (status.detail) log.warn(`[Wake word] ${status.status}: ${status.detail}`);
  else log.info(`[Wake word] ${status.status}`);
};

const setWakeWordCapturePaused = (paused: boolean): void => {
  wakeWordCapturePaused = paused;
  if (wakeWordCapturePauseTimer) clearTimeout(wakeWordCapturePauseTimer);
  wakeWordCapturePauseTimer = null;
  wakeWordCaptureWindow?.webContents.send('wake-word-capture-paused-changed', {
    paused,
  });
  if (paused) {
    // Voice recording is capped at 30 seconds. Never leave activation paused
    // indefinitely if the chat renderer fails during the handoff.
    wakeWordCapturePauseTimer = setTimeout(() => {
      setWakeWordCapturePaused(false);
    }, 45_000);
  }
};

// Hot-key screen captures (Cmd/Ctrl+Shift+Space) waiting to be shown as preview
// thumbnails in the chat input bar. When the hot key opens a fresh chat window,
// the capture can arrive before the renderer has mounted its IPC listener, so we
// buffer here and flush once the renderer announces it is ready.
let pendingHotkeyCaptures: string[] = [];
let hotkeyRendererReady = false;

// Deliver any buffered hot-key captures to the chat renderer. No-op until the
// renderer has signalled readiness — that handshake is what makes delivery
// race-free regardless of whether the window was already open.
const flushHotkeyCaptures = () => {
  if (!hotkeyRendererReady) return;
  if (!chatWindow || chatWindow.isDestroyed()) return;
  if (pendingHotkeyCaptures.length === 0) return;
  const toSend = pendingHotkeyCaptures;
  pendingHotkeyCaptures = [];
  toSend.forEach((imageDataUrl) => {
    chatWindow?.webContents.send('hotkey-capture', { imageDataUrl });
  });
};

// True once the Python services have been started. Guards against double-start
// and lets us defer startup until the user has chosen their models.
let observerStarted = false;
// isFloatMode: chat panel is in narrow side-panel mode (vs. expanded width).
let isFloatMode = false;
// Set true once the app is genuinely quitting so window 'close' handlers stop
// intercepting (they otherwise hide-instead-of-close, which would block quit).
let isQuitting = false;

// ── User profile ──────────────────────────────────────────────────────────────
const profilePath = () =>
  path.join(app.getPath('userData'), 'coco-profile.json');

const isOnboardingComplete = (): boolean => {
  try {
    const raw = fs.readFileSync(profilePath(), 'utf-8');
    const profile = JSON.parse(raw);
    return (
      profile?.onboardingComplete === true &&
      Boolean(currentUserId) &&
      profile?.participantId === currentUserId &&
      (!app.isPackaged ||
        profile?.onboardingVersion === PACKAGED_ONBOARDING_VERSION)
    );
  } catch {
    return false;
  }
};

const readHideAvatarSetting = (): boolean => {
  try {
    const profile = JSON.parse(fs.readFileSync(profilePath(), 'utf-8'));
    return profile?.hideAvatar === true;
  } catch {
    return false;
  }
};

// ── Proactive session state ───────────────────────────────────────────────────
let isSessionActive = false;
// Seed local event records from legacy environment configuration until a
// verified Gateway account establishes the authenticated Participant ID.
let currentUserId = process.env.COCO_GATEWAY_USER_ID?.trim() || null;
let isAuthenticated = false;
let pendingAuthLaunch: 'signin' | 'signup' | null = null;
let currentSessionId: string | null = null;
// A saved conversation reopened as the current chat. Its tutor context is
// rebuilt on the user's first new turn rather than when the chat merely opens.
let resumableSessionId: string | null = null;
// Tutor replies still streaming, so a reopened chat can tell a reply that is
// still coming from one that was cut off.
const activeChatRequests = new Set<string>();
const readConversations = () =>
  readStoredConversations((requestId) => activeChatRequests.has(requestId));
const chatStreams = new ChatStreamStore();
let pendingTaskLabel: string | null = null;
// The struggle time chosen for the current session. Re-sent whenever sensing
// is reconfigured mid-session so a settings change can't reset it.
let sessionStruggleSeconds = 120;
let gatewayClient: CocoGatewayClient | null = null;

// User messages, tutor replies, and shown suggestions. Each one pushes the
// Judge's next check a full struggle interval out.
const interactions = new InteractionTracker((source) => {
  const sensingPort = process.env.SENSING_PORT || '8080';
  axios
    .post(
      `http://127.0.0.1:${sensingPort}/interaction`,
      { source },
      { timeout: 3000 },
    )
    .catch((err) => {
      log.warn(`[Interaction] failed to post: ${(err as Error).message}`);
    });
});

// Wrap a chat IPC handler so its turn is tracked as an interaction.
const agentRuns = new AgentRuns(() => new PiHarness(workspacePermissions()));
const proactive = createProactiveNotifications({
  ipc: ipcMain,
  gateway: () => gatewayClient,
  avatar: () => avatarWindow,
  recapOpen: () =>
    Boolean(sessionRecapWindow && !sessionRecapWindow.isDestroyed()),
  allowed: () => tutoringAllowed,
  sleeping: () => cocoSleeping,
  assessmentActive: () => postAssessmentActive,
  suspended: () => systemSuspended,
  avatarHidden: () => hideAvatarMode,
  sessionActive: () => isSessionActive,
  sessionId: () => currentSessionId,
  taskLabel: () => pendingTaskLabel,
  setTaskLabel: (label) => {
    pendingTaskLabel = label;
  },
  clearHiddenSuggestion: () => {
    latestHiddenSuggestionObservationId = undefined;
  },
  preload: () => preloadPath(),
  profile: () => readProfile(),
  precompute: (event) => precomputeSuggestion(event),
  availableTools: (id) => buildAvailableTools(id),
  openChat: (sessionId, label, seed) =>
    openChatForSession(sessionId, label, seed),
  startSession: (...args) => createProactiveTutorSession(...args),
});
const { showNotification, showSessionInvite, clearAvatarInvite } = proactive;
app.on('before-quit', () => proactive.dispose());

registerSocialIpcHandlers(ipcMain, new SocialService(() => gatewayClient));
const { openTraining, showPreAssessmentLockedMessage } = registerTrainingPanel({
  ipc: ipcMain,
  dialog,
  root: () => app.getPath('userData'),
  user: () => currentUserId,
  authenticated: () => isAuthenticated,
  gateway: () => gatewayClient,
  access: () => ({ tutoring_allowed: tutoringAllowed, status: studyAccessStatus }),
  refreshAccess: () => refreshTutoringAccess(),
  refreshTray: () => createTray(),
  showPanel: () => {
    if (!isOnboardingComplete()) {
      if (!onboardingWindow || onboardingWindow.isDestroyed()) createOnboardingWindow();
      else { onboardingWindow.show(); onboardingWindow.focus(); }
      return;
    }
    isFloatMode = false;
    showChatPanel({ expanded: true });
    sendToChat('open-training-panel', null);
  },
  postAssessmentChanged: setPostAssessmentActive,
});
ipcMain.handle('study-student-mode', async (_event, enabled?: unknown) => {
  const available =
    currentStudyRole === 'admin' || currentStudyRole === 'super_admin';
  if (typeof enabled === 'boolean') {
    if (!available) throw new Error('Administrator access required.');
    const wasAllowed = tutoringAllowed;
    adminStudentMode = enabled;
    applyEffectiveStudyAccess();
    if (!tutoringAllowed) {
      await stopTutoringForAccess();
    } else if (!wasAllowed) {
      try {
        await configureParticipantRouterCredential();
        if (!cocoSleeping && isOnboardingComplete()) startObserver();
      } catch (error) {
        void agentRuns.abort();
        studyAccessStatus = 'unavailable';
        setTutoringAllowed(false);
        await stopTutoringForAccess();
        throw error;
      }
    }
    createTray();
  }
  return { available, enabled: available && adminStudentMode };
});
ipcMain.on('getting-started-guide', (event, payload: { articleId?: unknown; phase?: unknown } = {}) => {
  if (!isAuthenticated || event.sender !== chatWindow?.webContents) return;
  const articleId = typeof payload.articleId === 'string' && getGettingStartedArticle(payload.articleId)
    ? payload.articleId : null;
  if (payload.phase === 'intro') {
    gettingStartedAwaitingHtml = null;
    gettingStartedChatInviteArticleId = null;
    sendToChat('getting-started-chat-invite', { articleId: null });
  }
  const newAvatar = !avatarWindow || avatarWindow.isDestroyed();
  if (newAvatar) createAvatarWindow();
  avatarWindow?.show();
  const allowedPhases = new Set(['intro', 'reading', 'first', 'first-done', 'create']);
  const phase = typeof payload.phase === 'string' && allowedPhases.has(payload.phase) && (payload.phase === 'intro' || articleId)
    ? payload.phase : 'intro';
  const sendGuide = () => avatarWindow?.webContents.send('getting-started-guide', { articleId, phase });
  if (newAvatar || avatarWindow?.webContents.isLoadingMainFrame()) {
    avatarWindow?.webContents.once('did-finish-load', () => setTimeout(sendGuide, CHAT_RENDERER_READY_DELAY_MS));
  } else sendGuide();
});

ipcMain.on('getting-started-chat-invite', (event, payload: { articleId?: unknown } = {}) => {
  if (!isAuthenticated || event.sender !== avatarWindow?.webContents) return;
  const articleId = payload.articleId;
  if (typeof articleId !== 'string' || !getGettingStartedArticle(articleId)) return;
  gettingStartedChatInviteArticleId = articleId;
  sendToChat('getting-started-chat-invite', { articleId });
});

ipcMain.on('getting-started-open-article', (event) => {
  if (!isAuthenticated || event.sender !== avatarWindow?.webContents) return;
  openTraining();
  sendToChat('getting-started-open-article', null);
});

ipcMain.on('getting-started-open-chat', (event, payload: { articleId?: unknown; phase?: unknown } = {}) => {
  const fromAvatar = event.sender === avatarWindow?.webContents;
  const fromChat = event.sender === chatWindow?.webContents;
  if (!isAuthenticated || (!fromAvatar && !fromChat)) return;
  if (typeof payload.articleId !== 'string' || !getGettingStartedArticle(payload.articleId)) return;
  if (fromChat && (payload.phase !== 'chat' || gettingStartedChatInviteArticleId !== payload.articleId)) return;
  if (payload.phase === 'chat') {
    gettingStartedChatInviteArticleId = null;
    sendToChat('getting-started-chat-invite', { articleId: null });
    if (fromChat) avatarWindow?.webContents.send('getting-started-guide', { articleId: payload.articleId, phase: 'first' });
  }
  if (payload.phase === 'create' && currentUserId) gettingStartedAwaitingHtml = { articleId: payload.articleId, participantId: currentUserId };
  void openCoco().catch((error) => log.warn(`[Getting Started] Could not open Chat: ${String(error)}`));
});

ipcMain.on('getting-started-guide-dismiss', (event) => {
  if (event.sender === avatarWindow?.webContents && readHideAvatarSetting()) avatarWindow?.hide();
});

const gettingStartedStatusPath = () => path.join(
  app.getPath('userData'),
  `getting-started-${encodeURIComponent(currentUserId ?? '')}.json`,
);
function markGettingStartedComplete(user: string) {
  fs.writeFileSync(gettingStartedStatusPath(), JSON.stringify({
    participantId: user, completedAt: new Date().toISOString(), activity: 'agent-game',
  }), 'utf8');
  sendToChat('getting-started-complete', { activity: 'agent-game' });
}
ipcMain.handle('getting-started-status', () => {
  if (!isAuthenticated || !currentUserId) return { complete: false };
  if (runnerTutorial.state(currentUserId)?.tour === 'finished') return { complete: true };
  try {
    const saved = JSON.parse(fs.readFileSync(gettingStartedStatusPath(), 'utf-8'));
    return { complete: saved?.participantId === currentUserId && saved?.activity === 'agent-game' && Boolean(saved?.completedAt) };
  } catch { return { complete: false }; }
});

ipcMain.handle('get-coco-mascot-data-url', (event) => {
  if (!isAuthenticated || event.sender !== htmlPreviewWindow?.webContents) return null;
  const assetPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'pet1.png')
    : path.join(app.getAppPath(), 'assets', 'pet1.png');
  try {
    return `data:image/png;base64,${fs.readFileSync(assetPath).toString('base64')}`;
  } catch (error) {
    log.warn(`[HTML Preview] Could not load Coco mascot: ${String(error)}`);
    return null;
  }
});

ipcMain.handle('save-html-preview', async (event, payload: { html?: unknown } = {}) => {
  if (!isAuthenticated || event.sender !== htmlPreviewWindow?.webContents) return { success: false, error: 'Unavailable.' };
  if (typeof payload.html !== 'string' || payload.html.length > 2_000_000 || !/^<!doctype html>/i.test(payload.html.trim())) {
    return { success: false, error: 'Invalid HTML page.' };
  }
  const result = await dialog.showSaveDialog(htmlPreviewWindow!, {
    title: 'Save HTML page',
    defaultPath: 'coco-page.html',
    filters: [{ name: 'HTML page', extensions: ['html'] }],
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  try {
    fs.writeFileSync(result.filePath, payload.html, 'utf-8');
    if (currentUserId && gettingStartedAwaitingHtml?.participantId === currentUserId) {
      try {
        fs.writeFileSync(gettingStartedStatusPath(), JSON.stringify({
          participantId: currentUserId,
          articleId: gettingStartedAwaitingHtml.articleId,
          completedAt: new Date().toISOString(),
        }), 'utf-8');
        sendToChat('getting-started-complete', { articleId: gettingStartedAwaitingHtml.articleId });
        gettingStartedAwaitingHtml = null;
      } catch (error) {
        log.warn(`[Getting Started] Could not record completion: ${String(error)}`);
      }
    }
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

let currentTutorModelId: string | null = null;
const piBridgeToken = randomUUID();

let activeRunnerGuide: RunnerGuide | null = null;
let runnerChatView = { sessionId: null as string | null, inChat: false };
let lastRunnerGuidePresentation: string | null = null;
let runnerGuideRendererReady = false;
function showRunnerGuide(user: string, guide: RunnerGuide) {
  if (guide.sessionId !== setupGuideSession && guide.label === 'LET’S PLAY' &&
      runnerTutorial.state(user)?.starterBuild !== 'ready') return;
  // In-chat onboarding speaks through the transcript. Keep only the deliberate
  // proactive-tip demonstration while the user is playing.
  if (guide.sessionId !== setupGuideSession && guide.label !== 'LET’S PLAY' && !guide.framework &&
      runnerChatView.inChat && runnerChatView.sessionId === guide.sessionId && chatWindow?.isVisible()) return;
  if (user !== currentUserId || !isAuthenticated || onboardingWindow?.isVisible()) return;
  activeRunnerGuide = guide;
  if (!avatarWindow || avatarWindow.isDestroyed()) createAvatarWindow();
  // A teaching bubble must not steal focus or minimize the user's chat/game.
  avatarWindow?.showInactive();
  publishRunnerGuide();
}
function publishRunnerGuide(force = false) {
  if (!activeRunnerGuide || !isAuthenticated || !runnerGuideRendererReady || !avatarWindow || avatarWindow.isDestroyed()) return;
  const guide = presentRunnerGuide(activeRunnerGuide, {
    ...runnerChatView,
    visible: Boolean(chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible() && !chatWindow.isMinimized()),
    focused: Boolean(chatWindow && !chatWindow.isDestroyed() && chatWindow.isFocused()),
  });
  const presentation = JSON.stringify(guide);
  if (!force && presentation === lastRunnerGuidePresentation) return;
  lastRunnerGuidePresentation = presentation;
  avatarWindow.webContents.send('runner-guide', guide);
}
ipcMain.on('runner-chat-view', (event, value: unknown) => {
  if (event.sender !== chatWindow?.webContents || !value || typeof value !== 'object') return;
  const view = value as { sessionId?: unknown; inChat?: unknown };
  if ((view.sessionId !== null && typeof view.sessionId !== 'string') || typeof view.inChat !== 'boolean') return;
  runnerChatView = { sessionId: view.sessionId, inChat: view.inChat };
  publishRunnerGuide();
});
ipcMain.on('runner-guide-ready', event => {
  if (event.sender !== avatarWindow?.webContents) return;
  runnerGuideRendererReady = true;
  if (activeRunnerGuide) {
    avatarWindow?.showInactive();
    publishRunnerGuide(true);
  }
});
const runnerTurnOwners = new Map<string, string>();
const runnerTutorial = new RunnerTutorial({
  dataDir: app.getPath('userData'),
  node: process.execPath,
  validate: validateGameInBrowser,
  captureArt: captureCharacterArt,
  designArt: (sessionId, request, theme, evidence) => designCharacter(`http://127.0.0.1:${process.env.TUTOR_PORT || '8081'}`, piBridgeToken, sessionId, request, theme, evidence),
  reviewArt: (sessionId, request, evidence) => reviewCharacterArt(`http://127.0.0.1:${process.env.TUTOR_PORT || '8081'}`, piBridgeToken, sessionId, request, evidence),
  guide: showRunnerGuide,
  changed: (user, state) => {
    if (user !== currentUserId || !isAuthenticated) return;
    void axios.post(`http://127.0.0.1:${process.env.TUTOR_PORT || '8081'}/agent/tutorial-status`, { sessionId: state.sessionId, phase: state.phase, failure: state.failure ?? null }, { headers: { Authorization: `Bearer ${piBridgeToken}` }, timeout: 3000 }).catch(error => log.warn('[Runner] Could not update coaching context:', String(error)));
    chatWindow?.webContents.send('runner-state-changed', state);
  },
});
function requireRunnerSender(
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
) {
  if (
    !isAuthenticated ||
    !currentUserId ||
    !tutoringAllowed ||
    ![
      chatWindow?.webContents,
      avatarWindow?.webContents,
    ].includes(event.sender)
  )
    throw new Error('Open Coco and sign in to play.');
  return currentUserId;
}
// Keep every game action in its chat conversation, including updated previews.
function openRunnerInChat() {
  if (currentUserId) focusRunnerComposer(currentUserId);
}
function focusRunnerComposer(user: string, animateGreeting = false) {
  const state = runnerTutorial.state(user);
  if (!state) return;
  const sameSession = currentSessionId === state.sessionId;
  if (!sameSession) {
    const saved = readConversations().find(
      (item) => item.sessionId === state.sessionId,
    );
    currentSessionId = state.sessionId;
    currentTutorModelId =
      saved?.tutorModelId ?? readModelConfiguration()?.defaultTutorId ?? null;
    isSessionActive = false;
    resumableSessionId = saved?.messages.length ? state.sessionId : null;
    pendingTaskLabel = 'Make your own game with Coco';
  }
  openChatForSession(
    state.sessionId,
    'Make your own game with Coco',
    undefined,
    sameSession,
  );
  // The renderer's initial state request can precede restored authentication.
  // Re-send the authorized state on every tutorial resume/focus so retry and
  // publish status cannot disappear after reopening the app.
  sendToChat('runner-state-changed', state);
  sendToChat('runner-focus-composer', { sessionId: state.sessionId, animateGreeting });
}
// Setup teaches Coco's desktop behavior; the game is an optional Training task.
let welcomedUser: string | null = null;
const setupGuideSession = 'coco-setup';
let pendingTrainingWelcome: string | null = null;
let trainingPanelVisible = false;
function clearSetupGuide() {
  if (activeRunnerGuide?.sessionId !== setupGuideSession) return;
  activeRunnerGuide = null;
  lastRunnerGuidePresentation = null;
  avatarWindow?.webContents.send('runner-guide', null);
  if (!isOnboardingComplete() || readHideAvatarSetting()) avatarWindow?.hide();
}
function showTrainingWelcome() {
  if (!pendingTrainingWelcome || pendingTrainingWelcome !== currentUserId || !trainingPanelVisible || !chatWindow?.isVisible() || onboardingWindow?.isVisible() || !isOnboardingComplete()) return;
  const user = pendingTrainingWelcome;
  pendingTrainingWelcome = null;
  applyAvatarVisibility(readHideAvatarSetting());
  showRunnerGuide(user, {
    sessionId: setupGuideSession, label: 'WELCOME TO COCO',
    text: 'Let me walk you through what you can do with Coco!',
    action: 'open-training', actionLabel: 'Getting Started',
  });
}
ipcMain.on('training-panel-visible', (event, visible: unknown) => {
  if (event.sender !== chatWindow?.webContents || typeof visible !== 'boolean') return;
  trainingPanelVisible = visible;
  showTrainingWelcome();
});
function welcomeToCoco() {
  if (!isAuthenticated || !currentUserId || !isOnboardingComplete() || welcomedUser === currentUserId) return;
  welcomedUser = currentUserId;
  pendingTrainingWelcome = currentUserId;
  openTraining();
  showTrainingWelcome();
}
function openAfterSetup() {
  clearSetupGuide();
  welcomeToCoco();
}
ipcMain.on('onboarding-step', (event) => {
  if (event.sender !== onboardingWindow?.webContents) return;
  clearSetupGuide();
  avatarWindow?.hide();
});
ipcMain.handle('runner-start', (event) => {
  const user = requireRunnerSender(event);
  const state = runnerTutorial.startTour(user);
  if (state.tour !== 'meet' || state.workspaceDirectory)
    saveConversationDirectory(state.sessionId, runnerTutorial.workspace(user, state.sessionId)!);
  focusRunnerComposer(user, state.tour === 'meet');
  return { state };
});
ipcMain.handle('runner-state', (event) =>
  runnerTutorial.state(requireRunnerSender(event)),
);
ipcMain.handle('runner-preview', (event) =>
  runnerTutorial.preview(requireRunnerSender(event)),
);
ipcMain.on(
  'runner-draft',
  (event, payload: { sessionId?: unknown; draft?: unknown } = {}) => {
    if (
      !isAuthenticated ||
      !currentUserId ||
      !tutoringAllowed ||
      event.sender !== chatWindow?.webContents
    )
      return;
    const user = currentUserId;
    if (
      typeof payload.sessionId !== 'string' ||
      typeof payload.draft !== 'string' ||
      payload.draft.length > 10000
    )
      return;
    runnerTutorial.coach(user, payload.sessionId, payload.draft);
  },
);
ipcMain.handle(
  'runner-action',
  async (
    event,
    payload: {
      sessionId?: unknown;
      action?: RunnerAction | 'game-over' | 'undo' | 'open-game' | 'new-game';
      score?: unknown;
      version?: unknown;
    } = {},
  ) => {
    if (payload.sessionId === setupGuideSession) {
      if (!isAuthenticated || !currentUserId || event.sender !== avatarWindow?.webContents)
        return { error: 'Open Coco and sign in first.' };
      if (payload.action === 'open-training' && isOnboardingComplete()) {
        clearSetupGuide();
        openTraining();
        sendToChat('getting-started-open-article', null);
      } else if (payload.action === 'dismiss') clearSetupGuide();
      return {};
    }
    const user = requireRunnerSender(event),
      state = runnerTutorial.state(user);
    if (!state || payload.sessionId !== state.sessionId)
      return { error: 'This game is no longer active.' };
    if (payload.action === 'open-training') {
      openTraining();
      sendToChat('open-training-panel', { highlight: 'agent101' });
      return { state };
    }
    if (payload.action === 'idea-check-suggestion') {
      if (runnerChatView.inChat && runnerChatView.sessionId === state.sessionId && chatWindow?.isVisible())
        runnerTutorial.suggestIdeaCheck(user);
      return { state: runnerTutorial.state(user) };
    }
    if (payload.action === 'game-suggestion') {
      if (runnerChatView.inChat && runnerChatView.sessionId === state.sessionId && chatWindow?.isVisible())
        runnerTutorial.suggestGameReview(user);
      return { state: runnerTutorial.state(user) };
    }
    if (payload.action === 'request-build') {
      runnerTutorial.requestStarterBuild(user);
      const next = await runnerTutorial.buildRequestedStarter(user);
      if (user === currentUserId && next?.workspaceDirectory && next.starterBuild === 'ready') {
        saveConversationDirectory(state.sessionId, next.workspaceDirectory);
        sendToChat('runner-state-changed', next);
      }
      return { state: next };
    }
    if (payload.action && ['tour-play', 'why-tips', 'explain-buttons', 'skip-tour', 'finish-setup'].includes(payload.action)) {
      if (payload.action === 'skip-tour' && state.phase === 'building') {
        for (const [id, request] of agentRuns.requests) {
          if (request.sessionId === state.sessionId) await agentRuns.abort(id);
        }
        await runnerTutorial.finish(user, state.sessionId, false, 'The tour was skipped before this change finished.');
      }
      const next = runnerTutorial.tourAction(user, payload.action as 'tour-play' | 'why-tips' | 'explain-buttons' | 'skip-tour' | 'finish-setup');
      if (payload.action === 'finish-setup') markGettingStartedComplete(user);
      if (payload.action === 'skip-tour' || payload.action === 'finish-setup') {
        activeRunnerGuide = null;
        lastRunnerGuidePresentation = null;
        avatarWindow?.webContents.send('runner-guide', null);
        if (readHideAvatarSetting()) avatarWindow?.hide();
        if (payload.action === 'finish-setup') sendToChat('open-training-panel', { onboardingComplete: true, sessionId: state.sessionId });
        else openTraining();
      }
      return { state: next };
    }
    if (payload.action === 'new-game') { if(agentRuns.busy)return {error:'Wait for Coco to finish.'};return {state:runnerTutorial.newGame(user)}; }
    if (payload.action === 'game-over') {
      if (typeof payload.version === 'string')
        runnerTutorial.recordScore(
          user,
          state.sessionId,
          payload.version,
          payload.score,
        );
      runnerTutorial.firstGameOver(user);
    }
    if (payload.action === 'customize') {
      if (state.tour === 'active' && !state.firstGameOver && !state.hasChanges)
        return { error: 'Play a round first. Make it yours unlocks after your first game over.' };
      if (agentRuns.busy)
        return { error: 'Wait for Coco to finish the current task.' };
      runnerTutorial.writing(user);
      const existing = readConversations().find(item => item.sessionId === state.sessionId);
      const directory = runnerTutorial.workspace(user, state.sessionId)!;
      if (!existing) {
        // This seeded conversation is resumed on Send. Register it now so its
        // first real messages have an owned server session to attach to.
        if (gatewayClient) {
          try {
            await gatewayClient.requestJson('/api/storage/sessions', 'POST', {
              _id: state.sessionId, user_id: user,
              started_at: new Date().toISOString(), start_trigger: 'user_message',
              start_message: 'Make your own game with Coco',
            }, 8000);
          } catch (error) {
            log.warn('[Runner] Could not register game conversation:', String(error));
            return { error: 'Your game is safe, but Coco couldn’t connect this chat to your account. Please try Make it yours again.' };
          }
        }
        if (user !== currentUserId) return { error: 'Your account changed. Reopen Coco to continue.' };
        saveConversation({
        sessionId: state.sessionId,
        problem: 'Make your own game with Coco',
        messages: [{role:'tutor',text:'What do you want to change about your game?',id:'runner-intro',ts:Date.now()}],
        tutorModelId: readModelConfiguration()?.defaultTutorId ?? null,
      });
      }
      saveConversationDirectory(state.sessionId, directory);
      focusRunnerComposer(user);
      sendToChat('runner-open-composer', { sessionId: state.sessionId, reset: !existing });
    }
    if (payload.action === 'open-game') openRunnerInChat();
    if (payload.action === 'undo') {
      if (agentRuns.has(state.sessionId))
        return { error: 'Wait for Coco to finish before undoing.' };
      runnerTutorial.undo(user);
    }
    if (payload.action === 'play' || (payload.action === 'focus' && state.phase === 'play')) {
      chatWindow?.show();
      openRunnerInChat();
      runnerTutorial.playing(user);
    } else if (payload.action === 'focus' || payload.action === 'retry') {
      focusRunnerComposer(user);
      if(payload.action==='retry'&&state.lastRequest)sendToChat('runner-retry-request',{sessionId:state.sessionId,text:state.lastRequest});
    }
    if (payload.action === 'finish') {
      if (state.phase === 'complete') {
        markGettingStartedComplete(user);
        openTraining();
        activeRunnerGuide = null;
        avatarWindow?.webContents.send('runner-guide', null);
        if (readHideAvatarSetting()) avatarWindow?.hide();
      } else {
        runnerTutorial.complete(user);
        openRunnerInChat();
      }
    }
    if (payload.action === 'dismiss') {
      activeRunnerGuide = null;
      lastRunnerGuidePresentation = null;
      avatarWindow?.webContents.send('runner-guide', null);
      if (readHideAvatarSetting()) avatarWindow?.hide();
    }
    return { state: runnerTutorial.state(user) };
  },
);

function agentDirectory(sessionId: string | null = currentSessionId): string {
  const conversation = sessionId
    ? readConversations().find((item) => item.sessionId === sessionId)
    : undefined;
  if (conversation?.workingDirectory) return conversation.workingDirectory;
  const directory = path.join(app.getPath('userData'), 'workspace');
  fs.mkdirSync(directory, { recursive: true });
  if (sessionId) saveConversationDirectory(sessionId, directory);
  return directory;
}

function executionContext(
  sessionId: string,
  userText?: string,
): SessionContextInput {
  const conversation = readConversations().find(
    (item) => item.sessionId === sessionId,
  );
  const profile = readProfile();
  const config = readModelConfiguration();
  const selectedId =
    sessionId === currentSessionId
      ? currentTutorModelId
      : conversation?.tutorModelId;
  const selected =
    config?.tutors.find((model) => model.id === selectedId) ??
    (config ? defaultTutor(config) : null);
  if (!selected) throw new Error('Choose a model before running Coco.');
  return {
    model: selected.model,
    scenario: profile.scenario,
    problem:
      conversation?.problem ||
      (sessionId === currentSessionId ? pendingTaskLabel : '') ||
      '',
    user_name: profile.userName,
    ai_tools: profile.aiTools,
    memory: readLocalMemory(),
    messages: restorableMessages(conversation?.messages ?? [], userText),
  };
}

function workspacePermissions() {
  const user = currentUserId;
  if (!user || !isAuthenticated) throw new Error('Sign in to manage permissions.');
  return new WorkspacePermissions(app.getPath('userData'), user, () => {
    if (currentUserId !== user || !isAuthenticated) throw new Error('Your account changed.');
  });
}

function commandApprovalRules() {
  const user = currentUserId;
  if (!user || !isAuthenticated) throw new Error('Sign in to manage permissions.');
  return new CommandApprovalRules(app.getPath('userData'), user, () => {
    if (currentUserId !== user || !isAuthenticated) throw new Error('Your account changed.');
  });
}
for (const channel of ['list-command-approvals', 'revoke-command-approval', 'revoke-file-approval']) {
  ipcMain.handle(channel, (event, sessionId: string | null, ruleId?: string) => {
    if (!chatWindow || event.sender !== chatWindow.webContents) throw new Error('Open permissions from the chat window.');
    if (sessionId !== null && typeof sessionId !== 'string') throw new Error('Invalid conversation.');
    const rules = commandApprovalRules();
    const directory = agentDirectory(sessionId);
    if (channel === 'revoke-command-approval') {
      if (typeof ruleId !== 'string') throw new Error('Invalid permission rule.');
      rules.revoke(directory, ruleId);
    }
    if (channel === 'revoke-file-approval') {
      if (typeof ruleId !== 'string') throw new Error('Invalid permission rule.');
      const grant = workspacePermissions().list(directory).find(rule => rule.id === ruleId);
      if (grant?.kind !== 'path') throw new Error('Invalid file permission rule.');
      workspacePermissions().revoke(directory, ruleId);
    }
    return { directory, rules: rules.list(directory), fileRules: workspacePermissions().list(directory).filter(rule => rule.kind === 'path') };
  });
}

ipcMain.handle(
  'get-agent-workspace',
  (_event, { sessionId }: { sessionId?: string | null } = {}) => ({
    directory: agentDirectory(sessionId),
    accessGranted: Boolean(
      sessionId && ((currentUserId && runnerTutorial.owns(currentUserId,sessionId) && path.resolve(agentDirectory(sessionId))===path.resolve(runnerTutorial.workspace(currentUserId,sessionId)!)) || workspacePermissions().hasWorkspace(agentDirectory(sessionId))),
    ),
  }),
);
ipcMain.handle(
  'choose-agent-workspace',
  async (
    event,
    { sessionId = currentSessionId }: { sessionId?: string | null } = {},
  ) => {
    if (!isAuthenticated || event.sender !== chatWindow?.webContents) throw new Error('Choose a folder from Coco chat.');
    if (!sessionId)
      throw new Error('Open a conversation before choosing a folder.');
    if (agentRuns.has(sessionId))
      throw new Error('Stop the current run before changing folders.');
    const result = await dialog.showOpenDialog({
      title: 'Choose a folder for Coco to read and edit',
      defaultPath: agentDirectory(sessionId),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    if (agentRuns.has(sessionId))
      throw new Error('Stop the current run before changing folders.');
    const directory = fs.realpathSync(result.filePaths[0]);
    await agentRuns.release(sessionId);
    if (agentRuns.has(sessionId))
      throw new Error('Stop the current run before changing folders.');
    const tutorial = currentUserId ? runnerTutorial.state(currentUserId) : null;
    if (currentUserId && tutorial?.sessionId === sessionId && tutorial.tour === 'meet') {
      const user = currentUserId;
      runnerTutorial.selectStarterFolder(user, directory);
      saveConversationDirectory(sessionId, directory);
      // Folder selection and the build request may arrive in either order.
      const state = await runnerTutorial.buildRequestedStarter(user);
      if (user !== currentUserId) throw new Error('Your account changed. Reopen Coco to continue.');
      const workingDirectory = state?.starterBuild === 'ready' ? state.workspaceDirectory! : directory;
      saveConversationDirectory(sessionId, workingDirectory);
      sendToChat('runner-state-changed', state);
      return { directory: workingDirectory, accessGranted: state?.starterBuild === 'ready' || workspacePermissions().hasWorkspace(directory) };
    }
    saveConversationDirectory(sessionId, directory);
    contextTraining.workspaceSelected(sessionId, currentUserId, directory);
    return { directory, accessGranted: workspacePermissions().hasWorkspace(directory) };
  },
);
ipcMain.handle('revoke-agent-workspace', async (_event, sessionId: string) => {
  if (typeof sessionId !== 'string' || !sessionId)
    throw new Error('Open a conversation first.');
  if (agentRuns.has(sessionId))
    throw new Error('Stop the current run before revoking access.');
  const directory = agentDirectory(sessionId);
  workspacePermissions().revokeWorkspace(directory);
  await agentRuns.revokeWorkspace(directory);
  return { directory, accessGranted: false };
});
// Explain supplied text without starting an agent run or changing a conversation.
ipcMain.handle('explain-tool-command', async (_event, payload: unknown) => {
  const { tool, source } = (payload ?? {}) as {
    tool?: unknown;
    source?: unknown;
  };
  if (
    typeof tool !== 'string' ||
    !tool.trim() ||
    tool.length > 200 ||
    typeof source !== 'string' ||
    !source.trim() ||
    source.length > 10000
  ) {
    throw new Error('Invalid command explanation request.');
  }
  const tutorPort = process.env.TUTOR_PORT || '8081';
  const response = await axios.post(
    `http://127.0.0.1:${tutorPort}/explain-tool-command`,
    { tool, source },
    { timeout: 45_000 },
  );
  if (
    typeof response.data?.explanation !== 'string' ||
    !response.data.explanation.trim()
  ) {
    throw new Error('No explanation returned.');
  }
  return { explanation: response.data.explanation.trim() };
});

ipcMain.handle('get-agent-context', (_event, sessionId: string) =>
  typeof sessionId === 'string'
    ? agentRuns.get(sessionId).getContextSnapshot(sessionId)
    : null,
);
ipcMain.handle(
  'answer-agent-question',
  (_event, toolCallId: string, response: unknown, requestId: string) =>
    agentRuns.answer(requestId, toolCallId, response),
);
ipcMain.handle('stop-agent-run', (_event, requestId: string) => {
  return agentRuns.abort(requestId);
});
ipcMain.handle(
  'answer-agent-permission',
  (event, requestId: string, id: string, allow: unknown) => {
    if (!chatWindow || event.sender !== chatWindow.webContents)
      throw new Error('Permission decisions must come from the chat window.');
    return agentRuns.answerPermission(requestId, id, allow);
  },
);

const agent101 = createAgent101Controller({
  ipc: ipcMain,
  root: () => app.getPath('userData'),
  currentUser: () => currentUserId,
  authenticated: () => isAuthenticated,
  allowed: () => tutoringAllowed,
  isChatSender: (event) => event.sender === chatWindow?.webContents,
  canSkipPrerequisites: () =>
    !adminStudentMode &&
    (currentStudyRole === 'admin' || currentStudyRole === 'super_admin'),
  gateway: () => gatewayClient,
  models: readModelConfiguration,
  runs: agentRuns,
  activeRequests: activeChatRequests,
  interactions,
  directory: agentDirectory,
  token: piBridgeToken,
  approvalRules: commandApprovalRules,
  stream: (sender, payload) => sendChatStreamEvent(sender, payload),
  notify: (channel, payload) => sendToChat(channel, payload),
  reveal: (directory) => shell.openPath(directory),
  warn: (error) => log.warn('Agent 101 progress sync deferred:', error),
  conversations: {
    read: readConversations,
    save: saveConversation,
    saveDirectory: saveConversationDirectory,
    model: () => currentTutorModelId,
    open: (sessionId, label, restoreModel = false) => {
      if (restoreModel)
        currentTutorModelId =
          readConversations().find((saved) => saved.sessionId === sessionId)
            ?.tutorModelId ?? currentTutorModelId;
      currentSessionId = sessionId;
      isSessionActive = false;
      resumableSessionId = sessionId;
      pendingTaskLabel = label;
      openChatForSession(sessionId, label);
    },
  },
});
const {
  contextTraining,
  tokenTraining,
  modelTraining,
  workflowTraining,
  toolTraining,
} = agent101;
app.on('before-quit', () => agent101.dispose());

// Preserve the original Upskilling session invitation cadence even though the
// sensing-side Judge owns the decision itself.
const TASK_SUGGESTION_COOLDOWN_MS = 5 * 60_000;
let lastTaskSuggestionMs = 0;

const requestedPort = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
    ? parsed
    : fallback;
};

const canBindPort = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });

const findAvailablePort = async (
  preferred: number,
  excluded: Set<number>,
): Promise<number> => {
  if (!excluded.has(preferred) && (await canBindPort(preferred)))
    return preferred;
  for (let candidate = 49152; candidate <= 65535; candidate += 1) {
    if (!excluded.has(candidate) && (await canBindPort(candidate)))
      return candidate;
  }
  throw new Error('Coco could not find an available local service port.');
};

const configureLocalServicePorts = async (): Promise<void> => {
  const requestedSensingPort = requestedPort(process.env.SENSING_PORT, 8080);
  const requestedTutorPort = requestedPort(process.env.TUTOR_PORT, 8081);
  const selected = new Set<number>();
  const sensingPort = await findAvailablePort(requestedSensingPort, selected);
  selected.add(sensingPort);
  const tutorPort = await findAvailablePort(requestedTutorPort, selected);

  process.env.SENSING_PORT = String(sensingPort);
  process.env.TUTOR_PORT = String(tutorPort);
  serviceManager.configureServiceArg(
    'sensing-server',
    'port',
    String(sensingPort),
  );
  serviceManager.configureServiceArg('tutor-server', 'port', String(tutorPort));
  serviceManager.configureServiceArg(
    'sensing-server',
    'tutor_url',
    `http://127.0.0.1:${tutorPort}`,
  );
  const portEnv = {
    SENSING_PORT: String(sensingPort),
    TUTOR_PORT: String(tutorPort),
  };
  serviceManager.configureServiceEnv('sensing-server', portEnv);
  serviceManager.configureServiceEnv('tutor-server', {
    ...portEnv,
    COCO_PI_BRIDGE_TOKEN: piBridgeToken,
  });

  if (
    sensingPort !== requestedSensingPort ||
    tutorPort !== requestedTutorPort
  ) {
    log.warn(
      `[Ports] Requested sensing=${requestedSensingPort}, tutor=${requestedTutorPort}; ` +
        `using sensing=${sensingPort}, tutor=${tutorPort} because a port was occupied.`,
    );
  } else {
    log.info(`[Ports] sensing=${sensingPort}, tutor=${tutorPort}`);
  }
};

// Preload path helper
const preloadPath = () =>
  app.isPackaged
    ? path.join(__dirname, 'preload.js')
    : path.join(__dirname, '../../.erb/dll/preload.js');

// ── Authentication window ───────────────────────────────────────────────────
// Authentication is checked before models or sensing services start. This
// keeps all locally initiated Gateway writes tied to a verified participant.

const createAuthWindow = () => {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.show();
    authWindow.focus();
    return;
  }
  authWindow = new BrowserWindow({
    ...setupWindowOptions(screen.getPrimaryDisplay().workArea),
    webPreferences: { preload: preloadPath() },
  });
  authWindow.loadURL(`${resolveHtmlPath('index.html')}?view=auth`);
  authWindow.on('ready-to-show', () => authWindow?.show());
  authWindow.on('closed', () => {
    authWindow = null;
  });
  authWindow.on('close', (event) => {
    if (isQuitting || isAuthenticated) return;
    event.preventDefault();
    authWindow?.webContents.send('auth-quit-requested');
  });
};

ipcMain.on('quit-from-auth', (event) => {
  if (event.sender === authWindow?.webContents) app.quit();
});

ipcMain.on('quit-from-avatar', (event) => {
  if (event.sender === avatarWindow?.webContents) app.quit();
});

const readSystemPermissionWarning = () =>
  readPlatformPermissionWarning(process.platform, () => ({
    accessibilityTrusted: systemPreferences.isTrustedAccessibilityClient(false),
    screenCaptureStatus: systemPreferences.getMediaAccessStatus('screen'),
  }));

const readSystemPermissionHealth = () => {
  const warning = readSystemPermissionWarning();
  return {
    missing: (warning?.settingsTargets ?? []).map((target) => ({
      target,
      label: systemPermissionButtonLabel(target).replace(/^Open /, ''),
      actionLabel: systemPermissionButtonLabel(target),
      explanation: systemPermissionExplanation(target),
    })),
  };
};

ipcMain.handle('get-system-permissions', (event) => {
  if (
    event.sender !== chatWindow?.webContents &&
    event.sender !== onboardingWindow?.webContents
  )
    return { missing: [] };
  return readSystemPermissionHealth();
});
ipcMain.handle('open-system-permissions', async (event, target?: unknown) => {
  if (
    event.sender !== chatWindow?.webContents &&
    event.sender !== onboardingWindow?.webContents
  )
    return { success: false };
  const requestedTarget =
    target === 'accessibility' ||
    target === 'input-monitoring' ||
    target === 'screen-recording'
      ? target
      : undefined;
  try {
    await showSystemPermissionWarning(requestedTarget);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ── Onboarding window ─────────────────────────────────────────────────────────
// Shown once on first launch (when coco-profile.json doesn't exist yet).
// Centered modal; after the user completes or skips it, the profile is written
// and the normal avatar + webapp windows are created.

const createOnboardingWindow = (modelsOnly = false) => {
  clearSetupGuide();
  avatarWindow?.hide();
  onboardingWindow = new BrowserWindow({
    ...setupWindowOptions(screen.getPrimaryDisplay().workArea),
    webPreferences: { preload: preloadPath() },
  });

  const url = `${resolveHtmlPath('index.html')}?view=onboarding${
    modelsOnly ? '&modelsOnly=1' : ''
  }${isLlmRouterConfigured() ? '&routerManaged=1' : ''}`;
  onboardingWindow.loadURL(url);

  onboardingWindow.on('ready-to-show', () => {
    onboardingWindow?.show();
  });

  onboardingWindow.on('hide', clearSetupGuide);

  onboardingWindow.on('closed', () => {
    clearSetupGuide();
    onboardingWindow = null;
  });

  onboardingWindow.on('close', (event) => {
    if (isQuitting || (isOnboardingComplete() && (!modelsOnly || readModelConfiguration()))) {
      return;
    }
    event.preventDefault();
    onboardingWindow?.hide();
    createTray();
  });
};

// ── Avatar actions menu ───────────────────────────────────────────────────────
// The ••• menu lives in its own small transparent window. Growing the avatar
// window to fit it made macOS show that window blank or misplaced for a frame
// or two on every open. This window is sized and placed while hidden, and only
// becomes visible once its renderer has painted the menu.

const avatarMenuBounds = () => {
  if (!avatarWindow || avatarWindow.isDestroyed()) return null;
  const b = avatarWindow.getBounds();
  const { x, y, below } = placeAvatarMenu(
    {
      x: b.x + b.width - AVATAR_BASE_SIZE,
      y: b.y + b.height - AVATAR_BASE_SIZE,
    },
    avatarMenuSize,
    screen.getDisplayMatching(b).workArea,
  );
  return {
    below,
    bounds: {
      x: x - AVATAR_MENU_PADDING,
      y: y - AVATAR_MENU_PADDING,
      width: avatarMenuSize.width + AVATAR_MENU_PADDING * 2,
      height: avatarMenuSize.height + AVATAR_MENU_PADDING * 2,
    },
  };
};

function closeAvatarMenu(): void {
  if (!avatarMenuOpen) return;
  avatarMenuOpen = false;
  avatarMenuClosedAt = Date.now();
  if (avatarMenuWindow && !avatarMenuWindow.isDestroyed()) {
    avatarMenuWindow.setOpacity(0);
    avatarMenuWindow.hide();
    avatarMenuWindow.webContents.send('avatar-menu-closed');
  }
  avatarWindow?.webContents.send('avatar-menu-visibility', { open: false });
}

function openAvatarMenu(): void {
  if (avatarMenuOpen) {
    closeAvatarMenu();
    return;
  }
  // The click that closed the menu (by blurring it) must not reopen it.
  if (Date.now() - avatarMenuClosedAt < 300) return;
  const placement = avatarMenuBounds();
  if (
    !placement ||
    !avatarMenuWindow ||
    avatarMenuWindow.isDestroyed() ||
    avatarMenuSize.height === 0
  ) {
    return;
  }
  closeAvatarHistory();
  avatarMenuOpen = true;
  avatarMenuWindow.setOpacity(0);
  avatarMenuWindow.setBounds(placement.bounds);
  avatarMenuWindow.webContents.send('avatar-menu-open', {
    below: placement.below,
  });
  // Focus it so Escape and clicking elsewhere close it.
  avatarMenuWindow.show();
  avatarWindow?.webContents.send('avatar-menu-visibility', { open: true });
}

const createAvatarMenuWindow = () => {
  if (avatarMenuWindow && !avatarMenuWindow.isDestroyed()) return;
  avatarMenuWindow = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: process.platform !== 'darwin',
    webPreferences: { preload: preloadPath(), backgroundThrottling: false },
  });
  if (process.platform === 'darwin') {
    avatarMenuWindow.excludedFromShownWindowsMenu = true;
  }
  configureFullscreenCompanionWindow(avatarMenuWindow);
  avatarMenuWindow.setOpacity(0);
  avatarMenuWindow.loadURL(`${resolveHtmlPath('index.html')}?view=avatar-menu`);
  // Clicking anywhere else closes the menu, like a native one.
  avatarMenuWindow.on('blur', () => closeAvatarMenu());
  avatarMenuWindow.on('closed', () => {
    avatarMenuWindow = null;
    avatarMenuOpen = false;
    avatarMenuSize = { width: 0, height: 0 };
  });
};

ipcMain.removeAllListeners('open-avatar-menu');
ipcMain.on('open-avatar-menu', (event) => {
  if (event.sender !== avatarWindow?.webContents) return;
  openAvatarMenu();
});

ipcMain.removeAllListeners('close-avatar-menu');
ipcMain.on('close-avatar-menu', (event) => {
  if (event.sender !== avatarMenuWindow?.webContents) return;
  closeAvatarMenu();
});

// The menu renderer has painted the freshly opened menu: reveal the window.
ipcMain.removeAllListeners('avatar-menu-painted');
ipcMain.on('avatar-menu-painted', (event) => {
  if (event.sender !== avatarMenuWindow?.webContents || !avatarMenuOpen) return;
  avatarMenuWindow.setOpacity(1);
});

ipcMain.removeAllListeners('avatar-menu-size');
ipcMain.on(
  'avatar-menu-size',
  (event, size: { width?: unknown; height?: unknown } | undefined) => {
    if (event.sender !== avatarMenuWindow?.webContents) return;
    const width = Number(size?.width);
    const height = Number(size?.height);
    if (!(width > 0 && height > 0)) return;
    avatarMenuSize = { width: Math.ceil(width), height: Math.ceil(height) };
    // Content grew or shrank while open (e.g. a Hide error): keep it in place.
    const placement = avatarMenuOpen ? avatarMenuBounds() : null;
    if (placement) avatarMenuWindow?.setBounds(placement.bounds);
  },
);

// Menu items other than Hide run in the avatar renderer, which owns the state
// they touch (the current bubble, Coco's mood).
ipcMain.removeAllListeners('avatar-menu-action');
ipcMain.on('avatar-menu-action', (event, action: unknown) => {
  if (event.sender !== avatarMenuWindow?.webContents) return;
  if (typeof action !== 'string') return;
  closeAvatarMenu();
  avatarWindow?.webContents.send('avatar-menu-action', action);
});

// ── Avatar observation bubble ─────────────────────────────────────────────────
// Like the ••• menu, the bubble lives in its own transparent window. Growing
// the avatar window to fit it pushed Coco down whenever the window would have
// crossed the menu bar, and could flash Coco out of place for a frame. The
// avatar renderer still owns the bubble's state and handles its actions; this
// window only draws it. Its transparent margin lets clicks through to whatever
// is below, so it never blocks Coco or the desktop. It is a child of the avatar
// window, so macOS moves it with Coco in the same frame while Coco is dragged;
// it is re-placed once the drag ends, in case Coco now sits near an edge.

const avatarFootprint = (bounds: Rectangle) => ({
  x: bounds.x + bounds.width - AVATAR_BASE_SIZE,
  y: bounds.y + bounds.height - AVATAR_BASE_SIZE,
});

const hideAvatarBubble = () => {
  if (!avatarBubbleWindow || avatarBubbleWindow.isDestroyed()) return;
  avatarBubbleWindow.setOpacity(0);
  avatarBubbleWindow.hide();
  avatarBubbleWindow.setIgnoreMouseEvents(true, { forward: true });
};

// Size and place a card window (bubble or Activity panel) beside Coco's
// current position. Returns the side it went on, or null when it can't be
// placed yet.
const placeBesideAvatar = (
  win: BrowserWindow | null,
  card: { width: number; height: number },
  padding: number,
  options?: Parameters<typeof placeAvatarBubble>[3],
): AvatarCardPlacement | null => {
  if (
    !win ||
    win.isDestroyed() ||
    !avatarWindow ||
    avatarWindow.isDestroyed() ||
    !avatarWindow.isVisible() ||
    card.height === 0
  ) {
    return null;
  }
  const b = avatarWindow.getBounds();
  const placement = placeAvatarBubble(
    avatarFootprint(b),
    card,
    screen.getDisplayMatching(b).workArea,
    options,
  );
  win.setBounds({
    x: placement.x - padding,
    y: placement.y - padding,
    width: card.width + padding * 2,
    height: card.height + padding * 2,
  });
  return placement;
};

// Place the bubble next to Coco. Returns false when there is nothing to place.
const placeAvatarBubbleWindow = (): boolean => {
  if (!avatarBubbleState) return false;
  const placement = placeBesideAvatar(
    avatarBubbleWindow,
    avatarBubbleCardSize,
    AVATAR_BUBBLE_PADDING,
  );
  if (!placement) return false;
  avatarBubbleWindow?.webContents.send('avatar-bubble-placement', {
    side: placement.side,
  });
  return true;
};

const createAvatarBubbleWindow = () => {
  if (avatarBubbleWindow && !avatarBubbleWindow.isDestroyed()) return;
  if (!avatarWindow || avatarWindow.isDestroyed()) return;
  avatarBubbleWindow = new BrowserWindow({
    parent: avatarWindow,
    show: false,
    width: 1,
    height: 1,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    // Showing a bubble must never take focus from the user's work.
    focusable: false,
    skipTaskbar: process.platform !== 'darwin',
    webPreferences: { preload: preloadPath(), backgroundThrottling: false },
  });
  if (process.platform === 'darwin') {
    avatarBubbleWindow.excludedFromShownWindowsMenu = true;
  }
  configureFullscreenCompanionWindow(avatarBubbleWindow);
  avatarBubbleWindow.setOpacity(0);
  avatarBubbleWindow.setIgnoreMouseEvents(true, { forward: true });
  avatarBubbleWindow.loadURL(
    `${resolveHtmlPath('index.html')}?view=avatar-bubble`,
  );
  // A reloaded renderer needs the current bubble again.
  avatarBubbleWindow.webContents.on('did-finish-load', () => {
    avatarBubbleWindow?.webContents.send('avatar-bubble-state', {
      bubble: avatarBubbleState,
    });
  });
  avatarBubbleWindow.on('closed', () => {
    avatarBubbleWindow = null;
    avatarBubbleCardSize = { width: 0, height: 0 };
  });
};

// The avatar renderer's bubble changed (null when it went away).
ipcMain.removeAllListeners('avatar-bubble-state');
ipcMain.on('avatar-bubble-state', (event, payload: { bubble?: unknown }) => {
  if (event.sender !== avatarWindow?.webContents) return;
  avatarBubbleState = payload?.bubble ?? null;
  if (!avatarBubbleWindow || avatarBubbleWindow.isDestroyed()) return;
  if (!avatarBubbleState) {
    hideAvatarBubble();
    avatarBubbleCardSize = { width: 0, height: 0 };
  }
  const { workArea } = screen.getDisplayMatching(
    avatarWindow?.getBounds() ?? screen.getPrimaryDisplay().workArea,
  );
  avatarBubbleWindow.webContents.send('avatar-bubble-state', {
    bubble: avatarBubbleState,
    maxHeight: avatarBubbleMaxHeight(workArea, AVATAR_BUBBLE_PADDING),
  });
});

ipcMain.removeAllListeners('avatar-bubble-size');
ipcMain.on(
  'avatar-bubble-size',
  (event, size: { width?: unknown; height?: unknown } | undefined) => {
    if (event.sender !== avatarBubbleWindow?.webContents) return;
    const width = Number(size?.width);
    const height = Number(size?.height);
    if (!(width > 0 && height > 0)) return;
    avatarBubbleCardSize = {
      width: Math.ceil(width),
      height: Math.ceil(height),
    };
    placeAvatarBubbleWindow();
  },
);

// The bubble renderer has painted a new bubble at its final size: reveal it.
ipcMain.removeAllListeners('avatar-bubble-painted');
ipcMain.on('avatar-bubble-painted', (event) => {
  if (event.sender !== avatarBubbleWindow?.webContents) return;
  if (!placeAvatarBubbleWindow()) return;
  avatarBubbleWindow.showInactive();
  avatarBubbleWindow.setOpacity(1);
});

// Only the card catches the mouse; its transparent margin lets clicks through.
ipcMain.removeAllListeners('avatar-bubble-pointer');
ipcMain.on(
  'avatar-bubble-pointer',
  (event, { inside }: { inside?: boolean } = {}) => {
    if (event.sender !== avatarBubbleWindow?.webContents) return;
    avatarBubbleWindow.setIgnoreMouseEvents(inside !== true, {
      forward: true,
    });
  },
);

// Clicks and hovers on the bubble run in the avatar renderer, which owns the
// bubble's state.
ipcMain.removeAllListeners('avatar-bubble-event');
ipcMain.on('avatar-bubble-event', (event, type: unknown) => {
  if (event.sender !== avatarBubbleWindow?.webContents) return;
  if (typeof type !== 'string') return;
  avatarWindow?.webContents.send('avatar-bubble-event', type);
});

// ── Avatar Activity panel ─────────────────────────────────────────────────────
// Also its own child window beside Coco, for the same reasons as the bubble.
// Main owns whether it is open (the hot key, tray and avatar all toggle it);
// its renderer owns the records, read from the persisted history.

// The panel is centered on Coco with a tail pointing at it, a little further
// out than the bubble so the tall panel doesn't crowd the pet. While Coco is
// dragged the panel is faded out and left alone; it is placed again, and
// faded back in, once the drag ends.
const placeAvatarHistoryWindow = (): boolean => {
  if (!avatarHistoryOpen || avatarDragging) return false;
  const placement = placeBesideAvatar(
    avatarHistoryWindow,
    avatarHistoryCardSize,
    AVATAR_HISTORY_PADDING,
    { align: 'center', insetX: 10 },
  );
  if (!placement) return false;
  avatarHistoryWindow?.webContents.send('avatar-history-placement', {
    side: placement.side,
    tailY: placement.tailY,
  });
  return true;
};

function closeAvatarHistory(): void {
  if (!avatarHistoryOpen) return;
  avatarHistoryOpen = false;
  avatarHistoryCardSize = { width: 0, height: 0 };
  if (avatarHistoryWindow && !avatarHistoryWindow.isDestroyed()) {
    avatarHistoryWindow.setOpacity(0);
    avatarHistoryWindow.hide();
    avatarHistoryWindow.setIgnoreMouseEvents(true, { forward: true });
    avatarHistoryWindow.webContents.send('avatar-history-closed');
  }
  // The panel brought a hidden Coco along; put it away again.
  if (hideAvatarMode) avatarWindow?.hide();
}

function openAvatarHistory(): void {
  if (!avatarWindow || avatarWindow.isDestroyed()) createAvatarWindow();
  if (!avatarWindow || avatarWindow.isDestroyed()) return;
  closeAvatarMenu();
  avatarHistoryOpen = true;
  // The panel sits beside Coco, so it brings Coco back in hidden-avatar mode.
  if (!avatarWindow.isVisible()) avatarWindow.show();
  if (avatarHistoryReady) {
    avatarHistoryWindow?.webContents.send('avatar-history-open');
  }
}

function toggleAvatarHistory(): void {
  if (avatarHistoryOpen) closeAvatarHistory();
  else openAvatarHistory();
}

const createAvatarHistoryWindow = () => {
  if (avatarHistoryWindow && !avatarHistoryWindow.isDestroyed()) return;
  if (!avatarWindow || avatarWindow.isDestroyed()) return;
  avatarHistoryReady = false;
  avatarHistoryWindow = new BrowserWindow({
    parent: avatarWindow,
    show: false,
    width: 1,
    height: 1,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: process.platform !== 'darwin',
    webPreferences: { preload: preloadPath(), backgroundThrottling: false },
  });
  if (process.platform === 'darwin') {
    avatarHistoryWindow.excludedFromShownWindowsMenu = true;
  }
  configureFullscreenCompanionWindow(avatarHistoryWindow);
  avatarHistoryWindow.setOpacity(0);
  avatarHistoryWindow.setIgnoreMouseEvents(true, { forward: true });
  avatarHistoryWindow.loadURL(
    `${resolveHtmlPath('index.html')}?view=avatar-history`,
  );
  // History asked for before the renderer loaded opens as soon as it has.
  avatarHistoryWindow.webContents.on('did-finish-load', () => {
    avatarHistoryReady = true;
    if (avatarHistoryOpen) {
      avatarHistoryWindow?.webContents.send('avatar-history-open');
    }
  });
  avatarHistoryWindow.on('closed', () => {
    avatarHistoryWindow = null;
    avatarHistoryReady = false;
    avatarHistoryOpen = false;
    avatarHistoryCardSize = { width: 0, height: 0 };
  });
};

ipcMain.removeAllListeners('avatar-history-close');
ipcMain.on('avatar-history-close', (event) => {
  if (event.sender !== avatarHistoryWindow?.webContents) return;
  closeAvatarHistory();
});

ipcMain.removeAllListeners('avatar-history-size');
ipcMain.on(
  'avatar-history-size',
  (event, size: { width?: unknown; height?: unknown } | undefined) => {
    if (event.sender !== avatarHistoryWindow?.webContents) return;
    const width = Number(size?.width);
    const height = Number(size?.height);
    if (!(width > 0 && height > 0)) return;
    avatarHistoryCardSize = {
      width: Math.ceil(width),
      height: Math.ceil(height),
    };
    placeAvatarHistoryWindow();
  },
);

// The opened panel has been painted at its final size: reveal it.
ipcMain.removeAllListeners('avatar-history-painted');
ipcMain.on('avatar-history-painted', (event) => {
  if (event.sender !== avatarHistoryWindow?.webContents) return;
  if (!placeAvatarHistoryWindow()) return;
  avatarHistoryWindow.showInactive();
  avatarHistoryWindow.setOpacity(1);
});

// Only the panel catches the mouse; its transparent margin lets clicks through.
ipcMain.removeAllListeners('avatar-history-pointer');
ipcMain.on(
  'avatar-history-pointer',
  (event, { inside }: { inside?: boolean } = {}) => {
    if (event.sender !== avatarHistoryWindow?.webContents) return;
    avatarHistoryWindow.setIgnoreMouseEvents(inside !== true, {
      forward: true,
    });
  },
);

// ── Avatar window ─────────────────────────────────────────────────────────────

let avatarPointerDrag: {
  x: number;
  y: number;
  windowX: number;
  windowY: number;
} | null = null;
ipcMain.on('avatar-pointer', (event, value: { inside?: boolean } = {}) => {
  if (event.sender !== avatarWindow?.webContents || !avatarWindow) return;
  if (!avatarPointerDrag)
    avatarWindow.setIgnoreMouseEvents(value.inside !== true, { forward: true });
});
ipcMain.on('avatar-pointer-drag', (event, value: { phase?: string } = {}) => {
  if (event.sender !== avatarWindow?.webContents || !avatarWindow) return;
  if (value.phase === 'start') {
    const point = screen.getCursorScreenPoint();
    const bounds = avatarWindow.getBounds();
    avatarPointerDrag = { ...point, windowX: bounds.x, windowY: bounds.y };
    avatarWindow.setIgnoreMouseEvents(false);
  } else if (value.phase === 'move' && avatarPointerDrag) {
    const point = screen.getCursorScreenPoint();
    avatarWindow.setPosition(
      avatarPointerDrag.windowX + point.x - avatarPointerDrag.x,
      avatarPointerDrag.windowY + point.y - avatarPointerDrag.y,
    );
  } else if (value.phase === 'end') {
    avatarPointerDrag = null;
  }
});

const createAvatarWindow = () => {
  if (avatarWindow && !avatarWindow.isDestroyed()) return;

  // Just the pet. The bubble, menu and Activity panel have their own windows,
  // so this one never resizes: resizing it pushed Coco around near the top of
  // the screen, and its transparent margins would intercept desktop clicks.
  avatarWindow = new BrowserWindow({
    show: false,
    width: AVATAR_BASE_SIZE,
    height: AVATAR_BASE_SIZE,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: process.platform !== 'darwin',
    webPreferences: { preload: preloadPath() },
  });
  if (process.platform === 'darwin') {
    // The avatar is a companion surface, not a second Coco document. Keep it
    // out of the Dock's window list while the main chat remains listed there.
    avatarWindow.excludedFromShownWindowsMenu = true;
  }
  configureFullscreenCompanionWindow(avatarWindow);

  runnerGuideRendererReady = false;
  avatarWindow.webContents.on('did-start-loading', () => { runnerGuideRendererReady = false; });
  avatarWindow.loadURL(resolveHtmlPath('index.html'));
  avatarWindow.setIgnoreMouseEvents(true, { forward: true });
  // Screen coordinates and content bounds are both DIP units. Polling also
  // handles animation/scale changes when the pointer does not move.
  const pointerTimer = setInterval(() => {
    if (
      !avatarWindow ||
      avatarWindow.isDestroyed() ||
      !avatarWindow.isVisible()
    )
      return;
    const point = screen.getCursorScreenPoint();
    const bounds = avatarWindow.getContentBounds();
    const zoom = avatarWindow.webContents.getZoomFactor();
    avatarWindow.webContents.send('avatar-pointer-position', {
      x: (point.x - bounds.x) / zoom,
      y: (point.y - bounds.y) / zoom,
    });
  }, 33);

  avatarWindow.on('ready-to-show', () => {
    if (onboardingWindow?.isVisible() || ((hideAvatarMode || !isOnboardingComplete()) && !activeRunnerGuide)) {
      avatarWindow?.hide();
    } else if (process.env.START_MINIMIZED) {
      avatarWindow?.minimize();
    } else {
      avatarWindow?.showInactive();
    }
  });

  avatarWindow.on('closed', () => {
    clearInterval(pointerTimer);
    avatarPointerDrag = null;
    avatarWindow = null;
    avatarMenuWindow?.destroy();
    avatarBubbleWindow?.destroy();
    avatarHistoryWindow?.destroy();
    avatarBubbleState = null;
    if (avatarDragEndTimer) clearTimeout(avatarDragEndTimer);
    avatarDragEndTimer = null;
    avatarDragging = false;
  });

  // A drag shows up as a run of move events, the first preceded by will-move
  // where the platform reports it. Treat a short pause in them as the drag's
  // end. While dragging, the ••• trigger stays hidden even though the pointer
  // is over Coco, and the bubble (a child window) moves with Coco by itself.
  const setAvatarDragging = (dragging: boolean) => {
    if (avatarDragging === dragging) return;
    avatarDragging = dragging;
    if (avatarWindow && !avatarWindow.isDestroyed()) {
      avatarWindow.webContents.send('avatar-dragging', { dragging });
    }
    // The tall panel would trail off screen as it moves with Coco; fade it
    // out for the drag and back in beside Coco's new spot.
    if (
      avatarHistoryOpen &&
      avatarHistoryWindow &&
      !avatarHistoryWindow.isDestroyed() &&
      avatarHistoryWindow.isVisible()
    ) {
      if (dragging) avatarHistoryWindow.setOpacity(0);
      else if (placeAvatarHistoryWindow()) avatarHistoryWindow.setOpacity(1);
    }
  };
  const noteAvatarMove = () => {
    setAvatarDragging(true);
    if (avatarDragEndTimer) clearTimeout(avatarDragEndTimer);
    avatarDragEndTimer = setTimeout(() => {
      avatarDragEndTimer = null;
      setAvatarDragging(false);
      placeAvatarBubbleWindow();
    }, AVATAR_DRAG_END_MS);
  };
  avatarWindow.on('will-move', noteAvatarMove);
  avatarWindow.on('move', noteAvatarMove);
  avatarWindow.on('hide', () => {
    avatarPointerDrag = null;
    hideAvatarBubble();
    closeAvatarHistory();
  });
  avatarWindow.on('show', () => {
    if (!placeAvatarBubbleWindow() || !avatarBubbleWindow) return;
    avatarBubbleWindow.showInactive();
    avatarBubbleWindow.setOpacity(1);
  });

  avatarWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Native drag regions do not reliably dispatch DOM context-menu events. Use
  // Electron's native hooks to open the same menu as the ellipsis button so
  // both entry points stay visually and functionally consistent.
  avatarWindow.webContents.on('context-menu', (event) => {
    event.preventDefault();
    openAvatarMenu();
  });
  avatarWindow.on('system-context-menu', (event) => {
    event.preventDefault();
    openAvatarMenu();
  });

  createAvatarMenuWindow();
  createAvatarBubbleWindow();
  createAvatarHistoryWindow();

  // (notification is screen-pinned; no need to reposition on move)
};

// ── Chat window (local tutor session) ─────────────────────────────────────────
// A frameless right-edge side panel hosting the local SessionChatView. Unlike
// the old webapp window there is no WebSocket to keep alive, so it is created on
// demand and hidden (not destroyed) on close so the conversation persists if the
// user reopens it. All chat traffic goes straight to the local tutor server via
// the 'send-chat-message' IPC handler — no external backend involved.

// The chat renderer mounts its IPC listeners shortly after the page loads.
const CHAT_RENDERER_READY_DELAY_MS = 300;
const CHAT_PANEL_W = 520;
const CHAT_EXPANDED_W = 1160;
const CHAT_CONTENT_ZOOM_LEVELS = [0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
let chatContentZoomFactor = 1;
let chatWindowPinned = false;

ipcMain.on('get-chat-window-pin-state', (event) => {
  if (event.sender !== chatWindow?.webContents) return;
  event.sender.send('chat-window-pin-state', { pinned: chatWindowPinned });
});
ipcMain.on(
  'set-chat-window-pinned',
  (event, value: { pinned?: boolean } = {}) => {
    if (
      event.sender !== chatWindow?.webContents ||
      !chatWindow ||
      typeof value?.pinned !== 'boolean'
    )
      return;
    chatWindow.setAlwaysOnTop(value.pinned);
    chatWindowPinned = chatWindow.isAlwaysOnTop();
    event.sender.send('chat-window-pin-state', { pinned: chatWindowPinned });
  },
);

const createChatWindow = () => {
  if (chatWindow && !chatWindow.isDestroyed()) return;

  // A fresh renderer hasn't mounted its hot-key listener yet; wait for its
  // readiness handshake before flushing any buffered captures.
  hotkeyRendererReady = false;

  trainingPanelVisible = false;
  chatWindow = new BrowserWindow({
    show: false,
    width: isFloatMode ? CHAT_PANEL_W : CHAT_EXPANDED_W,
    height: 780,
    minWidth: 420,
    minHeight: 500,
    frame: process.platform === 'darwin',
    transparent: process.platform !== 'darwin',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: { x: 14, y: 14 },
        }
      : {}),
    resizable: true,
    skipTaskbar: process.platform !== 'darwin',
    alwaysOnTop: false,
    webPreferences: { preload: preloadPath(), backgroundThrottling: true },
  });

  configureMainWindow(chatWindow);
  const refreshRunnerGuide = () => publishRunnerGuide();
  chatWindow.on('focus', refreshRunnerGuide);
  chatWindow.on('blur', refreshRunnerGuide);
  chatWindow.on('show', refreshRunnerGuide);
  chatWindow.on('hide', refreshRunnerGuide);
  chatWindow.on('minimize', refreshRunnerGuide);
  chatWindow.on('restore', refreshRunnerGuide);
  chatWindow.setAlwaysOnTop(chatWindowPinned);
  chatWindow.loadURL(`${resolveHtmlPath('index.html')}?view=session`);

  const reportLayout = () => {
    if (!chatWindow || chatWindow.isDestroyed()) return;
    isFloatMode = chatWindow.getBounds().width < 780;
    chatWindow.webContents.send('float-window-state', { isFloat: isFloatMode });
  };
  chatWindow.on('resize', reportLayout);
  chatWindow.webContents.on('did-finish-load', () => {
    setTimeout(reportLayout, CHAT_RENDERER_READY_DELAY_MS);
  });

  // A recreated chat window starts blank. Give it the current conversation so
  // it doesn't show an empty, task-less chat mid-session.
  chatWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (!currentSessionId || !chatWindow || chatWindow.isDestroyed()) return;
      chatWindow.webContents.send('session-init', {
        sessionId: currentSessionId,
        problemStatement: pendingTaskLabel || '',
        tutorModelId: currentTutorModelId,
      });
    }, CHAT_RENDERER_READY_DELAY_MS);
  });
  chatWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error(
      `[Chat] Chat renderer exited: ${details.reason} (${details.exitCode})`,
    );
  });

  const reportChatContentZoom = () => {
    if (!chatWindow || chatWindow.isDestroyed()) return;
    chatWindow.webContents.send(
      'chat-content-zoom-factor',
      chatContentZoomFactor,
    );
  };
  chatWindow.webContents.setZoomFactor(1);
  void chatWindow.webContents.setVisualZoomLevelLimits(1, 1);
  chatWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.type === 'keyDown' &&
      (input.meta || input.control) &&
      ['+', '-', '=', '0'].includes(input.key)
    ) {
      event.preventDefault();
      const currentIndex = CHAT_CONTENT_ZOOM_LEVELS.reduce(
        (closest, level, index) =>
          Math.abs(level - chatContentZoomFactor) <
          Math.abs(CHAT_CONTENT_ZOOM_LEVELS[closest] - chatContentZoomFactor)
            ? index
            : closest,
        0,
      );
      if (input.key === '0') {
        chatContentZoomFactor = 1;
      } else if (input.key === '+' || input.key === '=') {
        chatContentZoomFactor =
          CHAT_CONTENT_ZOOM_LEVELS[
            Math.min(currentIndex + 1, CHAT_CONTENT_ZOOM_LEVELS.length - 1)
          ];
      } else {
        chatContentZoomFactor =
          CHAT_CONTENT_ZOOM_LEVELS[Math.max(currentIndex - 1, 0)];
      }
      reportChatContentZoom();
    }
  });
  chatWindow.webContents.on('did-finish-load', () => {
    chatWindow?.webContents.setZoomFactor(1);
    reportChatContentZoom();
  });

  // Closing hides rather than destroys so the in-memory conversation survives
  // a reopen. On a real app quit, let it close so shutdown isn't blocked.
  chatWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    chatWindow?.hide();
    if (hideAvatarMode) return;
    if (!avatarWindow || avatarWindow.isDestroyed()) {
      createAvatarWindow();
    } else {
      avatarWindow.show();
    }
  });

  chatWindow.on('closed', () => {
    // The chat should only be destroyed on quit; log anything else so it can
    // be traced (it otherwise loses the open conversation).
    if (!isQuitting) log.warn('[Chat] Chat window was destroyed.');
    chatWindow = null;
  });

  chatWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
};

// ── Proactive suggestions in the chat ─────────────────────────────────────────
// Every shown suggestion becomes a Coco message in the chat: unfolded when the
// chat was already open, folded when it first appeared as a pop-up. It is also
// added to the tutor's history so later replies and the Judge know about it.
const chatSuggestions = new Map<string, ChatSuggestion>();
// The suggestion pop-up currently on screen, if any.
let suggestionNotification: {
  window: BrowserWindow;
  observationId?: string;
} | null = null;

const isChatPanelVisible = (): boolean =>
  chatWindow !== null && !chatWindow.isDestroyed() && chatWindow.isVisible();

// Recreates the (hidden) chat window if it is gone, so nothing is dropped.
const sendToChat = (channel: string, payload: unknown): void => {
  createChatWindow();
  if (!chatWindow || chatWindow.isDestroyed()) return;
  if (chatWindow.webContents.isLoadingMainFrame()) {
    chatWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        chatWindow?.webContents.send(channel, payload);
      }, CHAT_RENDERER_READY_DELAY_MS);
    });
  } else {
    chatWindow.webContents.send(channel, payload);
  }
};

// Deliver a chat stream event to the chat that asked for it, or to its
// replacement if that window was closed mid-reply. Never throws: a missing
// window must not abort the stream, whose outcome main also saves to disk.
const sendChatStreamEvent = (
  sender: WebContents,
  payload: Record<string, unknown>,
): void => {
  if (typeof payload.requestId === 'string') {
    chatStreams.accept(
      payload.requestId,
      payload as unknown as TutorStreamEvent,
    );
    if (payload.type === 'done' || payload.type === 'error')
      chatStreams.flush(payload.requestId);
  }
  let target: WebContents | null = sender;
  if (target.isDestroyed()) {
    target =
      chatWindow && !chatWindow.isDestroyed() ? chatWindow.webContents : null;
  }
  if (!target || target.isDestroyed()) return;
  try {
    target.send('chat-stream-event', payload);
  } catch (err) {
    log.warn(
      `[Chat] Could not deliver stream event: ${(err as Error).message}`,
    );
  }
};

// Completion reminders are one-shot; they do not track read/unread state.
const remindAgentReply = async (
  sessionId: string | null,
  requestId: string,
) => {
  if (!sessionId || hideAvatarMode || !tutoringAllowed) return;
  if (!(await isChatOutOfView(chatWindow))) return;
  if (
    hideAvatarMode ||
    !tutoringAllowed ||
    !avatarWindow ||
    avatarWindow.isDestroyed()
  )
    return;
  avatarWindow.webContents.send('agent-reply-ready', { sessionId, requestId });
};

const startAgentProgressReminder = (
  sessionId: string | null,
  requestId: string,
) =>
  new AgentProgressReminder((text) => {
    const publish = async () => {
      if (!sessionId || !(await isChatOutOfView(chatWindow))) return;
      if (
        !agentRuns.requests.has(requestId) ||
        agentRuns.requests.get(requestId)?.stopped ||
        hideAvatarMode ||
        !tutoringAllowed ||
        !avatarWindow ||
        avatarWindow.isDestroyed()
      )
        return;
      avatarWindow.webContents.send('agent-working', {
        sessionId,
        requestId,
        text,
      });
    };
    publish().catch((error) =>
      log.warn('[Chat] Could not show working update:', error),
    );
  });

const clearAgentProgressReminder = (requestId: string) => {
  if (avatarWindow && !avatarWindow.isDestroyed())
    avatarWindow.webContents.send('agent-work-ended', { requestId });
};

ipcMain.on(
  'view-agent-reply',
  (_event, target: { sessionId?: string; requestId?: string } = {}) => {
    const conversation = readConversations().find(
      (saved) => saved.sessionId === target.sessionId,
    );
    if (
      !conversation ||
      !conversation.messages.some(
        (message) => message.requestId === target.requestId,
      )
    )
      return;
    showChatPanel();
    sendToChat('reveal-agent-reply', {
      conversation,
      requestId: target.requestId,
    });
  },
);

const toChatSuggestion = (
  suggestion: InstantSuggestion,
  observationId?: string,
): ChatSuggestion => {
  const tool =
    suggestion.availableTools?.find((t) => t.id === suggestion.targetTool) ??
    suggestion.availableTools?.[0];
  return {
    observationId,
    kind: suggestion.kind,
    title: suggestion.title,
    body: suggestion.body,
    prompt: suggestion.prompt,
    copyText: suggestion.copyText,
    fourDDimension: suggestion.fourDDimension,
    noticed: suggestion.noticed,
    aiCan: suggestion.aiCan,
    why: suggestion.why,
    check: suggestion.check,
    ...(suggestion.kind === 'delegate' && tool
      ? { tool: { id: tool.id, label: tool.label } }
      : {}),
  };
};

const deliverSuggestionToChat = (
  suggestion: ChatSuggestion,
  folded: boolean,
): void => {
  if (suggestion.observationId) {
    chatSuggestions.set(suggestion.observationId, suggestion);
  }
  log.info(
    `[Suggestion] Added to chat (${folded ? 'folded copy of a pop-up' : 'chat was open'}) id=${suggestion.observationId ?? '(none)'}`,
  );
  sendToChat('chat-suggestion', { suggestion, folded });
};

// Unfold a suggestion in the chat. It carries the suggestion itself so a chat
// window recreated since delivery can still show it.
const revealChatSuggestion = (observationId: string): void => {
  sendToChat('reveal-chat-suggestion', {
    observationId,
    suggestion: chatSuggestions.get(observationId),
  });
};

const recordSuggestionWithTutor = (
  suggestion: ChatSuggestion,
  triggerType?: string,
): void => {
  const tutorPort = process.env.TUTOR_PORT || '8081';
  axios
    .post(
      `http://127.0.0.1:${tutorPort}/context/suggestion`,
      {
        text: chatSuggestionText(suggestion),
        trigger_type: triggerType ?? null,
      },
      { timeout: 3000 },
    )
    .catch((err) => {
      log.warn(
        `[Suggestion] failed to record with tutor: ${(err as Error).message}`,
      );
    });
};

// Position a new chat window once; showing another conversation keeps the
// user's existing window geometry, including when reopening a hidden window.
const showChatPanel = (options: { expanded?: boolean } = {}) => {
  const isNewWindow = !chatWindow || chatWindow.isDestroyed();
  const needsConversation = !currentSessionId;
  initializeChatConversation();
  createChatWindow();
  if (!chatWindow || chatWindow.isDestroyed()) return;
  if (needsConversation) {
    sendToChat('session-init', {
      sessionId: currentSessionId,
      problemStatement: pendingTaskLabel || '',
      tutorModelId: currentTutorModelId,
    });
  }

  // The pop-up's suggestion is already in the chat; don't show both.
  if (
    suggestionNotification &&
    suggestionNotification.window === proactive.window &&
    !suggestionNotification.window.isDestroyed()
  ) {
    const { window, observationId } = suggestionNotification;
    suggestionNotification = null;
    window.destroy();
    if (observationId) revealChatSuggestion(observationId);
  }

  if (isNewWindow) {
    const disp = screen.getDisplayMatching(chatWindow.getBounds());
    const { x: dx, y: dy, width: sw, height: sh } = disp.workArea;
    const w = Math.min(isFloatMode ? CHAT_PANEL_W : CHAT_EXPANDED_W, sw - 32);
    const h = Math.min(780, sh - 32);
    chatWindow.setBounds({
      x: dx + sw - w - 16,
      y: dy + Math.floor((sh - h) / 2),
      width: w,
      height: h,
    });
  } else if (options.expanded && chatWindow.getBounds().width < 780) {
    resizeMainWindow(
      chatWindow,
      CHAT_EXPANDED_W,
      screen.getDisplayMatching(chatWindow.getBounds()).workArea,
    );
  }
  configureMainWindow(chatWindow);
  chatWindow.setAlwaysOnTop(chatWindowPinned);
  if (chatWindow.isMinimized()) chatWindow.restore();
  chatWindow.show();
  chatWindow.focus();
  // The avatar stays visible alongside the chat panel — never hide it, so the
  // pet is always available and closing the chat can't leave a blank screen.
  if (
    !hideAvatarMode &&
    avatarWindow &&
    !avatarWindow.isDestroyed() &&
    !avatarWindow.isVisible()
  ) {
    avatarWindow.show();
  }
};

const clearImagePreviewState = (target: BrowserWindow) => {
  if (imagePreviewWindow !== target) return;
  imagePreviewWindow = null;
  imagePreviewDataUrl = null;
  imagePreviewEditable = false;
  imagePreviewSourceWindow = null;
  imagePreviewAnnotationResult = 'replace';
  imagePreviewFullScreenOverlay = false;
};

const dismissImagePreviewWindow = (target: BrowserWindow) => {
  clearImagePreviewState(target);
  if (!target.isDestroyed()) target.destroy();
};

const captureDisplayAtCursor = async (): Promise<string> => {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const pixelSize = {
    width: Math.max(1, Math.round(display.size.width * display.scaleFactor)),
    height: Math.max(1, Math.round(display.size.height * display.scaleFactor)),
  };
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: pixelSize,
  });
  const source =
    sources.find((candidate) => candidate.display_id === String(display.id)) ??
    (sources.length === 1 ? sources[0] : undefined);
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error(`No capture source found for display ${display.id}`);
  }

  const capturedSize = source.thumbnail.getSize();
  log.info(
    `[ImagePreview] Captured display ${display.id} at ` +
      `${capturedSize.width}x${capturedSize.height} ` +
      `(requested ${pixelSize.width}x${pixelSize.height}).`,
  );
  return source.thumbnail.toDataURL();
};

const openImagePreviewWindow = (
  sourceWindow: BrowserWindow | null,
  imageDataUrl: string,
  editable = false,
  annotationResult: 'replace' | 'attach' = 'replace',
  displayAtCursor = false,
  fullScreenOverlay = false,
) => {
  imagePreviewDataUrl = imageDataUrl;
  imagePreviewEditable = editable;
  imagePreviewSourceWindow = sourceWindow;
  imagePreviewAnnotationResult = annotationResult;
  imagePreviewFullScreenOverlay = fullScreenOverlay;
  const display =
    sourceWindow && !displayAtCursor
      ? screen.getDisplayMatching(sourceWindow.getBounds())
      : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());

  if (imagePreviewWindow && !imagePreviewWindow.isDestroyed()) {
    if (
      process.platform === 'darwin' &&
      imagePreviewWindow.isSimpleFullScreen()
    ) {
      imagePreviewWindow.setSimpleFullScreen(false);
    }
    imagePreviewWindow.setBounds(display.bounds);
    if (process.platform === 'darwin') {
      imagePreviewWindow.setSimpleFullScreen(true);
    }
    if (!imagePreviewWindow.webContents.isLoadingMainFrame()) {
      imagePreviewWindow.webContents.send('image-preview', {
        imageDataUrl,
        editable,
        fullScreenOverlay,
      });
      imagePreviewWindow.show();
      imagePreviewWindow.focus();
    }
    return;
  }

  const previewWindow = new BrowserWindow({
    show: false,
    ...display.bounds,
    frame: false,
    transparent: false,
    backgroundColor: '#111827',
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: { preload: preloadPath() },
  });
  imagePreviewWindow = previewWindow;
  previewWindow.setAlwaysOnTop(
    true,
    process.platform === 'darwin' ? 'screen-saver' : 'floating',
  );
  if (process.platform === 'darwin') {
    // A bounded frameless window is constrained below macOS's live menu bar,
    // which leaves the captured menu bar visible underneath it. Simple
    // fullscreen covers the menu bar and Dock without creating a new Space.
    previewWindow.setSimpleFullScreen(true);
  }
  previewWindow.loadURL(`${resolveHtmlPath('index.html')}?view=image-preview`);
  previewWindow.on('closed', () => {
    // A rapid cancel → hotkey sequence can create the next preview before the
    // old window emits `closed`. Never let the old callback clear the new one.
    clearImagePreviewState(previewWindow);
  });
};

const beginHotkeyCapture = async (): Promise<void> => {
  if (hotkeyCaptureInProgress) {
    log.info('[ImagePreview] Capture already in progress; ignoring repeat.');
    return;
  }
  if (imagePreviewWindow && !imagePreviewWindow.isDestroyed()) {
    imagePreviewWindow.show();
    imagePreviewWindow.focus();
    return;
  }

  hotkeyCaptureInProgress = true;
  const startedAt = Date.now();
  try {
    const dataUrl = await captureDisplayAtCursor();
    createChatWindow();
    openImagePreviewWindow(chatWindow, dataUrl, true, 'attach', true, true);
    log.info(
      `[ImagePreview] Annotation overlay opened in ${Date.now() - startedAt}ms.`,
    );
  } catch (error) {
    log.error(
      `[ImagePreview] Direct screenshot capture failed: ${(error as Error).message}`,
    );
  } finally {
    hotkeyCaptureInProgress = false;
  }
};

const openHtmlPreviewWindow = (sourceWindow: BrowserWindow | null, html: string) => {
  htmlPreviewDocument = html;
  if (htmlPreviewWindow && !htmlPreviewWindow.isDestroyed()) {
    if (!htmlPreviewWindow.webContents.isLoadingMainFrame()) {
      htmlPreviewWindow.webContents.send('html-preview', { html });
      htmlPreviewWindow.show();
      htmlPreviewWindow.focus();
    }
    return;
  }
  htmlPreviewWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 620,
    minHeight: 440,
    show: false,
    title: 'Coco · HTML Preview',
    backgroundColor: '#eaf2ff',
    webPreferences: { preload: preloadPath() },
  });
  if (sourceWindow) {
    const area = screen.getDisplayMatching(sourceWindow.getBounds()).workArea;
    const width = Math.min(1100, area.width);
    const height = Math.min(780, area.height);
    htmlPreviewWindow.setBounds({
      x: Math.max(area.x, Math.min(sourceWindow.getBounds().x + 56, area.x + area.width - width)),
      y: Math.max(area.y, Math.min(sourceWindow.getBounds().y + 56, area.y + area.height - height)),
      width,
      height,
    });
  }
  htmlPreviewWindow.loadURL(`${resolveHtmlPath('index.html')}?view=html-preview`);
  htmlPreviewWindow.on('closed', () => {
    htmlPreviewWindow = null;
    htmlPreviewDocument = null;
  });
};

const deliverPendingWakeWordDetection = (): void => {
  const pending = pendingWakeWordDetection;
  if (!pending) return;
  if (pending.attempts >= 30) {
    log.warn(
      `[Wake word] Chat did not acknowledge detection ${pending.id}; resuming listening`,
    );
    pendingWakeWordDetection = null;
    setWakeWordCapturePaused(false);
    return;
  }
  pending.attempts += 1;
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('wake-word-detected', {
      id: pending.id,
      keyword: pending.keyword,
    });
  }
  pending.retryTimer = setTimeout(deliverPendingWakeWordDetection, 500);
};

const queueWakeWordDetection = (keyword: string): void => {
  if (pendingWakeWordDetection?.retryTimer) {
    clearTimeout(pendingWakeWordDetection.retryTimer);
  }
  wakeWordDetectionSequence += 1;
  pendingWakeWordDetection = {
    id: wakeWordDetectionSequence,
    keyword,
    attempts: 0,
    retryTimer: null,
  };
  setWakeWordCapturePaused(true);
  showChatPanel();
  deliverPendingWakeWordDetection();
};

const createWakeWordCaptureWindow = (): void => {
  if (wakeWordCaptureWindow && !wakeWordCaptureWindow.isDestroyed()) return;
  const { x, y } = screen.getPrimaryDisplay().workArea;
  wakeWordCaptureWindow = new BrowserWindow({
    show: false,
    x,
    y,
    width: 1,
    height: 1,
    opacity: 0,
    transparent: true,
    frame: false,
    focusable: false,
    skipTaskbar: process.platform !== 'darwin',
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath(),
      backgroundThrottling: false,
    },
  });
  if (process.platform === 'darwin') {
    wakeWordCaptureWindow.excludedFromShownWindowsMenu = true;
  }
  wakeWordCaptureWindow.setIgnoreMouseEvents(true);
  wakeWordCaptureWindow.setAlwaysOnTop(true, 'floating');
  wakeWordCaptureWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    // Electron otherwise transforms the whole macOS process into an
    // accessory/UIElement app here. Coco keeps running, but the Dock indicator
    // disappears and macOS makes it look as though the app has quit.
    skipTransformProcessType: true,
  });
  wakeWordCaptureWindow.loadURL(
    `${resolveHtmlPath('index.html')}?view=wake-word-capture`,
  );
  wakeWordCaptureWindow.webContents.on(
    'render-process-gone',
    (_event, details) => {
      log.error(
        `[Wake word] Capture renderer exited: ${details.reason} (${details.exitCode})`,
      );
    },
  );
  wakeWordCaptureWindow.on('closed', () => {
    wakeWordCaptureWindow = null;
  });
};

const syncWakeWordService = (): void => {
  if (!wakeWordService) return;
  if (!wakeWordEnabled || !tutoringAllowed) wakeWordService.stop('disabled');
  else if (cocoSleeping || systemSuspended) {
    wakeWordService.stop('sleeping');
  } else wakeWordService.start();
};

const initializeWakeWordService = (): void => {
  if (wakeWordService) return;
  wakeWordEnabled = readWakeWordEnabled();
  const modelDir = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'wake-word', WAKE_WORD_MODEL)
    : path.resolve(process.cwd(), 'assets', 'wake-word', WAKE_WORD_MODEL);
  const executable = app.isPackaged
    ? path.join(
        process.resourcesPath,
        'service-dist',
        'coco-services',
        process.platform === 'win32'
          ? 'wake-word-worker.exe'
          : 'wake-word-worker',
      )
    : undefined;
  wakeWordService = new WakeWordService({
    projectRoot: app.isPackaged
      ? process.resourcesPath
      : path.resolve(process.cwd(), '..'),
    modelDir,
    stateDir: path.join(app.getPath('userData'), 'wake-word'),
    logPath: path.join(app.getPath('userData'), 'logs', 'wake-word.log'),
    packagedExecutable: executable,
    onStatus: publishWakeWordStatus,
    onDetected: (keyword) => {
      if (!wakeWordEnabled || isObservationPaused() || systemSuspended) return;
      log.info(`[Wake word] Detected ${keyword}`);
      // The tutor service starts only after setup, so a voice turn here would
      // always fail. During onboarding, just confirm the phrase was heard.
      if (setupPending()) {
        onboardingWindow?.webContents.send('onboarding-wake-word-detected');
        return;
      }
      queueWakeWordDetection(keyword);
    },
  });
  syncWakeWordService();
};

const openChatSettings = () => {
  if (!areRequiredPreAssessmentsComplete()) {
    showPreAssessmentLockedMessage();
    return;
  }
  createChatWindow();
  if (!chatWindow || chatWindow.isDestroyed()) return;

  isFloatMode = false;
  showChatPanel({ expanded: true });
  sendToChat('open-chat-settings', null);
};

// The compact menu lives in the avatar renderer, while Settings lives in the
// chat renderer. Bridge the action through main so the chat becomes visible
// before its renderer is asked to reveal Settings.
ipcMain.removeAllListeners('open-chat-settings');
ipcMain.on('open-chat-settings', () => {
  openChatSettings();
});

async function openCoco(): Promise<void> {
  if (!areRequiredPreAssessmentsComplete()) {
    showPreAssessmentLockedMessage();
    return;
  }
  if (!currentSessionId) {
    showChatPanel();
    return;
  }
  openChatForSession(currentSessionId, pendingTaskLabel || 'General help session');
}

// Window existence does not imply conversation readiness: startup creates a
// hidden renderer, and Settings/Tasks can reveal it before Open Chat is used.
function initializeChatConversation(): void {
  ensureChatConversation({
    current: () => currentSessionId,
    latest: () =>
      latestConversation(
        readConversations().filter(conversation => !isQuestConversation(conversation)),
      ),
    draftId: () => randomUUID(),
    select: (sessionId, saved) => {
      currentSessionId = sessionId;
      resumableSessionId = saved ? sessionId : null;
      pendingTaskLabel =
        saved?.problem || pendingTaskLabel || 'General help session';
      const modelConfig = readModelConfiguration();
      currentTutorModelId =
        modelConfig?.tutors.find(item => item.id === saved?.tutorModelId)?.id ??
        (modelConfig ? defaultTutor(modelConfig).id : null);
      activateBridgeConversation(sessionId);
    },
  });
}

function setupPending(): boolean {
  return (
    !isAuthenticated || !isOnboardingComplete() || !readModelConfiguration()
  );
}

function openPrimaryTrayAction(): void {
  if (!isAuthenticated) {
    createAuthWindow();
    return;
  }
  if (setupPending()) {
    if (!onboardingWindow || onboardingWindow.isDestroyed()) {
      createOnboardingWindow(isOnboardingComplete());
    } else {
      onboardingWindow.show();
      onboardingWindow.focus();
    }
    return;
  }
  if (!areRequiredPreAssessmentsComplete()) {
    showPreAssessmentLockedMessage();
    return;
  }
  openCoco().catch((err) => log.warn(`[Tray] Could not open Coco: ${err}`));
}

// Bring Coco forward when the user asks for it from outside the app: a Dock
// click or reopening the app while it is already running. The chat panel is
// hidden rather than destroyed, so "no window object" can't be the signal.
function revealCoco(): void {
  if (isQuitting) return;
  // Activation brings the existing page forward. Opening a conversation sends
  // session-init, which would switch Tasks or Settings back to Chat.
  if (!setupPending() && chatWindow && !chatWindow.isDestroyed()) {
    if (!currentSessionId) {
      showChatPanel();
      return;
    }
    if (chatWindow.isMinimized()) chatWindow.restore();
    chatWindow.show();
    chatWindow.focus();
    return;
  }
  if (setupPending()) {
    openPrimaryTrayAction();
    return;
  }
  if (!areRequiredPreAssessmentsComplete()) {
    openTraining();
    return;
  }
  if (!setupPending() && !tutoringAllowed) {
    openTraining();
    return;
  }
  openPrimaryTrayAction();
}

function handleTrayClick(): void {
  // Preserve the setup-window recovery path, but once setup is complete let
  // the user choose an explicit action instead of opening chat immediately.
  if (setupPending()) {
    openPrimaryTrayAction();
    return;
  }
  if (!areRequiredPreAssessmentsComplete()) {
    openTraining();
    return;
  }
  tray?.popUpContextMenu();
}

function trayIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, '../../assets/icon.png');
}

function createTray(): void {
  if (!tray || tray.isDestroyed()) {
    const image = nativeImage.createFromPath(trayIconPath()).resize({
      width: 22,
      height: 22,
    });
    tray = new Tray(image);
    tray.on('click', handleTrayClick);
  }
  const assessmentLocked = !areRequiredPreAssessmentsComplete();
  const pendingSetup = setupPending() && !assessmentLocked;
  const authRequired = !isAuthenticated;
  let setupLabel = 'Continue Setup';
  if (authRequired) setupLabel = 'Sign in';
  else if (isOnboardingComplete()) setupLabel = 'Open Model Setup';
  const sleeping = cocoSleeping;
  const showAvatarItems = avatarRecoveryItems(hideAvatarMode, () => {
    const result = updateAvatarVisibilitySetting(false);
    if (!result.success) {
      dialog.showErrorBox(
        'Could not show Coco',
        result.error || 'Please try again.',
      );
    }
  });
  const updateMenuItems: Electron.MenuItemConstructorOptions[] =
    desktopAppUpdater.isSupported()
      ? [
          {
            label: 'Check for Updates…',
            click: () => {
              void desktopAppUpdater.checkForUpdates(true);
            },
          },
        ]
      : [];
  tray.setToolTip(
    pendingSetup ? 'Coco' : `Coco — ${sleeping ? 'Sleeping' : 'Awake'}`,
  );
  tray.setContextMenu(
    Menu.buildFromTemplate(
      assessmentLocked
        ? [
            ...showAvatarItems,
            {
              label: 'Pre-assessments required',
              enabled: false,
            },
            {
              label: 'Open Pre-assessments…',
              click: openTraining,
            },
            ...updateMenuItems,
            { type: 'separator' },
            { label: 'Quit', click: () => app.quit() },
          ]
        : pendingSetup
          ? [
              ...showAvatarItems,
              {
                label: setupLabel,
                click: openPrimaryTrayAction,
              },
              ...(isAuthenticated
                ? [{ label: 'Training', click: openTraining }]
                : []),
              ...updateMenuItems,
              { type: 'separator' },
              { label: 'Quit', click: () => app.quit() },
            ]
          : [
              ...showAvatarItems,
              {
                label: sleeping ? 'Status: Sleeping' : 'Status: Awake',
                enabled: false,
              },
              ...(studyAccessStatus === 'unavailable'
                ? [{ label: 'Could not refresh study access — retrying…', enabled: false }]
                : !tutoringAllowed
                  ? [{ label: 'AI tutoring unavailable for this account', enabled: false }]
                  : []),
              { type: 'separator' },
              ...cocoNavigationItems({
                'open-main-window': openPrimaryTrayAction,
                'open-training': openTraining,
                'open-chat-settings': openChatSettings,
              }),
              { type: 'separator' },
              {
                label: sleeping ? 'Wake Coco' : 'Sleep',
                click: () => {
                  setCocoSleepMode(!sleeping).catch((err) =>
                    log.warn(`[Tray] Could not change sleep mode: ${err}`),
                  );
                },
              },
              ...updateMenuItems,
              { type: 'separator' },
              { label: 'Quit', click: () => app.quit() },
            ],
    ),
  );
}

function openHistory(): void {
  openAvatarHistory();
}

function applyAvatarVisibility(hidden: boolean): void {
  hideAvatarMode = hidden;
  createTray();
  if (hidden) {
    avatarWindow?.hide();
    return;
  }
  createAvatarWindow();
  avatarWindow?.show();
}

const activateBridgeConversation = (sessionId: string) => {
  const tutorPort = process.env.TUTOR_PORT || '8081';
  axios
    .post(
      `http://127.0.0.1:${tutorPort}/agent/active/${encodeURIComponent(sessionId)}`,
      {},
      {
        headers: { Authorization: `Bearer ${piBridgeToken}` },
        timeout: 3000,
      },
    )
    .catch((error) =>
      log.warn('[Chat] Could not sync foreground conversation:', error.message),
    );
};

// Open the chat panel for a session, pushing the session context (and an
// optional observation to send now or attach to the user's next message).
const openChatForSession = (
  sessionId: string,
  problemStatement: string,
  seed?: ChatSeed,
  preserveDraft = false,
) => {
  activateBridgeConversation(sessionId);
  const alreadyLoaded = chatWindow && !chatWindow.isDestroyed();
  showChatPanel();
  if (!chatWindow) return;

  const send = () => {
    chatWindow?.webContents.send('session-init', {
      sessionId,
      problemStatement,
      tutorModelId: currentTutorModelId,
      preserveDraft,
    });
    if (seed) chatWindow?.webContents.send('help-request', seed);
  };
  if (alreadyLoaded) {
    send();
  } else {
    chatWindow.webContents.once('did-finish-load', () =>
      setTimeout(send, CHAT_RENDERER_READY_DELAY_MS),
    );
  }
};

// Open a conversation surface without starting or recording a session. Any
// suggestion context is held until the user submits their own non-empty turn;
// that first turn then starts a regular `user_message` session.
const openDraftChat = (problemStatement: string, seed?: ChatSeed): string => {
  if (!isSessionActive && currentSessionId) {
    openChatForSession(currentSessionId, problemStatement, seed);
    log.info(`[Chat] Reused existing draft: ${currentSessionId}`);
    return currentSessionId;
  }
  const draftSessionId = randomUUID();
  currentSessionId = draftSessionId;
  const modelConfig = readModelConfiguration();
  currentTutorModelId = modelConfig ? defaultTutor(modelConfig).id : null;
  openChatForSession(draftSessionId, problemStatement, seed);
  log.info(`[Chat] Draft opened without starting a session: ${draftSessionId}`);
  return draftSessionId;
};

// ── Session-recap floating window ────────────────────────────────────────────
// Generates a local recap from TutorSystem's in-memory conversation history.
// 'check' is the user's own "Check my understanding" quiz, after which the
// session continues; 'end' is the end-of-session recap, which ends it.
type SessionRecapMode = 'check' | 'end';
let sessionRecapMode: SessionRecapMode = 'end';

const showSessionRecapWindow = (
  mode: SessionRecapMode,
  conversation?: StoredConversation,
) => {
  if (!tutoringAllowed) return;
  sessionRecapWindow?.destroy();
  sessionRecapMode = mode;

  const {
    x: dx,
    y: dy,
    width: sw,
    height: sh,
  } = screen.getPrimaryDisplay().workArea;
  const w = Math.min(780, sw - 32);
  const h = Math.min(620, sh - 32);

  sessionRecapWindow = new BrowserWindow({
    show: false,
    x: dx + Math.round((sw - w) / 2),
    y: dy + Math.round((sh - h) / 2),
    width: w,
    height: h,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: process.platform !== 'darwin',
    webPreferences: { preload: preloadPath() },
  });
  if (process.platform === 'darwin') {
    sessionRecapWindow.excludedFromShownWindowsMenu = true;
  }

  sessionRecapWindow.loadURL(
    `${resolveHtmlPath('index.html')}?view=session-recap`,
  );

  const tutorPort = process.env.TUTOR_PORT || '8081';
  const recapSessionId = conversation?.sessionId ?? currentSessionId;
  const recapUserId = currentUserId;
  const recapWindow = sessionRecapWindow;
  sessionRecapContext = { sessionId: recapSessionId, userId: recapUserId };
  const recapPromise: Promise<object | null> = axios
    .post(
      `http://127.0.0.1:${tutorPort}/recap`,
      conversation
        ? { messages: restorableMessages(conversation.messages) }
        : {},
      { timeout: 45_000 },
    )
    .then((response) => {
      const data = response.data as object;
      if (recapSessionId && recapUserId) {
        saveLearningRecap(app.getPath('userData'), {
          sessionId: recapSessionId,
          userId: recapUserId,
          generatedAt: Date.now() / 1000,
          recap: data,
        });
      }
      return data;
    })
    .catch((error) => {
      log.warn(`[SessionRecap] Could not generate recap: ${error}`);
      return null;
    });

  recapWindow.on('ready-to-show', async () => {
    recapWindow.show();
    recapWindow.webContents.send('session-recap-init', { mode });
    const data = await recapPromise;
    if (!recapWindow.isDestroyed()) {
      recapWindow.webContents.send('session-recap-data', {
        data,
        error: data === null,
      });
    }
  });

  recapWindow.on('closed', () => {
    if (sessionRecapWindow === recapWindow) {
      sessionRecapWindow = null;
      sessionRecapContext = null;
    }
  });
};

// ── IPC handlers ──────────────────────────────────────────────────────────────
// Use removeAllListeners before each .on() so hot-reloads in development never
// accumulate duplicate handlers (which would fire multiple notifications).

// ── Onboarding ────────────────────────────────────────────────────────────────

// The allowlist is embedded in services/config.json when packaging. Both the
// onboarding and Settings renderers use this value, while the main process also
// enforces it before persisting or applying a scenario.
ipcMain.handle('get-supported-modes', () => serviceManager.getSupportedModes());

const allowedScenario = (value: unknown): AgentModeId => {
  const supportedModes = serviceManager.getSupportedModes();
  return typeof value === 'string' &&
    supportedModes.includes(value as AgentModeId)
    ? (value as AgentModeId)
    : supportedModes[0];
};

const sanitizeProfileMode = (profile: object): Record<string, unknown> => {
  const next = { ...(profile as Record<string, unknown>) };
  next.tutorScenario = allowedScenario(next.tutorScenario);
  if (next.tutorScenario !== 'custom') next.customSystemPrompt = '';
  return next;
};

// Returns the saved onboarding profile so renderer/webapp code can read it
// without needing filesystem access. Returns null if the profile doesn't exist.
ipcMain.handle('get-profile', () => {
  try {
    const raw = fs.readFileSync(profilePath(), 'utf-8');
    const profile = JSON.parse(raw);
    if (!currentUserId || profile?.participantId !== currentUserId) return null;
    return sanitizeProfileMode(profile);
  } catch {
    return null;
  }
});

ipcMain.handle('get-chat-content-zoom-factor', () => chatContentZoomFactor);

// Model/provider configuration is owned by the main process. The renderer sees
// only masked credential status; plaintext keys are accepted on save and never
// returned over IPC.
ipcMain.handle('get-model-configuration', () => getModelConfigurationView());
ipcMain.handle('get-llm-router-status', () => ({
  configured: isLlmRouterConfigured(),
  url: process.env.LLM_ROUTER_URL?.trim() || '',
}));

type ModelHealthAssessment = {
  status: 'verified' | 'failed' | 'connecting' | 'legacy_unassessed' | 'not_configured';
  detail: string;
};
const modelHealthCache = new Map<
  string,
  { checkedAt: number; assessment: ModelHealthAssessment }
>();
const modelHealthInFlight = new Map<string, Promise<ModelHealthAssessment>>();
const MODEL_HEALTH_CACHE_MS = 30 * 60 * 1000;

ipcMain.handle(
  'get-service-health',
  async (
    _event,
    { forceModelTest = false }: { forceModelTest?: boolean } = {},
  ) => {
    // Combined health checks are paused while sensing is intentionally stopped.
    // The tutor remains available for manual conversations.
    if (!tutoringAllowed) throw new Error('AI tutoring is not available for this account.');
    if (cocoSleeping) {
      return { checkedAt: Date.now(), sleeping: true };
    }
    type ModelAssessment = {
      status: ModelHealthAssessment['status'];
      detail: string;
    };
    const savedConfig = readModelConfiguration();
    const assessModelConfiguration = async (
      role: 'sensing' | 'tutor',
    ): Promise<ModelAssessment> => {
      // Account policy can become available before its router credential.
      // Do not fall through to provider-key checks during that sign-in window.
      if (process.env.LLM_ROUTER_URL?.trim() && !process.env.LLM_ROUTER_API_KEY?.trim())
        return {status:'connecting',detail:'Coco is connecting your account to its model service. Please wait a moment.'};
      const connection =
        role === 'sensing'
          ? savedConfig?.sensing
          : (savedConfig?.tutors.find(
              (item) => item.id === currentTutorModelId,
            ) ??
            savedConfig?.tutors.find(
              (item) => item.id === savedConfig.defaultTutorId,
            ));
      if (connection) {
        const cacheKey = `${role}:${JSON.stringify(connection)}`;
        const cached = modelHealthCache.get(cacheKey);
        if (
          !forceModelTest &&
          cached &&
          Date.now() - cached.checkedAt < (cached.assessment.status === 'verified' ? MODEL_HEALTH_CACHE_MS : 5000)
        ) {
          return cached.assessment;
        }
        const existingTest = modelHealthInFlight.get(cacheKey);
        if (existingTest) return existingTest;
        const test = (async (): Promise<ModelHealthAssessment> => {
          const result = await testModelConnection(null, { role, connection });
          const assessment: ModelHealthAssessment = result.success
            ? {
                status: 'verified',
                detail: result.message || 'Model connection verified.',
              }
            : {
                status: 'failed',
                detail: result.error || 'The model connection test failed.',
              };
          modelHealthCache.set(cacheKey, { checkedAt: Date.now(), assessment });
          return assessment;
        })();
        modelHealthInFlight.set(cacheKey, test);
        try {
          return await test;
        } finally {
          modelHealthInFlight.delete(cacheKey);
        }
      }
      const legacyModel =
        role === 'sensing'
          ? process.env.OBSERVER_MODEL
          : process.env.TUTOR_MODEL;
      if (legacyModel?.trim()) {
        return {
          status: 'legacy_unassessed',
          detail:
            'Model uses environment settings and cannot be assessed here.',
        };
      }
      return {
        status: 'not_configured',
        detail: 'No model configuration was found.',
      };
    };

    const checkService = async (
      url: string,
      expectedService: 'coco-sensing' | 'coco-tutor',
      modelAssessment: ModelAssessment,
    ) => {
      try {
        const response = await axios.get(url, { timeout: 2500 });
        const data = response.data as {
          status?: unknown;
          service?: unknown;
          total_actions?: unknown;
        };
        if (data?.service !== expectedService) {
          return {
            connected: false,
            status: 'wrong-service',
            detail: 'This port is occupied by another process.',
            modelAssessment,
          };
        }
        return {
          connected: true,
          status: typeof data?.status === 'string' ? data.status : 'healthy',
          modelAssessment,
          ...(typeof data?.total_actions === 'number'
            ? { totalActions: data.total_actions }
            : {}),
        };
      } catch (error) {
        let detail = 'Service is not reachable.';
        if (axios.isAxiosError(error)) {
          const responseData = error.response?.data as
            | { detail?: unknown }
            | undefined;
          if (
            typeof responseData?.detail === 'string' &&
            responseData.detail.trim()
          ) {
            detail = responseData.detail;
          } else if (error.code === 'ECONNREFUSED') {
            detail = 'Service is not running.';
          } else if (error.code === 'ECONNABORTED') {
            detail = 'Health check timed out.';
          } else if (error.message) {
            detail = error.message;
          }
        } else if (error instanceof Error) {
          detail = error.message;
        }
        return {
          connected: false,
          status: 'unavailable',
          detail,
          modelAssessment,
        };
      }
    };

    const sensingPort = process.env.SENSING_PORT || '8080';
    const tutorPort = process.env.TUTOR_PORT || '8081';
    const [sensingAssessment, tutorAssessment] = await Promise.all([
      assessModelConfiguration('sensing'),
      assessModelConfiguration('tutor'),
    ]);
    const [sensing, tutor] = await Promise.all([
      checkService(
        `http://127.0.0.1:${sensingPort}/health`,
        'coco-sensing',
        sensingAssessment,
      ),
      checkService(
        `http://127.0.0.1:${tutorPort}/health`,
        'coco-tutor',
        tutorAssessment,
      ),
    ]);

    const starting = <T extends {connected:boolean;status:string;modelAssessment:ModelAssessment}>(health:T) =>
      !health.connected && health.status === 'unavailable' && health.modelAssessment.status === 'connecting'
        ? {...health,status:'starting',detail:'Coco’s local service will start when sign-in finishes.'} : health;
    return { checkedAt: Date.now(), sensing:starting(sensing), tutor:starting(tutor) };
  },
);

async function testModelConnection(
  _event: unknown,
  {
    role,
    connection,
    apiKey,
  }: {
    role?: 'sensing' | 'tutor';
    connection?: ModelConnection;
    apiKey?: string;
  } = {},
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!tutoringAllowed)
    return {
      success: false,
      error: 'AI tutoring is disabled for this account.',
    };
  if ((role !== 'sensing' && role !== 'tutor') || !connection) {
    return { success: false, error: 'Invalid model test request.' };
  }
  try {
    const prepared = prepareModelConnectionTest(connection, role, apiKey ?? '');
    const providerEnvNames = new Set([
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'GOOGLE_API_KEY',
      'OPENAI_API_KEY',
      'TINFOIL_API_KEY',
      'HOSTED_VLLM_API_KEY',
      'HOSTED_VLLM_API_BASE',
      'LM_STUDIO_HOST',
      'OA_TICKET_FILE',
      'OA_DESTINATION',
      'OA_BASE_URL',
    ]);
    const childEnv = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([name]) => !providerEnvNames.has(name),
        ),
      ),
      ...prepared.env,
      PYTHONIOENCODING: 'utf-8',
    };
    const executable = app.isPackaged
      ? path.join(
          process.resourcesPath,
          'service-dist',
          'coco-services',
          `tutor-server${process.platform === 'win32' ? '.exe' : ''}`,
        )
      : developmentPython(path.resolve(app.getAppPath(), '..'));
    const args = app.isPackaged
      ? [
          '--test-model-connection',
          '--model',
          prepared.connection.model,
          ...(role === 'sensing' ? ['--include-image'] : []),
        ]
      : [
          '-m',
          'proactive_tutor.model_connection_test',
          '--model',
          prepared.connection.model,
          ...(role === 'sensing' ? ['--include-image'] : []),
        ];
    const cwd = app.isPackaged
      ? path.dirname(executable)
      : path.resolve(app.getAppPath(), '..');
    const probeEnv = app.isPackaged ? { ...childEnv, LITELLM_LOCAL_MODEL_COST_MAP: 'True' } : pythonEnvironment(cwd, childEnv);
    const result = await runModelProbe(executable, args, { cwd, env: probeEnv });
    const parsed = result.stdout
      .trim()
      .split('\n')
      .reverse()
      .map((line) => {
        try {
          return JSON.parse(line) as { success?: boolean; error?: string };
        } catch {
          return null;
        }
      })
      .find((item) => item !== null);
    if (result.code === 0 && parsed?.success) {
      return {
        success: true,
        message:
          role === 'sensing'
            ? 'Connected — text and image input accepted.'
            : 'Connected — text input accepted.',
      };
    }
    const rawError =
      parsed?.error || result.stderr.trim() || 'Connection failed.';
    const redactedError = apiKey
      ? rawError.split(apiKey).join('[redacted]')
      : rawError;
    log.warn(`[ModelHealth] ${role}: ${redactedError}`);
    return { success: false, error: modelFailureMessage(redactedError) };
  } catch (err) {
    const rawError = (err as Error).message;
    return {
      success: false,
      error: modelFailureMessage(apiKey ? rawError.split(apiKey).join('[redacted]') : rawError),
    };
  }
}

ipcMain.handle('test-model-connection', testModelConnection);

async function restoreSessionAfterModelRestart(): Promise<void> {
  if (!currentSessionId) return;
  const conversation = readConversations().find(
    (item) => item.sessionId === currentSessionId,
  );
  const tutorPort = process.env.TUTOR_PORT || '8081';
  const sensingPort = process.env.SENSING_PORT || '8080';
  const tutor = `http://127.0.0.1:${tutorPort}`;
  const sensing = `http://127.0.0.1:${sensingPort}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await Promise.all([
        axios.get(`${tutor}/health`, { timeout: 1000 }),
        ...(!isObservationPaused()
          ? [axios.get(`${sensing}/health`, { timeout: 1000 })]
          : []),
      ]);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const { aiTools, scenario, customObserverPrompt, userName } = readProfile();
  await axios.post(`${tutor}/config/scenario`, { scenario }, { timeout: 8000 });
  await axios.post(
    `${tutor}/context/problem_statement`,
    { problem_statement: conversation?.problem || pendingTaskLabel || '' },
    { timeout: 8000 },
  );
  await axios.post(
    `${tutor}/context/ai_tools`,
    { ai_tools: aiTools },
    { timeout: 8000 },
  );
  await axios.post(
    `${tutor}/context/user_name`,
    { user_name: userName },
    { timeout: 8000 },
  );
  const memory = readLocalMemory();
  if (memory) {
    await axios.post(`${tutor}/context/memory`, { memory }, { timeout: 8000 });
  }
  if (conversation) {
    await axios.post(
      `${tutor}/context/conversation`,
      { messages: restorableMessages(conversation.messages) },
      { timeout: 8000 },
    );
  }
  if (!isObservationPaused())
    await axios.post(
      `${sensing}/session`,
      {
        node_uuid: currentSessionId,
        struggle_detection_seconds: sessionStruggleSeconds,
        scenario,
        config_source: 'model_settings_restart',
        ...(customObserverPrompt && {
          custom_observer_prompt: customObserverPrompt,
        }),
      },
      { timeout: 15000 },
    );
}

ipcMain.handle(
  'save-model-configuration',
  async (_event, input: ModelConfigurationInput) => {
    try {
      const config = saveModelConfiguration(input);
      sendToChat('model-configuration-updated', null);
      modelHealthCache.clear();
      const runtime = resolveModelRuntime();
      if (observerStarted && runtime) {
        const defaultTutorModel = defaultTutor(runtime.config);
        const activeTutorModel =
          runtime.config.tutors.find(
            (item) => item.id === currentTutorModelId,
          ) ?? defaultTutorModel;
        currentTutorModelId = activeTutorModel.id;
        process.env.TUTOR_MODEL = defaultTutorModel.model;
        process.env.OBSERVER_MODEL = runtime.config.sensing.model;
        await Promise.all([
          serviceManager.stopService('tutor-server'),
          serviceManager.stopService('sensing-server'),
        ]);
        serviceManager.configureServiceEnv(
          'tutor-server',
          runtime.tutorEnv,
          true,
        );
        serviceManager.configureServiceEnv(
          'sensing-server',
          runtime.sensingEnv,
          true,
        );
        serviceManager.configureServiceArg(
          'tutor-server',
          'model_name',
          activeTutorModel.model,
        );
        serviceManager.configureServiceArg(
          'sensing-server',
          'observer_model',
          runtime.config.sensing.model,
        );
        serviceManager.startService('tutor-server');
        if (!isObservationPaused()) serviceManager.startService('sensing-server');
        try {
          await restoreSessionAfterModelRestart();
        } catch (err) {
          log.warn(
            `[Models] Services restarted but active session restoration failed: ${(err as Error).message}`,
          );
        }
      }
      return { success: true, config };
    } catch (err) {
      log.warn(
        `[Models] Could not save configuration: ${(err as Error).message}`,
      );
      return { success: false, error: (err as Error).message };
    }
  },
);

ipcMain.handle(
  'set-chat-model',
  async (event, { modelId }: { modelId?: string } = {}) => {
    if (
      !chatWindow ||
      event.sender !== chatWindow.webContents ||
      !isAuthenticated ||
      !modelTraining.canPick(currentUserId)
    )
      return {
        success: false,
        error:
          'Complete Agent 101 Chapter 4 · Models to unlock the model picker.',
      };
    if (
      agentRuns.has(currentSessionId) ||
      modelTraining.get(currentSessionId, currentUserId)
    )
      return {
        success: false,
        error:
          'Finish this comparison and open a regular chat to choose a model.',
      };
    const config = readModelConfiguration();
    const selected = config?.tutors.find((item) => item.id === modelId);
    if (!selected) return { success: false, error: 'Tutor model not found.' };
    const tutorPort = process.env.TUTOR_PORT || '8081';
    try {
      await axios.post(
        `http://127.0.0.1:${tutorPort}/config/model`,
        { model: selected.model },
        { timeout: 8000 },
      );
      currentTutorModelId = selected.id;
      return { success: true, modelId: selected.id };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
);

// Persist profile edits made post-onboarding (the Settings surface in the
// webapp).
ipcMain.handle('save-profile', (_event, profile: object) => {
  try {
    const participantProfile = {
      ...(profile as Record<string, unknown>),
      participantId: currentUserId,
      ...(app.isPackaged
        ? { onboardingVersion: PACKAGED_ONBOARDING_VERSION }
        : {}),
    };
    fs.writeFileSync(
      profilePath(),
      JSON.stringify(sanitizeProfileMode(participantProfile), null, 2),
      'utf-8',
    );
    log.info('[Settings] Profile saved:', profilePath());
    return { success: true };
  } catch (err) {
    log.error('[Settings] Failed to save profile:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.on('onboarding-complete', (_event, profile: object) => {
  if (
    !isAuthenticated ||
    (profile as { onboardingComplete?: unknown }).onboardingComplete !== true
  ) return;
  // Write the profile so isOnboardingComplete() returns true on next launch.
  try {
    const participantProfile = {
      ...(profile as Record<string, unknown>),
      participantId: currentUserId,
      ...(app.isPackaged
        ? { onboardingVersion: PACKAGED_ONBOARDING_VERSION }
        : {}),
    };
    fs.writeFileSync(
      profilePath(),
      JSON.stringify(sanitizeProfileMode(participantProfile), null, 2),
      'utf-8',
    );
    log.info('[Onboarding] Profile saved:', profilePath());
  } catch (err) {
    log.error('[Onboarding] Failed to save profile:', err);
    return;
  }

  // Start the observer now that the user has completed or skipped onboarding.
  startObserver();

  // Close setup first. The avatar joins only after Training has rendered.
  const completedWindow = onboardingWindow;
  if (completedWindow && !completedWindow.isDestroyed()) {
    completedWindow.once('closed', openAfterSetup);
    completedWindow.close();
  } else {
    openAfterSetup();
  }
});

ipcMain.removeAllListeners('hide-onboarding');
ipcMain.on('hide-onboarding', () => {
  clearSetupGuide();
  onboardingWindow?.hide();
  createTray();
});

ipcMain.removeAllListeners('model-configuration-complete');
ipcMain.on('model-configuration-complete', () => {
  // Existing users sent directly to model setup already have a profile. Once
  // models are saved, start (or restart) the services and reveal the app
  // without making them repeat the rest of onboarding.
  startObserver();
  if (onboardingWindow && !onboardingWindow.isDestroyed()) onboardingWindow.once('closed', openAfterSetup);
  else openAfterSetup();
});

// The chat renderer announces (on mount) that its hot-key-capture listener is
// live. Flush any captures that arrived before it was ready — this handshake is
// what lets the hot key open the chat AND attach the screenshot reliably.
ipcMain.removeAllListeners('hotkey-capture-ready');
ipcMain.on('hotkey-capture-ready', () => {
  hotkeyRendererReady = true;
  flushHotkeyCaptures();
});

// Pet click / "open chat". If a session is already active, reopen its chat
// panel; otherwise start a fresh local session so there is a conversation to
// show (the sensing observer keeps running either way).
ipcMain.removeAllListeners('open-main-window');
ipcMain.on('open-main-window', () => {
  openCoco().catch((err) => log.warn(`[Chat] Could not open Coco: ${err}`));
});

// "Help me with this" on a proactive bubble.
//   • Active session  → open the chat panel and inject the observation as a new
//     message into the existing conversation.
//   • No active session → this IS accepting the invite: create a tutor session
//     seeded with what the user was doing, then inject the observation as the
//     first message once the chat panel has loaded.
ipcMain.removeAllListeners('help-me-with-this');
ipcMain.on(
  'help-me-with-this',
  async (
    _event,
    payload: { phrase: string; label: string; rawObservation: string },
  ) => {
    const screenObservation = payload?.rawObservation?.trim() || undefined;
    if (isSessionActive && currentSessionId) {
      // The observation goes along as screen context, not as the message.
      openChatForSession(currentSessionId, pendingTaskLabel || '', {
        phrase: payload?.phrase ?? '',
        label: payload?.label ?? '',
        rawObservation: 'Help me with this.',
        screenObservation,
      });
      return;
    }

    // Pre-session: opening help is not acceptance of a coaching session. Keep
    // the observation as context for the user's first actual message.
    const problemStatement =
      payload?.phrase?.trim() ||
      payload?.label?.trim() ||
      pendingTaskLabel ||
      'General help session';
    openDraftChat(problemStatement, {
      phrase: '',
      label: payload?.label ?? '',
      rawObservation: '',
      screenObservation,
      deferUntilUserMessage: true,
    });
  },
);

ipcMain.removeAllListeners('open-notification-suggestion');
ipcMain.on(
  'open-notification-suggestion',
  async (
    _event,
    payload: {
      observationId?: string;
      status?: string;
      rawObservation?: string;
    },
  ) => {
    proactive.dismissNotification();
    const rawObservation = payload?.rawObservation?.trim() || '';
    const status = payload?.status || 'observing';
    const observationId = payload?.observationId;
    // The observation goes along as screen context, not as the message.
    const seed: ChatSeed = {
      phrase: '',
      label: status.replace(/_/g, ' '),
      rawObservation: 'Help me with this.',
      ...(rawObservation && { screenObservation: rawObservation }),
    };

    if (observationId) {
      recordSupportEngagement(observationId, {
        engagedAt: Math.floor(Date.now() / 1000),
        destination: 'conversation',
      });
    }
    const sensingPort = process.env.SENSING_PORT || '8080';
    axios
      .post(
        `http://127.0.0.1:${sensingPort}/feedback`,
        {
          kind: 'engage',
          surface: 'notification',
          observation_id: observationId ?? null,
          status,
          text: rawObservation,
        },
        { timeout: 3000 },
      )
      .catch((err) => {
        log.warn(`[Feedback] failed to post: ${(err as Error).message}`);
      });

    if (isSessionActive && currentSessionId) {
      openChatForSession(currentSessionId, pendingTaskLabel || '', seed);
    } else {
      openDraftChat(rawObservation || 'General help session', {
        ...seed,
        rawObservation: '',
        deferUntilUserMessage: true,
      });
    }
  },
);

// Forward an explicit user reaction (bubble engage/dismiss) to the sensing
// server's /feedback endpoint, which logs it into the shared training data.
ipcMain.removeAllListeners('training-feedback');
ipcMain.on('training-feedback', async (_event, payload) => {
  try {
    const sensingPort = process.env.SENSING_PORT || '8080';
    await axios.post(
      `http://127.0.0.1:${sensingPort}/feedback`,
      payload ?? {},
      {
        timeout: 3000,
      },
    );
  } catch (err) {
    log.warn(
      `[Feedback] failed to post: ${(err as { message?: string })?.message}`,
    );
  }
});

function publishCocoSleepMode() {
  const state = { sleeping: cocoSleeping, tutoringAllowed };
  avatarWindow?.webContents.send('coco-sleep-mode-changed', state);
  avatarMenuWindow?.webContents.send('coco-sleep-mode-changed', state);
  chatWindow?.webContents.send('coco-sleep-mode-changed', state);
  wakeWordCaptureWindow?.webContents.send('coco-sleep-mode-changed', state);
  if (tray && !tray.isDestroyed()) createTray();
  return state;
}

function setTutoringAllowed(allowed: boolean) {
  const changed = tutoringAllowed !== allowed;
  tutoringAllowed = allowed;
  process.env.COCO_TUTORING_ALLOWED = allowed ? '1' : '0';
  if (changed) publishCocoSleepMode();
}

ipcMain.removeHandler('get-coco-sleep-mode');
ipcMain.handle('get-coco-sleep-mode', () => ({
  sleeping: cocoSleeping,
  tutoringAllowed,
}));

async function restoreSensingSession() {
  const sessionId = currentSessionId;
  if (!isSessionActive || !sessionId) return;
  const { scenario, customObserverPrompt } = readProfile();
  const sensingPort = process.env.SENSING_PORT || '8080';
  try {
    await retryOperation(
      () =>
        axios.post(
          `http://127.0.0.1:${sensingPort}/session`,
          {
            node_uuid: sessionId,
            struggle_detection_seconds: sessionStruggleSeconds,
            scenario,
            config_source: 'settings',
            preserve_tutor_context: true,
            ...(customObserverPrompt && {
              custom_observer_prompt: customObserverPrompt,
            }),
          },
          { timeout: 15000 },
        ),
      {
        shouldContinue: () =>
          !isObservationPaused() &&
          isSessionActive &&
          currentSessionId === sessionId,
      },
    );
  } catch (error) {
    if (!(error instanceof RetryCancelledError))
      log.warn('[Sleep] Could not restore sensing session:', error);
  }
}

async function setCocoSleepMode(sleeping: boolean) {
  if (cocoSleeping === sleeping) {
    return { success: true, sleeping };
  }

  // Suppress observation events before stopping sensing, including suggestions
  // that were already being generated. Manual conversations keep running.
  cocoSleeping = sleeping;
  log.info(`[Sleep] User selected ${sleeping ? 'sleep' : 'wake'}.`);
  publishCocoSleepMode();
  syncWakeWordService();

  if (sleeping) {
    clearAvatarInvite('ignored');
    proactive.invalidateInvite();
    latestHiddenSuggestionObservationId = undefined;
    suggestionCache.clear();
    proactive.setHovered(false);
    proactive.dismissNotification();
    // Sensing may restart independently of the tutor, whose context must survive.
    serviceManager.configureServiceEnv('sensing-server', {
      COCO_RESET_TUTOR_ON_START: '0',
    });
    await serviceManager.stopService('sensing-server');
  } else if (tutoringAllowed && observerStarted) {
    serviceManager.startService('sensing-server');
    await restoreSensingSession();
  } else if (tutoringAllowed && isOnboardingComplete()) {
    startObserver();
  }

  return { success: true, sleeping: cocoSleeping };
}

ipcMain.removeHandler('set-coco-sleep-mode');
ipcMain.handle(
  'set-coco-sleep-mode',
  async (_event, { sleeping }: { sleeping?: boolean } = {}) => {
    if (typeof sleeping !== 'boolean') {
      return { success: false, error: 'Invalid sleep mode.' };
    }
    try {
      return await setCocoSleepMode(sleeping);
    } catch (error) {
      log.error('[Sleep] Could not change Coco sleep mode:', error);
      return {
        success: false,
        sleeping: cocoSleeping,
        error: (error as Error).message,
      };
    }
  },
);

ipcMain.removeHandler('get-wake-word-settings');
ipcMain.handle('get-wake-word-settings', () => ({
  enabled: wakeWordEnabled,
  keywords: [...WAKE_WORDS],
  capturePaused: wakeWordCapturePaused,
  ...wakeWordStatus,
  logPath: path.join(app.getPath('userData'), 'logs', 'wake-word.log'),
}));

ipcMain.removeHandler('set-wake-word-settings');
ipcMain.handle(
  'set-wake-word-settings',
  async (_event, { enabled }: { enabled?: boolean } = {}) => {
    if (typeof enabled !== 'boolean') {
      return { success: false, error: 'Invalid voice activation setting.' };
    }
    if (
      enabled &&
      process.platform === 'darwin' &&
      systemPreferences.getMediaAccessStatus('microphone') !== 'granted'
    ) {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      if (!granted) {
        return {
          success: false,
          error:
            'Microphone access is required. Enable Coco under Privacy & Security → Microphone.',
        };
      }
    }
    if (
      enabled &&
      process.platform === 'win32' &&
      needsWindowsMicrophoneSettings(
        process.platform,
        systemPreferences.getMediaAccessStatus('microphone'),
      )
    ) {
      const { response } = await dialog.showMessageBox({
        type: 'warning',
        title: 'Microphone permission required',
        message: 'Coco needs microphone access for voice activation.',
        detail:
          'Enable microphone access for desktop apps in Windows Settings, then turn “Listen for Coco” on again.',
        buttons: ['Open Microphone Settings', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (response === 0) {
        await shell.openExternal('ms-settings:privacy-microphone');
      }
      return {
        success: false,
        error:
          'Microphone access is required. Enable microphone access for desktop apps in Windows Settings.',
      };
    }
    wakeWordEnabled = enabled;
    if (!enabled) setWakeWordCapturePaused(false);
    saveWakeWordEnabled(enabled);
    syncWakeWordService();
    const settings = {
      enabled,
      keywords: [...WAKE_WORDS],
      capturePaused: wakeWordCapturePaused,
      ...wakeWordStatus,
    };
    chatWindow?.webContents.send('wake-word-settings-changed', settings);
    wakeWordCaptureWindow?.webContents.send(
      'wake-word-settings-changed',
      settings,
    );
    return { success: true, ...settings };
  },
);

ipcMain.removeHandler('set-wake-word-capture-paused');
ipcMain.handle(
  'set-wake-word-capture-paused',
  (_event, { paused }: { paused?: boolean } = {}) => {
    if (typeof paused !== 'boolean') return { success: false };
    setWakeWordCapturePaused(paused);
    return { success: true, paused };
  },
);

ipcMain.removeAllListeners('wake-word-capture-renderer-ready');
ipcMain.on('wake-word-capture-renderer-ready', (event) => {
  if (
    !wakeWordCaptureWindow ||
    event.sender !== wakeWordCaptureWindow.webContents
  ) {
    return;
  }
  // getUserMedia can remain pending forever in a genuinely hidden renderer on
  // macOS. Keep this 1 px, fully transparent window technically visible.
  wakeWordCaptureWindow.showInactive();
  wakeWordCaptureWindow.webContents.send('wake-word-settings-changed', {
    enabled: wakeWordEnabled,
    keywords: [...WAKE_WORDS],
    capturePaused: wakeWordCapturePaused,
    ...wakeWordStatus,
  });
  setImmediate(() => {
    wakeWordCaptureWindow?.webContents.send('wake-word-capture-window-ready');
  });
  log.info('[Wake word] Microphone capture renderer ready');
});

ipcMain.removeAllListeners('wake-word-detection-ack');
ipcMain.on(
  'wake-word-detection-ack',
  (event, value: { id?: unknown } | undefined) => {
    if (!chatWindow || event.sender !== chatWindow.webContents) return;
    const id = typeof value?.id === 'number' ? value.id : null;
    if (!pendingWakeWordDetection || pendingWakeWordDetection.id !== id) return;
    if (pendingWakeWordDetection.retryTimer) {
      clearTimeout(pendingWakeWordDetection.retryTimer);
    }
    log.info(
      `[Wake word] Chat acknowledged detection ${id} after ${pendingWakeWordDetection.attempts} attempt(s)`,
    );
    pendingWakeWordDetection = null;
  },
);

ipcMain.removeAllListeners('wake-word-capture-status');
ipcMain.on('wake-word-capture-status', (event, value: unknown) => {
  if (
    !wakeWordCaptureWindow ||
    event.sender !== wakeWordCaptureWindow.webContents
  ) {
    return;
  }
  const status = value as { state?: unknown; detail?: unknown } | undefined;
  const state = typeof status?.state === 'string' ? status.state : 'unknown';
  if (state === wakeWordCaptureState && !status?.detail) return;
  wakeWordCaptureState = state;
  const detail = typeof status?.detail === 'string' ? `: ${status.detail}` : '';
  log.info(`[Wake word] Microphone capture ${state}${detail}`);
  chatWindow?.webContents.send('wake-word-capture-status', {
    state,
    detail: typeof status?.detail === 'string' ? status.detail : undefined,
  });
});

ipcMain.removeAllListeners('wake-word-audio-frame');
ipcMain.on('wake-word-audio-frame', (event, frame: unknown) => {
  if (
    !wakeWordEnabled ||
    isObservationPaused() ||
    systemSuspended ||
    wakeWordCapturePaused ||
    !wakeWordCaptureWindow ||
    event.sender !== wakeWordCaptureWindow.webContents
  ) {
    return;
  }
  if (frame instanceof Uint8Array) {
    wakeWordService?.writeAudio(Buffer.from(frame));
  } else if (frame instanceof ArrayBuffer) {
    wakeWordService?.writeAudio(Buffer.from(new Uint8Array(frame)));
  }
});

// ── Chat-panel width toggle ────────────────────────────────────────────────────
// The renderer sends this when the user clicks the expand / collapse button to
// switch the chat between the narrow side panel and a wider reading width.
ipcMain.removeAllListeners('toggle-float-window');
ipcMain.on(
  'toggle-float-window',
  (_event, options?: { expanded?: boolean }) => {
    if (!chatWindow || chatWindow.isDestroyed()) return;
    const nextFloatMode =
      typeof options?.expanded === 'boolean' ? !options.expanded : !isFloatMode;
    if (nextFloatMode !== isFloatMode) {
      isFloatMode = nextFloatMode;
      resizeMainWindow(
        chatWindow,
        isFloatMode ? CHAT_PANEL_W : CHAT_EXPANDED_W,
        screen.getDisplayMatching(chatWindow.getBounds()).workArea,
      );
    }
    chatWindow.webContents.send('float-window-state', { isFloat: isFloatMode });
  },
);

// The chat's close button. Closing from main emits the window's 'close' event,
// which hides the chat (keeping its conversation and any streaming reply)
// rather than destroying it as a renderer-side window.close() would.
ipcMain.removeAllListeners('close-chat-window');
ipcMain.on('close-chat-window', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.on('shell-show-item-in-finder', (event, fullPath) => {
  shell.showItemInFolder(fullPath);
});

// ── Proactive session IPC handlers ────────────────────────────────────────────

// Webapp signals that a tutor session is now active (or has ended).
// Payload: { active: boolean; sessionId?: string }
ipcMain.removeAllListeners('session-active');
ipcMain.on(
  'session-active',
  (_event, payload: { active: boolean; sessionId?: string }) => {
    isSessionActive = payload.active;
    if (payload.active && payload.sessionId) {
      currentSessionId = payload.sessionId;
      // Dismiss the onboarding overlay if still open — a live session takes over.
      if (onboardingWindow && !onboardingWindow.isDestroyed()) {
        onboardingWindow.destroy();
        onboardingWindow = null;
      }
    }
    if (!payload.active) {
      currentSessionId = null;
      // Tell sensing server to revert to pre-session observation mode.
      const sensingPort = process.env.SENSING_PORT || '8080';
      axios
        .post(`http://127.0.0.1:${sensingPort}/session/end`)
        .catch((e) =>
          log.warn('Could not notify sensing server of session end:', e),
        );
    }
    log.info(
      `[ProactiveSession] isSessionActive=${payload.active}, sessionId=${payload.sessionId}`,
    );
  },
);

// Read the user's onboarding profile for the AI tools and tutor mode they
// selected. Returns sensible defaults when the file is missing or malformed.
// Shared by createProactiveTutorSession() and the instant-suggestion precompute.
function readProfile(): {
  aiTools: string[];
  scenario: string;
  customObserverPrompt: string;
  userName: string;
} {
  let aiTools: string[] = [];
  let scenario: string = allowedScenario(undefined);
  let customObserverPrompt = '';
  let userName = '';
  try {
    const profile = JSON.parse(fs.readFileSync(profilePath(), 'utf-8'));
    scenario = allowedScenario(profile.tutorScenario);
    if (Array.isArray(profile.aiTools) && profile.aiTools.length > 0) {
      aiTools = profile.aiTools;
    }
    if (
      typeof profile.customSystemPrompt === 'string' &&
      profile.customSystemPrompt.trim()
    ) {
      customObserverPrompt = profile.customSystemPrompt;
    }
    if (typeof profile.userName === 'string' && profile.userName.trim()) {
      userName = profile.userName.trim();
    }
    // "Custom" mode customizes only the sensing observer prompt. The judge/tutor
    // still run on a real base scenario, so map 'custom' → 'everyday_support'.
    if (scenario === 'custom') {
      scenario = 'everyday_support';
    }
  } catch (err) {
    log.warn(`[Profile] Could not read profile at ${profilePath()}: ${err}.`);
  }
  return { aiTools, scenario, customObserverPrompt, userName };
}

// ── Instant suggestion precompute cache ─────────────────────────────────────
// When a Tier-2 proactive bubble appears we eagerly ask the tutor server for a
// ready-to-use suggestion and cache the in-flight promise keyed by
// observation_id. By the time the user clicks "Help me with this" (a few
// seconds of reading later) the result is usually ready, so it can be revealed
// instantly instead of waiting on a fresh LLM round-trip.
// Suggestions the writer declined, so a click reports why nothing is ready.
const abstainedSuggestionIds = new Set<string>();
const suggestionCache = new Map<
  string,
  { ts: number; promise: Promise<InstantSuggestion | null> }
>();
const loggedProactiveSuggestions = new Set<string>();
const SUGGESTION_TTL_MS = 5 * 60_000;
// Model latency can exceed 12 seconds under load. Keep the eager request alive
// long enough for the notification click to reveal its result instead of
// incorrectly treating a slow generation as a cache failure and opening Chat.
const SUGGESTION_REQUEST_TIMEOUT_MS = 60_000;
// Monotonic counter for synthesizing observation ids on events that lack one.
let syntheticObsSeq = 0;
// Statuses that show a "Help me with this" button (mirrors the renderer's
// TIER2_STATUSES in App.tsx). Only these warrant a precompute.
const PRECOMPUTE_STATUSES = new Set([
  'stuck',
  'mistake',
  'inefficient',
  'ai_struggle',
  'discernment_opportunity',
]);
// Build the list of Open buttons for a delegate suggestion from the user's
// selected tools. The model's chosen tool (`preferredId`) implies whether the
// task calls for a chatbot or an agent. Return only the best matching tool so
// the suggestion never presents a stack of competing "Open" actions. Falls
// back to the first selected tool — then ChatGPT — if that category has none.
function buildAvailableTools(preferredId?: string | null): AiToolButton[] {
  const { aiTools } = readProfile();
  const resolved = resolveAiTools(aiTools, preferredId);
  const category = preferredId ? parseAiTool(preferredId)?.category : undefined;
  const sameCategory = category
    ? resolved.filter((t) => t.category === category)
    : resolved;
  const list =
    sameCategory.length > 0
      ? sameCategory
      : resolved.length > 0
        ? resolved
        : [AI_TOOLS.chatgpt];
  return list.slice(0, 1).map((t) => ({
    id: t.id,
    label: t.label,
    category: t.category,
  }));
}

// Launch a tool per its category/open method. The prompt is already on the
// clipboard; the user pastes it manually (we never auto-run anything).
function openAiTool(toolId: string): void {
  const tool = parseAiTool(toolId);
  if (!tool) return;
  const { open } = tool;
  if (open.via === 'website') {
    shell.openExternal(open.url);
  } else if (process.platform === 'darwin') {
    // macOS: `open -a <App>` launches a desktop app; Terminal opens a new window.
    const app = open.via === 'app' ? open.app : 'Terminal';
    exec(`open -a ${JSON.stringify(app)}`, (err) => {
      if (err) log.warn(`[Suggestion] Failed to open ${app}: ${err.message}`);
    });
  } else {
    log.warn(
      `[Suggestion] Launching ${tool.label} (${open.via}) is only supported on macOS.`,
    );
  }
}

function pruneSuggestionCache() {
  const now = Date.now();
  for (const [key, entry] of suggestionCache) {
    if (now - entry.ts > SUGGESTION_TTL_MS) suggestionCache.delete(key);
  }
}

// Fire the suggestion request for a freshly shown Tier-2 observation and stash
// the promise. Never throws — failures resolve to null so the click path falls
// back to the existing chat flow.
function precomputeSuggestion(event: SuggestionObservation): Promise<InstantSuggestion | null> | undefined {
  const id = event.observation_id;
  if (!id || isObservationPaused()) return undefined;
  const cached = suggestionCache.get(id);
  if (cached) return cached.promise;
  pruneSuggestionCache();

  const { aiTools, scenario } = readProfile();
  const tutorPort = process.env.TUTOR_PORT || '8081';
  const startedAt = Date.now();
  log.info(
    `[InstantSuggestion] precompute start id=${id} status=${event.status}`,
  );
  const promise = axios
    .post(
      `http://127.0.0.1:${tutorPort}/suggestion/instant`,
      {
        observation: event.observation ?? '',
        image_paths: event.image_paths?.length ? event.image_paths : null,
        task_label: event.task_label ?? null,
        scenario: event.scenario || scenario,
        ai_tools: aiTools,
      },
      { timeout: SUGGESTION_REQUEST_TIMEOUT_MS },
    )
    .then((resp) => {
      if ((resp.data as { kind?: string }).kind === 'abstain') {
        // The suggestion writer found nothing worth showing. Show nothing, and
        // tell sensing so the Judge and observer learn this moment didn't fit.
        abstainedSuggestionIds.add(id);
        log.info(
          `[InstantSuggestion] abstained id=${id} in ${Date.now() - startedAt}ms`,
        );
        const sensingPort = process.env.SENSING_PORT || '8080';
        axios
          .post(
            `http://127.0.0.1:${sensingPort}/feedback`,
            {
              kind: 'abstain',
              surface: hideAvatarMode ? 'notification' : 'bubble',
              observation_id: id,
              status: event.status ?? null,
              text: 'No useful AI-skills suggestion fit this moment.',
            },
            { timeout: 3000 },
          )
          .catch((err) => {
            log.warn(
              `[Feedback] failed to post abstention: ${(err as Error).message}`,
            );
          });
        return null;
      }
      const data = {
        ...(resp.data as InstantSuggestion),
        triggerType: event.trigger_type ?? event.status,
        teachingDepth:
          (resp.data as InstantSuggestion).teachingDepth ??
          (event.teaching_depth === 'not_applicable'
            ? undefined
            : event.teaching_depth),
        interventionSource:
          event.intervention_source === 'judge' ? 'judge' : 'observer',
      } as InstantSuggestion;
      recordSupportSuggestion(id, data);
      log.info(
        `[InstantSuggestion] precompute ready id=${id} kind=${data?.kind} in ${Date.now() - startedAt}ms`,
      );
      return data;
    })
    .catch((err) => {
      log.warn(
        `[InstantSuggestion] precompute failed for ${id} after ${Date.now() - startedAt}ms: ${(err as { message?: string })?.message}`,
      );
      return null;
    });
  suggestionCache.set(id, { ts: Date.now(), promise });
  return promise;
}

// Renderer asks for the precomputed suggestion when the user clicks "Help me".
// Returns a status the renderer uses to decide between instant reveal and the
// fallback chat flow. Awaits the in-flight promise if it isn't ready yet.
ipcMain.removeHandler('get-instant-suggestion');
ipcMain.handle(
  'get-instant-suggestion',
  async (_event, { observationId }: { observationId?: string }) => {
    if (!tutoringAllowed || postAssessmentActive) return { status: 'missing' };
    const entry = observationId
      ? suggestionCache.get(observationId)
      : undefined;
    if (!entry) {
      log.info(
        `[InstantSuggestion] click: cache MISS id=${observationId ?? '(none)'} — falling back to chat`,
      );
      return { status: 'missing' };
    }
    if (Date.now() - entry.ts > SUGGESTION_TTL_MS) {
      suggestionCache.delete(observationId!);
      return { status: 'stale' };
    }
    const waitStart = Date.now();
    const value = await entry.promise;
    log.info(
      `[InstantSuggestion] click: cache HIT id=${observationId} (waited ${Date.now() - waitStart}ms for in-flight) -> ${value ? 'ready' : 'error'}`,
    );
    if (!value) {
      suggestionCache.delete(observationId!);
      return {
        status: abstainedSuggestionIds.has(observationId!)
          ? 'abstained'
          : 'error',
      };
    }
    // Attach only the best matching tool so the delegate bubble has one clear
    // Open action.
    const suggestion: InstantSuggestion =
      value.kind === 'delegate'
        ? { ...value, availableTools: buildAvailableTools(value.targetTool) }
        : value;
    return {
      status: 'ready',
      suggestion,
      scenario: readProfile().scenario,
    };
  },
);

// Renderer acts on a revealed suggestion: always copy the prompt/content to the
// clipboard, and — when the user picked a specific tool — launch it (website,
// app, or terminal) so they can paste. `toolId` omitted means copy-only.
ipcMain.removeAllListeners('suggestion-action');
ipcMain.on(
  'suggestion-action',
  (
    _event,
    { toolId, copyText }: { toolId?: string | null; copyText?: string },
  ) => {
    if (copyText) clipboard.writeText(copyText);
    if (toolId) openAiTool(toolId);
  },
);

// "Ask Coco about it": open a revealed suggestion in Coco's conversation. If it
// isn't already in the chat, attach it and its observation as context for the
// user's next message.
ipcMain.removeAllListeners('chat-about-suggestion');
ipcMain.on(
  'chat-about-suggestion',
  async (
    _event,
    payload: {
      execute?: boolean;
      observationId?: string;
      status?: string;
      rawObservation?: string;
      suggestion?: InstantSuggestion;
      surface?: 'bubble' | 'notification';
      /** Sent from a session invite pop-up. */
      sessionInvite?: boolean;
      /** Sent from a session invite bubble on the avatar. */
      sessionInviteId?: string;
    },
  ) => {
    if (payload?.surface === 'notification') proactive.dismissNotification();

    const suggestion = payload?.suggestion;
    if (!suggestion) return;
    const rawObservation = payload.rawObservation?.trim() || '';
    const suggestionText =
      suggestion.kind === 'delegate' ? suggestion.prompt : suggestion.body;
    const seed: ChatSeed = {
      phrase: suggestion.title,
      label: payload.status?.replace(/_/g, ' ') || 'suggestion',
      rawObservation: [
        payload.execute
          ? 'Carry out this suggestion for me:'
          : 'I’d like to chat about this suggestion:',
        `**${suggestion.title}**`,
        suggestionText || suggestion.copyText,
      ]
        .filter(Boolean)
        .join('\n\n'),
      ...(rawObservation && { screenObservation: rawObservation }),
      deferUntilUserMessage: !payload.execute,
      // Keep what the user just read on screen in the chat they open.
      ...(!payload.execute && {
        suggestion: toChatSuggestion(suggestion, payload.observationId),
      }),
    };

    if (payload.observationId) {
      recordSupportEngagement(payload.observationId, {
        engagedAt: Math.floor(Date.now() / 1000),
        suggestion,
        destination: 'conversation',
      });
    }
    const sensingPort = process.env.SENSING_PORT || '8080';
    axios
      .post(
        `http://127.0.0.1:${sensingPort}/feedback`,
        {
          kind: 'engage',
          surface: payload.surface ?? 'bubble',
          observation_id: payload.observationId ?? null,
          status: payload.status ?? 'observing',
          text: suggestion.copyText ?? suggestionText ?? null,
        },
        { timeout: 3000 },
      )
      .catch((err) => {
        log.warn(`[Feedback] failed to post: ${(err as Error).message}`);
      });

    // Chatting about an invite's preview accepts the invite. (The pop-up
    // reports its own outcome.)
    let acceptsInvite = payload.sessionInvite === true;
    if (proactive.acceptPreview(payload.sessionInviteId)) acceptsInvite = true;
    if (acceptsInvite && !isSessionActive) {
      proactive.clearPendingObservation();
      await createProactiveTutorSession(
        pendingTaskLabel || suggestion.title,
        120,
        'proactive_suggestion',
        seed,
      );
      return;
    }

    // A pop-up suggestion is already in the chat and the tutor's history, so
    // open it there rather than attaching it again as hidden context.
    if (payload.observationId && chatSuggestions.has(payload.observationId)) {
      // Re-send the session too, in case the chat window was recreated.
      if (isSessionActive && currentSessionId) {
        openChatForSession(currentSessionId, pendingTaskLabel || '');
      } else {
        showChatPanel();
      }
      revealChatSuggestion(payload.observationId);
      return;
    }
    if (isSessionActive && currentSessionId) {
      openChatForSession(currentSessionId, pendingTaskLabel || '', seed);
    } else {
      openDraftChat(suggestion.title, seed);
    }
  },
);

// Create a tutor session entirely against the LOCAL servers (no backend). A
// "session" here is just a fresh conversation on the tutor server plus a
// configured struggle-detection window on the sensing server. Shared by the
// explicit "Yes, start session" flow and user-message session activation.
// Returns the new (locally generated) session id, or null on failure.
async function createProactiveTutorSession(
  problemStatement: string,
  struggleSeconds: number,
  startTrigger: SessionStartTrigger,
  seed?: ChatSeed,
  options: {
    sessionId?: string;
    openChat?: boolean;
    preserveDraft?: boolean;
  } = {},
): Promise<string | null> {
  if (!tutoringAllowed) return null;
  // Read the user's onboarding profile to get their selected AI tools and mode.
  const { aiTools, scenario, customObserverPrompt, userName } = readProfile();

  const sensingPort = process.env.SENSING_PORT || '8080';
  const tutorPort = process.env.TUTOR_PORT || '8081';
  const sensing = `http://127.0.0.1:${sensingPort}`;
  const tutor = `http://127.0.0.1:${tutorPort}`;
  const sessionId = options.sessionId ?? randomUUID();
  const modelConfig = readModelConfiguration();
  const selectedTutor = modelConfig ? defaultTutor(modelConfig) : null;
  currentTutorModelId = selectedTutor?.id ?? null;

  // Open the chat panel immediately so the user always gets a UI, even if a
  // server is still starting up. Configuration below is best-effort.
  currentSessionId = sessionId;
  isSessionActive = true;
  pendingTaskLabel = problemStatement;
  sessionStruggleSeconds = struggleSeconds;
  clearAvatarInvite('ignored');
  if (options.openChat !== false) {
    openChatForSession(
      sessionId,
      problemStatement,
      seed,
      options.preserveDraft,
    );
  }
  log.info(`[ProactiveSession] Local tutor session started: ${sessionId}`);
  const startedAt = new Date();
  recordSessionStarted(
    sessionId,
    currentUserId,
    startTrigger,
    startedAt,
    problemStatement,
  );
  gatewayClient?.startSession(
    sessionId,
    startTrigger,
    startedAt,
    problemStatement,
  );

  const sessionStillActive = () =>
    isSessionActive &&
    currentSessionId === sessionId &&
    ![...agentRuns.requests.values()].some(
      (request) => request.sessionId === sessionId && request.stopped,
    );
  const retryLocalPost = async (
    label: string,
    url: string,
    body: unknown,
    timeout: number,
  ) =>
    retryOperation(() => axios.post(url, body, { timeout }), {
      shouldContinue: sessionStillActive,
      onRetry: (error, nextDelayMs, failedAttempt) => {
        log.warn(
          `[ProactiveSession] ${label} attempt ${failedAttempt} failed; retrying in ${nextDelayMs}ms: ${(error as Error).message}`,
        );
      },
    });

  // Register sensing before configuring tutor context. During sleep only the
  // manual tutor is configured; sensing catches up when Coco wakes.
  try {
    if (!isObservationPaused())
      await retryLocalPost(
        'Sensing session setup',
        `${sensing}/session`,
        {
          node_uuid: sessionId,
          struggle_detection_seconds: struggleSeconds,
          scenario,
          config_source: 'session_start',
          ...(customObserverPrompt && {
            custom_observer_prompt: customObserverPrompt,
          }),
        },
        15000,
      );
  } catch (err) {
    if (!(err instanceof RetryCancelledError)) {
      log.warn(
        `[ProactiveSession] Sensing session setup failed after retries (proactive disabled): ${(err as Error).message}`,
      );
    }
  }

  // Configure TutorSystem after sensing registration so the final context
  // always contains this session's task, tools, scenario, and memory.
  try {
    await retryLocalPost('Tutor reset', `${tutor}/context/reset`, {}, 8000);
    if (selectedTutor) {
      await retryLocalPost(
        'Tutor model setup',
        `${tutor}/config/model`,
        { model: selectedTutor.model },
        8000,
      );
    }
    await retryLocalPost(
      'Tutor scenario setup',
      `${tutor}/config/scenario`,
      { scenario },
      8000,
    );
    await retryLocalPost(
      'Tutor problem statement setup',
      `${tutor}/context/problem_statement`,
      { problem_statement: problemStatement },
      8000,
    );
    await retryLocalPost(
      'Tutor AI tools setup',
      `${tutor}/context/ai_tools`,
      { ai_tools: aiTools },
      8000,
    );
    // Re-apply the persisted long-term memory so a freshly (re)started tutor
    // process always has it, independent of its own on-disk load.
    const savedMemory = readLocalMemory();
    if (savedMemory) {
      await retryLocalPost(
        'Tutor memory setup',
        `${tutor}/context/memory`,
        { memory: savedMemory },
        8000,
      );
    }
  } catch (err) {
    if (!(err instanceof RetryCancelledError)) {
      log.warn(
        `[ProactiveSession] Tutor context setup failed after retries: ${(err as Error).message}`,
      );
    }
  }

  return sessionId;
}

// Start a fresh conversation directly from the chat header. Reuse the regular
// session setup path so tutor context, sensing, profile settings, and long-term
// memory all move to the same new session boundary.
ipcMain.handle('ensure-chat-conversation', (event) => {
  if (!isAuthenticated || event.sender !== chatWindow?.webContents) return { error: 'Chat is unavailable.' };
  if (!currentSessionId) {
    currentSessionId = randomUUID();
    const modelConfig = readModelConfiguration();
    currentTutorModelId = modelConfig ? defaultTutor(modelConfig).id : null;
  }
  return { sessionId: currentSessionId };
});

ipcMain.removeHandler('start-new-chat-session');
ipcMain.handle(
  'start-new-chat-session',
  async (_event, { problemStatement }: { problemStatement?: string } = {}) => {
    if (agentRuns.legacyBusy)
      return {
        success: false,
        error:
          'Wait for the practice suggestion before switching conversations.',
      };
    const task =
      problemStatement?.trim() || pendingTaskLabel || 'General help session';
    try {
      const sessionId = await createProactiveTutorSession(
        task,
        120,
        'user_message',
        undefined,
        { preserveDraft: true },
      );
      return { success: Boolean(sessionId), sessionId };
    } catch (err) {
      log.warn(
        `[ProactiveSession] Could not start a new chat session: ${(err as Error).message}`,
      );
      return { success: false, error: (err as Error).message };
    }
  },
);

// Chat history is local-only: the renderer persists completed turns here and
// asks main to rebuild tutor context before continuing an older conversation.
ipcMain.removeHandler('get-chat-conversations');
ipcMain.handle('get-chat-conversations', (_event, options?: { includeQuests?: boolean }) =>
  readConversations()
    .filter(conversation => options?.includeQuests === true || !isQuestConversation(conversation))
    .filter((conversation) => conversation.messages.length > 0)
    .map((conversation) =>
      interruptStaleReplies(
        {
          ...conversation,
          messages: chatStreams.overlay(
            conversation.sessionId,
            conversation.messages,
          ),
        },
        (requestId) => activeChatRequests.has(requestId),
      ),
    ),
);

ipcMain.removeHandler('save-chat-conversation');
ipcMain.handle('save-chat-conversation', (_event, payload) => {
  saveConversation({
    ...(payload ?? {}),
    messages: chatStreams.overlay(payload?.sessionId, payload?.messages ?? []),
    tutorModelId:
      payload?.sessionId === currentSessionId ? currentTutorModelId : undefined,
  });
  return { success: true };
});

// Rebuild tutor context for a saved conversation and make it the live one.
// Continuing a conversation is not a new learning session, so this does not
// record a session start.
async function resumeSavedConversation(
  conversation: StoredConversation,
  excludeTrailingUserText?: string,
): Promise<{ success: boolean; tutorModelId?: string | null; error?: string }> {
  const tutorPort = process.env.TUTOR_PORT || '8081';
  const tutor = `http://127.0.0.1:${tutorPort}`;
  const { aiTools, scenario, userName } = readProfile();
  try {
    await axios.post(`${tutor}/context/reset`, {}, { timeout: 8000 });
    const modelConfig = readModelConfiguration();
    const selectedTutor =
      modelConfig?.tutors.find(
        (item) => item.id === conversation.tutorModelId,
      ) ?? (modelConfig ? defaultTutor(modelConfig) : null);
    if (selectedTutor) {
      await axios.post(
        `${tutor}/config/model`,
        { model: selectedTutor.model },
        { timeout: 8000 },
      );
      currentTutorModelId = selectedTutor.id;
    }
    await axios.post(
      `${tutor}/config/scenario`,
      { scenario },
      { timeout: 8000 },
    );
    await axios.post(
      `${tutor}/context/problem_statement`,
      { problem_statement: conversation.problem },
      { timeout: 8000 },
    );
    await axios.post(
      `${tutor}/context/ai_tools`,
      { ai_tools: aiTools },
      { timeout: 8000 },
    );
    await axios.post(
      `${tutor}/context/user_name`,
      { user_name: userName },
      { timeout: 8000 },
    );
    const savedMemory = readLocalMemory();
    if (savedMemory) {
      await axios.post(
        `${tutor}/context/memory`,
        { memory: savedMemory },
        { timeout: 8000 },
      );
    }
    await axios.post(
      `${tutor}/context/conversation`,
      {
        messages: restorableMessages(
          conversation.messages,
          excludeTrailingUserText,
        ),
      },
      { timeout: 8000 },
    );
    currentSessionId = conversation.sessionId;
    isSessionActive = true;
    pendingTaskLabel = conversation.problem;
    resumableSessionId = null;
    // Continuing an ended conversation from history makes it current again.
    setConversationEnded(conversation.sessionId, false);
    return { success: true, tutorModelId: currentTutorModelId };
  } catch (err) {
    log.warn(`[Chat] Could not resume conversation: ${(err as Error).message}`);
    return { success: false, error: (err as Error).message };
  }
}

// Resume the reopened conversation before the user's first new turn in it, so
// the tutor sees its history. Returns false when there is nothing to resume.
async function resumeReopenedConversation(userText?: string): Promise<boolean> {
  if (isSessionActive || !resumableSessionId) return false;
  if (resumableSessionId !== currentSessionId) {
    resumableSessionId = null;
    return false;
  }
  const conversation = readConversations().find(
    (saved) => saved.sessionId === resumableSessionId,
  );
  resumableSessionId = null;
  if (!conversation) return false;
  return (await resumeSavedConversation(conversation, userText)).success;
}

ipcMain.removeHandler('resume-chat-conversation');
ipcMain.handle(
  'resume-chat-conversation',
  async (_event, { sessionId }: { sessionId?: string } = {}) => {
    if (agentRuns.legacyBusy)
      return {
        success: false,
        error:
          'Wait for the practice suggestion before switching conversations.',
      };
    const conversation = readConversations().find(
      (saved) => saved.sessionId === sessionId,
    );
    if (!conversation) {
      return { success: false, error: 'Conversation not found.' };
    }
    const result = await resumeSavedConversation(conversation);
    if (!result.success) return result;
    activateBridgeConversation(conversation.sessionId);
    const latest =
      readConversations().find((saved) => saved.sessionId === sessionId) ??
      conversation;
    return {
      ...result,
      conversation: interruptStaleReplies(latest, (id) =>
        activeChatRequests.has(id),
      ),
    };
  },
);

// User clicked "Yes" in the "task done?" notification — show the local recap.
ipcMain.removeAllListeners('proactive-session-end-confirmed');
ipcMain.on('proactive-session-end-confirmed', () => {
  proactive.dismissNotification();
  chatWindow?.hide();
  showSessionRecapWindow('end');
});

// Understanding checks use a transcript snapshot; they never activate, resume,
// or finish a session, including when the user is reviewing an archived chat.
ipcMain.removeHandler('check-understanding');
ipcMain.handle(
  'check-understanding',
  async (_event, { sessionId }: { sessionId?: string | null } = {}): Promise<UnderstandingCheckResult> => {
    if (agentRuns.busy)
      return {
        success: false,
        error: 'Wait for Coco to finish before checking your understanding.',
      };
    if (!tutoringAllowed)
      return {
        success: false,
        error: 'AI tutoring is not available for this account.',
      };
    if (readProfile().scenario !== 'ai_upskilling')
      return {
        success: false,
        error: 'Understanding checks are unavailable in this mode.',
      };
    const targetId = sessionId ?? currentSessionId;
    const conversation = readConversations().find(
      (saved) => saved.sessionId === targetId,
    );
    if (
      !conversation ||
      !restorableMessages(conversation.messages).some((message) =>
        message.text.trim(),
      )
    ) {
      return {
        success: false,
        error:
          'Have a conversation with Coco first, then check your understanding.',
      };
    }
    showSessionRecapWindow('check', conversation);
    return { success: true, kind:'quiz' };
  },
);

// The user answered or skipped the recap. An understanding check returns to
// the same session; the end-of-session recap gives the session-level quiz
// result and tears the session down.
ipcMain.removeAllListeners('session-recap-done');
ipcMain.on('session-recap-done', (event, payload?: unknown) => {
  if (event.sender !== sessionRecapWindow?.webContents) return;
  const recap = sessionRecapContext;
  const result =
    payload && typeof payload === 'object'
      ? (payload as {
          quizAnswered?: unknown;
          quizCorrect?: unknown;
          selectedIndex?: unknown;
        })
      : {};
  if (recap?.sessionId) {
    const quizAnswered = result.quizAnswered === true;
    const completion = {
      // Treat missing/older renderer payloads as skipped too, so every recap
      // completion has an unambiguous quiz outcome.
      quizSkipped: !quizAnswered,
      quizAnswered,
      ...(quizAnswered && typeof result.quizCorrect === 'boolean'
        ? { quizCorrect: result.quizCorrect }
        : {}),
      ...(quizAnswered && typeof result.selectedIndex === 'number'
        ? { selectedIndex: result.selectedIndex }
        : {}),
    };
    if (sessionRecapMode === 'check') {
      recordUnderstandingChecked(recap.sessionId, recap.userId, completion);
    } else {
      const endedAt = new Date();
      recordSessionEnded(recap.sessionId, recap.userId, completion, endedAt);
      gatewayClient?.endSession(recap.sessionId, {
        endedAt,
        recapCompletedAt: endedAt,
        ...completion,
      });
      // Reopening Coco after an ended session starts a new conversation.
      setConversationEnded(recap.sessionId, true);
    }
  }
  sessionRecapWindow?.destroy();
  if (sessionRecapMode === 'check') {
    showChatPanel();
    return;
  }
  if (recap?.sessionId === currentSessionId) endCurrentSession();
});

// Ends the active session: mark inactive, close the chat panel, and tell the
// sensing server to revert to pre-session observation mode.
function endCurrentSession() {
  for (const [requestId, request] of agentRuns.requests) {
    if (request.sessionId === currentSessionId) void agentRuns.abort(requestId);
  }
  isSessionActive = false;
  currentSessionId = null;
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.hide();
    avatarWindow?.show();
  }
  const sensingPort = process.env.SENSING_PORT || '8080';
  axios
    .post(`http://127.0.0.1:${sensingPort}/session/end`)
    .catch((e) =>
      log.warn('Could not notify sensing server of session end:', e),
    );
}

// ── Local chat turn ────────────────────────────────────────────────────────────
// Chat requests run in a persistent pi session. The local tutor service supplies
// the configured model, profile context, and existing screen/memory tools.
// Images stay as data URLs; execution events stream back to the renderer.
registerReactiveChat({
  runner: {
    check: async sessionId => { const owner=runnerTurnOwners.get(sessionId);if(owner)return runnerTutorial.check(owner,sessionId); },
    repair: (sessionId,detail,attempt) => { const owner=runnerTurnOwners.get(sessionId);return owner?runnerTutorial.repair(owner,sessionId,detail,attempt):undefined; },
    summary: sessionId => { const user=currentUserId;return user?runnerTutorial.summary(user,sessionId):undefined; },
    tools: sessionId => { const user = currentUserId; if (!user || !runnerTutorial.owns(user, sessionId)) throw Error('This game is no longer active.'); return runnerTutorial.tools(user, sessionId); },
    permission: (sessionId, request) => { const user = runnerTurnOwners.get(sessionId); if (user) runnerTutorial.permission(user, sessionId, request); },
    failure: sessionId => { const user = currentUserId; return user && runnerTutorial.state(user)?.sessionId === sessionId ? runnerTutorial.state(user)?.error ?? undefined : undefined; },
    begin: (sessionId, requestId, text) => {
      const user = currentUserId;
      if (!user || !runnerTutorial.owns(user, sessionId)) return null;
      const instructions = runnerTutorial.begin(user, sessionId, () => { void agentRuns.abort(requestId); }, text, agentDirectory(sessionId));
      if (instructions) runnerTurnOwners.set(sessionId, user);
      return instructions;
    },
    finish: async (sessionId, success, detail) => {
      const owner = runnerTurnOwners.get(sessionId); runnerTurnOwners.delete(sessionId);
      if (owner) return runnerTutorial.finish(owner, sessionId, success, detail);
    },
  },
  ipc: ipcMain,
  session: () => ({
    id: currentSessionId,
    model: currentTutorModelId,
    active: isSessionActive,
  }),
  user: () => currentUserId,
  authenticated: () => isAuthenticated,
  allowed: () => tutoringAllowed,
  isChatSender: (event) => event.sender === chatWindow?.webContents,
  runs: agentRuns,
  activeRequests: activeChatRequests,
  interactions,
  streams: chatStreams,
  gateway: () => gatewayClient,
  training: agent101,
  context: executionContext,
  directory: agentDirectory,
  resume: resumeReopenedConversation,
  startSession: (sessionId, text) =>
    createProactiveTutorSession(text, 120, 'user_message', undefined, {
      sessionId,
      openChat: false,
    }),
  dismissNotification: () => proactive.dismissNotification(),
  approvalRules: commandApprovalRules,
  token: piBridgeToken,
  profile: readProfile,
  emit: sendChatStreamEvent,
  settle: settleStoredReply,
  reminders: {
    start: startAgentProgressReminder,
    clear: clearAgentProgressReminder,
    reply: remindAgentReply,
  },
});

ipcMain.removeAllListeners('open-image-preview');
ipcMain.on('open-image-preview', (event, payload: unknown) => {
  const preview = (payload ?? {}) as {
    imageDataUrl?: unknown;
    editable?: unknown;
  };
  const { imageDataUrl } = preview;
  if (
    typeof imageDataUrl !== 'string' ||
    !imageDataUrl.startsWith('data:image/')
  ) {
    log.warn('[ImagePreview] Ignored an invalid image preview request.');
    return;
  }
  openImagePreviewWindow(
    BrowserWindow.fromWebContents(event.sender),
    imageDataUrl,
    preview.editable === true,
  );
});

ipcMain.removeAllListeners('image-preview-ready');
ipcMain.on('image-preview-ready', (event) => {
  if (
    !imagePreviewWindow ||
    imagePreviewWindow.isDestroyed() ||
    imagePreviewWindow.webContents.id !== event.sender.id ||
    !imagePreviewDataUrl
  ) {
    return;
  }
  imagePreviewWindow.webContents.send('image-preview', {
    imageDataUrl: imagePreviewDataUrl,
    editable: imagePreviewEditable,
    fullScreenOverlay: imagePreviewFullScreenOverlay,
  });
  if (
    process.platform === 'darwin' &&
    !imagePreviewWindow.isSimpleFullScreen()
  ) {
    imagePreviewWindow.setSimpleFullScreen(true);
  }
  imagePreviewWindow.show();
  imagePreviewWindow.focus();
});

ipcMain.removeAllListeners('close-image-preview');
ipcMain.on('close-image-preview', (event) => {
  if (
    imagePreviewWindow &&
    !imagePreviewWindow.isDestroyed() &&
    imagePreviewWindow.webContents.id === event.sender.id
  ) {
    dismissImagePreviewWindow(imagePreviewWindow);
  }
});

ipcMain.on('open-html-preview', (event, payload: { html?: unknown } = {}) => {
  if (!isAuthenticated || event.sender !== chatWindow?.webContents) return;
  if (typeof payload.html !== 'string' || payload.html.length > 2_000_000 || !/^<!doctype html>/i.test(payload.html.trim())) return;
  openHtmlPreviewWindow(chatWindow, payload.html);
});

ipcMain.on('html-preview-ready', (event) => {
  if (!htmlPreviewWindow || htmlPreviewWindow.isDestroyed()
    || event.sender !== htmlPreviewWindow.webContents || !htmlPreviewDocument) return;
  htmlPreviewWindow.webContents.send('html-preview', { html: htmlPreviewDocument });
  htmlPreviewWindow.show();
  htmlPreviewWindow.focus();
});

ipcMain.on('close-html-preview', (event) => {
  if (event.sender === htmlPreviewWindow?.webContents) htmlPreviewWindow?.close();
});

ipcMain.removeAllListeners('save-image-annotation');
ipcMain.on('save-image-annotation', (event, payload: unknown) => {
  const annotatedImageDataUrl = (
    payload as { imageDataUrl?: unknown } | null
  )?.imageDataUrl;
  if (
    !imagePreviewEditable ||
    !imagePreviewDataUrl ||
    !imagePreviewWindow ||
    imagePreviewWindow.isDestroyed() ||
    imagePreviewWindow.webContents.id !== event.sender.id ||
    typeof annotatedImageDataUrl !== 'string' ||
    !annotatedImageDataUrl.startsWith('data:image/png;base64,') ||
    annotatedImageDataUrl.length > 50_000_000
  ) {
    log.warn('[ImagePreview] Ignored an invalid annotation result.');
    return;
  }

  if (imagePreviewAnnotationResult === 'attach') {
    pendingHotkeyCaptures.push(annotatedImageDataUrl);
    showChatPanel();
    flushHotkeyCaptures();
  } else if (
    imagePreviewSourceWindow &&
    !imagePreviewSourceWindow.isDestroyed()
  ) {
    imagePreviewSourceWindow.webContents.send('image-annotation-saved', {
      originalImageDataUrl: imagePreviewDataUrl,
      imageDataUrl: annotatedImageDataUrl,
    });
  }
  dismissImagePreviewWindow(imagePreviewWindow);
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// Note: electron-debug auto-opens DevTools, so we don't use it here
// Instead, we'll register a global shortcut to toggle DevTools manually

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

// IPC Handler for directory selection
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  return result;
});

// Select local file references for the chat prompt without reading their contents.
ipcMain.handle('select-chat-files', async () => {
  return dialog.showOpenDialog({
    title: 'Attach files to your message',
    properties: ['openFile', 'multiSelections'],
  });
});

// IPC Handler for file/directory selection (for context)
ipcMain.handle('select-file-or-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'openDirectory', 'multiSelections'],
  });
  return result;
});

// IPC Handlers for benchmark file downloads
ipcMain.handle(
  'download-benchmark-file',
  async (event, { apiUrl, taskId, filename, workspaceDir }) => {
    try {
      // Ensure workspace directory exists
      if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
      }

      // Download file from server
      const response = await axios.get(
        `${apiUrl}/benchmark_files/download/${taskId}/${encodeURIComponent(filename)}`,
        { responseType: 'arraybuffer' },
      );

      // Save to workspace directory
      const filePath = path.join(workspaceDir, filename);
      fs.writeFileSync(filePath, Buffer.from(response.data));

      log.info(`Downloaded benchmark file: ${filename} to ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      log.error(`Error downloading benchmark file ${filename}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
);

ipcMain.handle('get-benchmark-files', async (event, { apiUrl, taskId }) => {
  try {
    const response = await axios.get(
      `${apiUrl}/benchmark_files/list/${taskId}`,
    );
    return { success: true, data: response.data };
  } catch (error) {
    log.error(`Error fetching benchmark file list:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// IPC Handler: the avatar's Activity panel hydrates from persisted history on
// open. `sinceTs` (unix seconds) bounds the read; default returns the last
// 14 days so the contribution strip and today's timeline can both render.
ipcMain.handle('get-activity-history', async (_event, sinceTs?: number) => {
  const defaultSince = Math.floor(Date.now() / 1000) - 14 * 24 * 3600;
  return readActivity(typeof sinceTs === 'number' ? sinceTs : defaultSince).map(
    (record) => {
      const support = record.proactive_support;
      if (support?.suggestion || !record.observation_id) return record;
      const cached = suggestionCache.get(record.observation_id);
      if (!cached || Date.now() - cached.ts > SUGGESTION_TTL_MS) return record;
      return {
        ...record,
        proactive_support: { ...support, available: true },
      };
    },
  );
});

ipcMain.removeAllListeners('activity-support-engaged');
ipcMain.on('activity-support-engaged', (_event, payload) => {
  const observationId = String(payload?.observationId ?? '');
  if (!observationId) return;
  recordSupportEngagement(observationId, {
    engagedAt:
      typeof payload?.engagedAt === 'number'
        ? payload.engagedAt
        : Math.floor(Date.now() / 1000),
    suggestion: payload?.suggestion,
    destination: payload?.destination === 'inline' ? 'inline' : 'conversation',
  });
  const suggestion = payload?.suggestion as InstantSuggestion | undefined;
  if (
    suggestion?.fourDDimension &&
    currentSessionId &&
    !loggedProactiveSuggestions.has(observationId)
  ) {
    loggedProactiveSuggestions.add(observationId);
    gatewayClient?.addMessage(
      currentSessionId,
      'coco',
      suggestion.copyText,
      undefined,
      {
        messageKind: 'proactive_intervention',
        fourDDimension: suggestion.fourDDimension,
        triggerType: suggestion.triggerType,
        teachingDepth: suggestion.teachingDepth,
        interventionSource: suggestion.interventionSource,
        observationId,
      },
    );
    const tutorPort = process.env.TUTOR_PORT || '8081';
    axios
      .post(
        `http://127.0.0.1:${tutorPort}/context/competency/coached`,
        { four_d_dimension: suggestion.fourDDimension },
        { timeout: 8000 },
      )
      .catch((error) => {
        log.warn(
          `[Curriculum] Failed to record ${suggestion.fourDDimension}: ${(error as Error).message}`,
        );
      });
  }
});

ipcMain.removeAllListeners('activity-support-rated');
ipcMain.on('activity-support-rated', (_event, payload) => {
  const observationId = String(payload?.observationId ?? '');
  let rating: 'up' | 'down' | null = null;
  if (payload?.rating === 'up' || payload?.rating === 'down') {
    rating = payload.rating;
  }
  if (!observationId || !rating) return;
  recordSupportRating(
    observationId,
    rating,
    typeof payload?.ratedAt === 'number'
      ? payload.ratedAt
      : Math.floor(Date.now() / 1000),
  );
});

// The desktop-avatar toggle is independent from the other editable settings,
// so persist and apply it as soon as the checkbox changes.
function updateAvatarVisibilitySetting(hideAvatar: unknown): {
  success: boolean;
  error?: string;
} {
  if (typeof hideAvatar !== 'boolean') {
    return { success: false, error: 'Invalid avatar visibility setting.' };
  }
  try {
    let profile: Record<string, unknown> = {};
    try {
      profile = JSON.parse(fs.readFileSync(profilePath(), 'utf-8'));
    } catch {
      /* no existing profile — start fresh */
    }
    profile.hideAvatar = hideAvatar;
    fs.writeFileSync(profilePath(), JSON.stringify(profile, null, 2), 'utf-8');
    applyAvatarVisibility(hideAvatar);
    chatWindow?.webContents.send('avatar-visibility-changed', { hideAvatar });
    return { success: true };
  } catch (err) {
    log.error('[Settings] Failed to update avatar visibility:', err);
    return { success: false, error: String(err) };
  }
}

ipcMain.removeHandler('update-avatar-visibility');
ipcMain.handle(
  'update-avatar-visibility',
  (_event, { hideAvatar }: { hideAvatar?: boolean } = {}) =>
    updateAvatarVisibilitySetting(hideAvatar),
);

// Update the agent mode + AI tools live from the chat's Settings panel.
// Persists to the profile and applies the change to the running servers so the
// current session picks it up without a restart or re-onboarding.
ipcMain.removeHandler('update-settings');
ipcMain.handle(
  'update-settings',
  async (
    _event,
    {
      scenario,
      aiTools,
      hideAvatar,
    }: {
      scenario: string;
      aiTools: string[];
      hideAvatar: boolean;
    },
  ) => {
    const nextScenario = allowedScenario(scenario);
    // 1. Persist into the profile (merged with existing fields). Models are
    // configured via .env (TUTOR_MODEL / OBSERVER_MODEL), not here.
    try {
      let profile: Record<string, unknown> = {};
      try {
        profile = JSON.parse(fs.readFileSync(profilePath(), 'utf-8'));
      } catch {
        /* no existing profile — start fresh */
      }
      profile.tutorScenario = nextScenario;
      if (nextScenario !== 'custom') profile.customSystemPrompt = '';
      profile.aiTools = aiTools;
      profile.hideAvatar = hideAvatar === true;
      fs.writeFileSync(
        profilePath(),
        JSON.stringify(profile, null, 2),
        'utf-8',
      );
    } catch (err) {
      log.error('[Settings] Failed to persist profile:', err);
      return { success: false, error: String(err) };
    }

    // Apply the desktop presentation immediately; no restart is required.
    applyAvatarVisibility(hideAvatar === true);

    // 2. Apply live to the running servers (best-effort).
    const sensingPort = process.env.SENSING_PORT || '8080';
    const tutorPort = process.env.TUTOR_PORT || '8081';
    const tutor = `http://127.0.0.1:${tutorPort}`;
    const sensing = `http://127.0.0.1:${sensingPort}`;
    try {
      await axios.post(
        `${tutor}/config/scenario`,
        { scenario: nextScenario },
        { timeout: 8000 },
      );
      await axios.post(
        `${tutor}/context/ai_tools`,
        { ai_tools: aiTools },
        { timeout: 8000 },
      );
    } catch (err) {
      log.warn(`[Settings] Tutor update failed: ${(err as Error).message}`);
    }
    // Update the observer/judge scenario too (sensing) if a session is running.
    if (currentSessionId) {
      const { customObserverPrompt } = readProfile();
      try {
        await axios.post(
          `${sensing}/session`,
          {
            node_uuid: currentSessionId,
            struggle_detection_seconds: sessionStruggleSeconds,
            scenario: nextScenario,
            config_source: 'settings',
            ...(customObserverPrompt && {
              custom_observer_prompt: customObserverPrompt,
            }),
          },
          { timeout: 15000 },
        );
      } catch (err) {
        log.warn(
          `[Settings] Sensing scenario update failed: ${(err as Error).message}`,
        );
      }
    }
    return { success: true };
  },
);

// Long-term agent memory — viewed/edited from the chat's Settings panel.
// The Electron main process owns the on-disk copy (userData/coco-memory.txt),
// exactly like the profile/settings, so it always survives a restart. The value
// is also pushed to the tutor server for live use (and re-applied on each new
// session — see createProactiveTutorSession).
const memoryPath = () => path.join(app.getPath('userData'), 'coco-memory.txt');

function readLocalMemory(): string {
  try {
    return fs.readFileSync(memoryPath(), 'utf-8');
  } catch {
    return '';
  }
}

ipcMain.removeHandler('get-memory');
ipcMain.handle('get-memory', async () => {
  // The local file is the source of truth and persists across restarts.
  const local = readLocalMemory();
  if (local) return { memory: local };
  // First run / empty file — fall back to whatever the tutor currently holds.
  const tutorPort = process.env.TUTOR_PORT || '8081';
  try {
    const resp = await axios.get(
      `http://127.0.0.1:${tutorPort}/context/memory`,
      { timeout: 8000 },
    );
    return {
      memory: String((resp.data as { memory?: unknown })?.memory ?? ''),
    };
  } catch {
    return { memory: '' };
  }
});

ipcMain.removeHandler('save-memory');
ipcMain.handle(
  'save-memory',
  async (_event, { memory }: { memory: string }) => {
    // 1. Persist to disk in userData (authoritative — like the profile).
    try {
      fs.writeFileSync(memoryPath(), memory ?? '', 'utf-8');
      log.info('[Memory] saved to', memoryPath());
    } catch (err) {
      log.error('[Memory] failed to persist:', err);
      return { success: false, error: String(err) };
    }
    // 2. Apply live to the running tutor (best-effort).
    const tutorPort = process.env.TUTOR_PORT || '8081';
    try {
      await axios.post(
        `http://127.0.0.1:${tutorPort}/context/memory`,
        { memory },
        { timeout: 8000 },
      );
    } catch (err) {
      log.warn(`[Memory] live apply failed: ${(err as Error).message}`);
    }
    return { success: true };
  },
);

// Legacy renderer hook. Once authenticated, the verified participant identity
// cannot be replaced by a renderer-provided value.
ipcMain.handle('set-user-id', async (event, userId) => {
  if (!userId || typeof userId !== 'string') {
    log.error('Invalid userId provided to set-user-id');
    return { success: false, error: 'Invalid userId' };
  }
  if (isAuthenticated && userId !== currentUserId) {
    log.warn('[User] rejected an attempt to replace the authenticated userId');
    return {
      success: false,
      error: 'Authenticated username cannot change.',
    };
  }
  currentUserId = userId;
  gatewayClient?.setUserId(userId);
  log.info(`[User] local userId set to ${userId}`);
  return { success: true };
});

interface DesktopAuthCredentials {
  participantId?: string;
  email?: string;
  password?: string;
  keepSignedIn?: boolean;
}

const configureParticipantRouterCredential = async (
  confirmedPolicy?: StudyState,
): Promise<void> => {
  if (!gatewayClient) throw new Error('The study server is unavailable.');
  if (currentUserId)
    await syncPreAssessmentState(
      app.getPath('userData'),
      currentUserId,
      gatewayClient,
    );
  const policy = confirmedPolicy ?? ((await gatewayClient.requestJson(
    '/api/study/me',
    'GET',
  )) as unknown as StudyState);
  applyStudyPolicy(policy);
  if (!tutoringAllowed) {
    delete process.env.LLM_ROUTER_API_KEY;
    return;
  }
  if (!process.env.LLM_ROUTER_URL?.trim()) return;
  const credential = await gatewayClient.issueRouterCredential();
  process.env.LLM_ROUTER_API_KEY = credential.token;
  ensureRouterManagedModels();
  log.info('[Auth] participant-scoped Router credential configured');
};

function applyStudyPolicy(policy: StudyState): void {
  currentStudyRole = policy.role;
  studyPolicyAllowsTutoring = policy.tutoring_allowed === true;
  serverPreAssessmentsComplete = policy.pre_assessments_complete === true;
  applyEffectiveStudyAccess();
}

function applyEffectiveStudyAccess(): void {
  const assessmentsComplete = areRequiredPreAssessmentsComplete();
  setTutoringAllowed(studyPolicyAllowsTutoring && assessmentsComplete);
  if (!assessmentsComplete) studyAccessStatus = 'preassessment';
  else if (!studyPolicyAllowsTutoring) studyAccessStatus = 'disabled';
  else studyAccessStatus = 'allowed';
}

async function stopTutoringForAccess(): Promise<void> {
  // A failed agent cancellation must not prevent stopping the other services.
  try {
    await agentRuns.abort();
  } catch (error) {
    log.warn('[Study] Could not cancel active tutoring:', error);
  }
  delete process.env.LLM_ROUTER_API_KEY;
  proactive.dismissNotification();
  sessionRecapWindow?.destroy();
  suggestionCache.clear();
  stopObservationStream();
  if (isSessionActive) endCurrentSession();
  await Promise.all([
    serviceManager.stopService('tutor-server'),
    serviceManager.stopService('sensing-server'),
  ]);
  observerStarted = false;
  syncWakeWordService();
}

const refreshTutoringAccess = createTutoringAccessRefresher<StudyState>({
  canRefresh: () => isAuthenticated && gatewayClient !== null,
  isAllowed: () => tutoringAllowed,
  fetchPolicy: async () => {
    const policy = await gatewayClient!.requestJson('/api/study/me', 'GET');
    if (typeof policy.tutoring_allowed !== 'boolean')
      throw new Error('The study server returned an invalid access policy.');
    return policy as unknown as StudyState;
  },
  applyPolicy: applyStudyPolicy,
  activate: async (policy) => {
    await configureParticipantRouterCredential(policy);
    if (!cocoSleeping && isOnboardingComplete()) startObserver();
    welcomeToCoco();
  },
  deactivate: stopTutoringForAccess,
  setAllowed: setTutoringAllowed,
  isAuthorizationError: (error) =>
    error instanceof GatewayHttpError && [401, 403].includes(error.status),
  unavailable: (error) => {
    studyAccessStatus = 'unavailable';
    log.warn(`[Study] Could not refresh tutoring access: ${String(error)}`);
  },
  settled: () => {
    syncWakeWordService();
    if (tray && !tray.isDestroyed()) createTray();
  },
});

const authenticate = async (
  mode: 'signin' | 'signup',
  credentials: DesktopAuthCredentials,
) => {
  if (!gatewayClient) {
    return {
      success: false,
      error: 'The Coco backend is not configured or is unavailable.',
    };
  }
  if (
    typeof credentials?.participantId !== 'string' ||
    typeof credentials?.password !== 'string' ||
    (mode === 'signup' && typeof credentials?.email !== 'string')
  ) {
    return {
      success: false,
      error:
        mode === 'signup'
          ? 'Username, email, and password are required.'
          : 'Username and password are required.',
    };
  }
  try {
    const request = {
      participantId: credentials.participantId,
      ...(mode === 'signup' ? { email: credentials.email?.trim() } : {}),
      password: credentials.password,
      keepSignedIn: credentials.keepSignedIn !== false,
    };
    const session =
      mode === 'signup'
        ? await gatewayClient.signUp(request)
        : await gatewayClient.signIn(request);
    currentUserId = session.participantId;
    isAuthenticated = true;
    agent101.notifyAccountChanged();
    currentStudyRole = null;
    serverPreAssessmentsComplete = false;
    adminStudentMode = false;
    await configureParticipantRouterCredential();
    pendingAuthLaunch = mode;
    if (request.keepSignedIn) {
      saveAuthSession(app.getPath('userData'), {
        token: session.token,
        participantId: session.participantId,
        expiresAt: session.expiresAt,
      });
    } else {
      clearAuthSession(app.getPath('userData'));
    }
    log.info(`[Auth] ${mode} succeeded for ${session.participantId}`);
    return { success: true, participantId: session.participantId };
  } catch (error) {
    log.warn(`[Auth] ${mode} failed: ${String(error)}`);
    currentUserId = null;
    isAuthenticated = false;
    agent101.notifyAccountChanged();
    currentStudyRole = null;
    serverPreAssessmentsComplete = false;
    adminStudentMode = false;
    studyAccessStatus = 'unavailable';
    void agentRuns.abort();
    setTutoringAllowed(false);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

ipcMain.handle('auth-signup', (_event, credentials: DesktopAuthCredentials) =>
  authenticate('signup', credentials),
);
ipcMain.handle('auth-signin', (_event, credentials: DesktopAuthCredentials) =>
  authenticate('signin', credentials),
);

ipcMain.removeAllListeners('authentication-ui-complete');
ipcMain.on('authentication-ui-complete', () => {
  if (!isAuthenticated || !pendingAuthLaunch) return;
  const launch = pendingAuthLaunch;
  pendingAuthLaunch = null;
  authWindow?.destroy();
  if (launch === 'signup' || !isOnboardingComplete()) {
    // Every new account finishes app setup before entering Training, even when
    // the server already marks its pre-assessments as pending.
    createOnboardingWindow();
    createTray();
    return;
  }
  if (studyAccessStatus === 'preassessment') {
    welcomeToCoco();
    createTray();
    return;
  }
  const canStartConfiguredModels = Boolean(
    readModelConfiguration() ||
      (process.env.TUTOR_MODEL?.trim() && process.env.OBSERVER_MODEL?.trim()),
  );
  if (isOnboardingComplete() && canStartConfiguredModels) {
    hideAvatarMode = readHideAvatarSetting();
    startObserver();
  }
  createWindow().catch((error) => {
    log.warn(`[Auth] Could not launch Coco after sign in: ${String(error)}`);
  });
});

const createWindow = async () => {
  if (!isAuthenticated) {
    createAuthWindow();
    createTray();
    return;
  }
  if (isDebug) {
    await installExtensions();
  }

  const onboardingComplete = isOnboardingComplete();
  if (!onboardingComplete) {
    // First launch — keep the original setup, with its floating Coco introduction.
    createOnboardingWindow();
    createTray();
    return;
  }
  if (!tutoringAllowed) {
    welcomeToCoco();
    return;
  }

  const modelConfiguration = readModelConfiguration();
  if (!modelConfiguration) {
    // Legacy environment variables may be sufficient to start the services,
    // but users still need an explicit, inspectable model configuration.
    createOnboardingWindow(true);
    createTray();
  } else {
    welcomeToCoco();
  }
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin' && !hideAvatarMode) {
    app.quit();
  }
});

app.on('second-instance', () => {
  revealCoco();
});

app.on('will-quit', () => {
  void agentRuns.dispose();
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// Warning shown when neither first-launch configuration nor legacy developer
// environment variables provide both required model roles.
const showModelsRequiredWarning = () => {
  showNotification({
    message:
      'Coco is paused. Open Settings and configure a sensing model and at least one tutor model.',
    actionLabel: 'Got it',
    category: 'system',
  });
};

let systemPermissionDialogOpen = false;
const showSystemPermissionWarning = async (
  preferredTarget?: SystemPermissionSettingsTarget,
): Promise<void> => {
  if (systemPermissionDialogOpen) return;
  if (process.platform !== 'darwin') {
    return;
  }
  const warning = readSystemPermissionWarning();
  if (!warning) {
    return;
  }

  systemPermissionDialogOpen = true;
  try {
    log.warn(`[Permissions] ${warning.detail}`);
    const target =
      preferredTarget && warning.settingsTargets.includes(preferredTarget)
        ? preferredTarget
        : warning.settingsTargets[0];
    const label = systemPermissionButtonLabel(target).replace(/^Open /, '');
    await dialog.showMessageBox({
      type: 'warning',
      title: 'Coco Learn permissions required',
      message: `Allow ${label}`,
      detail: `${systemPermissionExplanation(target)}\n\nOpen System Settings and enable ${label} for ${app.isPackaged ? 'Coco Learn' : 'Electron (development app)'}. Then quit and reopen Coco Learn so macOS can apply the change.`,
      buttons: [systemPermissionButtonLabel(target)],
      defaultId: 0,
      noLink: true,
    });
    try {
      await openSystemPermissionSettings(target, {
        screenStatus: () => systemPreferences.getMediaAccessStatus('screen'),
        // A minimal thumbnail still exercises the capture permission path.
        // Results are discarded, never saved or sent to a model/server.
        requestScreenAccess: () =>
          desktopCapturer
            .getSources({
              types: ['screen'],
              thumbnailSize: { width: 1, height: 1 },
              fetchWindowIcons: false,
            })
            .then(() => undefined),
        // Explicitly target Apple's settings app rather than a registered URL
        // handler, and wait for launch errors so we can show the fallback.
        openExternal: (url) =>
          new Promise<void>((resolve, reject) => {
            execFile(
              '/usr/bin/open',
              ['-b', 'com.apple.systempreferences', url],
              { timeout: 5000 },
              (error) => {
                if (error) reject(error);
                else resolve();
              },
            );
          }),
        warn: (message) => log.warn(`[Permissions] ${message}`),
      });
    } catch (error) {
      log.warn(
        `[Permissions] Could not open System Settings: ${String(error)}`,
      );
      dialog.showErrorBox(
        'Open System Settings manually',
        'Open System Settings → Privacy & Security and select the requested permission. For Screen Recording, use the + button to add Coco Learn from Applications if it is missing. Quit and reopen Coco Learn after enabling access.',
      );
    }
  } finally {
    systemPermissionDialogOpen = false;
  }
};

// Effective model ids. Managed app configuration wins when present; legacy
// developer environment variables remain supported as a fallback.
const effectiveModels = (): { tutor: string; observer: string } => {
  const runtime = resolveModelRuntime();
  return {
    tutor: (runtime
      ? defaultTutor(runtime.config).model
      : process.env.TUTOR_MODEL || ''
    ).trim(),
    observer: (
      runtime?.config.sensing.model ||
      process.env.OBSERVER_MODEL ||
      ''
    ).trim(),
  };
};

const ensureRouterManagedModels = (): void => {
  if (!isLlmRouterConfigured()) return;
  try {
    const current = readModelConfiguration();
    const normalized = normalizeRouterManagedModelConfiguration(current);
    if (
      JSON.stringify(current) === JSON.stringify({ version: 1, ...normalized })
    ) {
      return;
    }
    saveModelConfiguration(normalized);
    sendToChat('model-configuration-updated', null);
    log.info(
      `[Models] Applied Router-managed configuration: tutor=${normalized.defaultTutorId} observer=${normalized.sensing.model}`,
    );
  } catch (error) {
    log.error(`[Models] Could not apply Router-managed defaults: ${error}`);
  }
};

const serviceSupervisor = new ServiceSupervisor({
  services: [
    { id: 'tutor-server', enabled: () => tutoringAllowed && isAuthenticated && observerStarted && !isQuitting },
    { id: 'sensing-server', enabled: () => tutoringAllowed && isAuthenticated && observerStarted && !isQuitting && !isObservationPaused() },
  ],
  probe: async id => {
    const port = id === 'tutor-server' ? process.env.TUTOR_PORT || '8081' : process.env.SENSING_PORT || '8080';
    const response = await axios.get(`http://127.0.0.1:${port}/health`, { timeout: 1200 });
    return response.data?.service === (id === 'tutor-server' ? 'coco-tutor' : 'coco-sensing');
  },
  start: id => serviceManager.startService(id),
  stop: id => serviceManager.stopService(id, { timeoutMs: 1000, force: true }),
  report: (id, detail) => log.warn(`[ServiceRecovery] ${id}: ${detail}`),
});
app.on('before-quit', () => serviceSupervisor.dispose());
ipcMain.handle('retry-services', async event => {
  if (event.sender !== chatWindow?.webContents || !isAuthenticated || !tutoringAllowed) return { error: 'Sign in to reconnect Coco.' };
  if (process.env.LLM_ROUTER_URL?.trim() && !isLlmRouterConfigured())
    return {error:'Coco is still connecting your account to its model service. Please wait a moment.'};
  if (!observerStarted) startObserver();
  serviceSupervisor.start();
  await serviceSupervisor.retry();
  modelHealthCache.clear();
  return { success: true };
});

// Starts the sensing services and observation stream. Called once onboarding
// is complete (or immediately on subsequent launches where it's already done),
// and again from update-settings the moment the user first saves their models.
const startObserver = () => {
  if (!tutoringAllowed) return;
  // Already running — nothing to do (guards the two call sites + the
  // start-on-save path in update-settings).
  if (observerStarted) return;

  // Gate on model choice: until BOTH roles are explicitly set, do not spawn
  // Python services that could otherwise start with an unintended provider.
  const { tutor: tutorModel, observer: observerModel } = effectiveModels();
  if (!tutorModel || !observerModel) {
    log.warn('[Models] No models chosen yet — services not started.');
    showModelsRequiredWarning();
    return;
  }
  observerStarted = true;

  // Shared records directory. Both the sensing server (observer/judge) and the
  // tutor server read $COCO_RECORDS_DIR so all their JSONL logs — and, in
  // training-collection mode, retained screenshots — land in one joinable
  // directory. It lives alongside the user's other local data (memory,
  // profile, activity history) under the app's userData dir. Set before
  // services spawn so the children inherit it.
  if (!process.env.COCO_RECORDS_DIR) {
    const dir = path.join(
      app.getPath('userData'),
      'coco-records',
      `session_${Math.floor(Date.now() / 1000)}`,
    );
    process.env.COCO_RECORDS_DIR = dir;
    log.info(`[Records] COCO_RECORDS_DIR=${dir}`);
  }

  // Expose the app's user-data dir to the services so sensing can persist the
  // user's custom observer prompt (Custom mode) to its own file there. Set
  // before services spawn so the children inherit it.
  if (!process.env.COCO_USER_DATA_DIR) {
    process.env.COCO_USER_DATA_DIR = app.getPath('userData');
    log.info(`[Profile] COCO_USER_DATA_DIR=${process.env.COCO_USER_DATA_DIR}`);
  }
  // Unlike per-launch training records, GUM memory is intentionally shared
  // across sessions so the tutor can retrieve older context.
  if (!process.env.COCO_MEMORY_DB_PATH) {
    process.env.COCO_MEMORY_DB_PATH = path.join(
      app.getPath('userData'),
      'memory',
      'memory.db',
    );
    log.info(`[Memory] COCO_MEMORY_DB_PATH=${process.env.COCO_MEMORY_DB_PATH}`);
  }

  // Pass the resolved models to the services. config.json references
  // ${TUTOR_MODEL}/${OBSERVER_MODEL}, which the service manager expands from env.
  process.env.TUTOR_MODEL = tutorModel;
  process.env.OBSERVER_MODEL = observerModel;
  log.info(`[Models] tutor=${tutorModel} observer=${observerModel}`);

  try {
    // services.json may be loaded earlier while choosing available ports. On a
    // clean install there is no legacy .env, so its model placeholders have
    // already expanded to empty strings by this point. Always apply the saved
    // model IDs directly before startup instead of relying on load-time env
    // expansion.
    configureServiceModelArguments(serviceManager, tutorModel, observerModel);
    const { userName, scenario } = readProfile();
    // Pre-session Observer invitations use the selected scenario, so sensing
    // must start with it instead of defaulting to everyday support. The Judge
    // itself starts only after the user accepts and a session is configured.
    serviceManager.configureServiceArg('sensing-server', 'scenario', scenario);
    const runtime = resolveModelRuntime();
    if (runtime) {
      serviceManager.configureServiceEnv(
        'tutor-server',
        {
          ...runtime.tutorEnv,
          ...(userName && { COCO_USER_NAME: userName }),
        },
        true,
      );
      serviceManager.configureServiceEnv(
        'sensing-server',
        {
          ...runtime.sensingEnv,
          ...(userName && { COCO_USER_NAME: userName }),
        },
        true,
      );
    }
    serviceSupervisor.start();
  } catch (e) {
    observerStarted = false;
    log.error('[ServiceStartup] Failed to configure services:', e);
  }

  // Trim old activity history once per launch so the JSONL stays bounded.
  pruneActivity(Math.floor(Date.now() / 1000));

  // Unlike the public Coco evening scheduler, this transition is driven by an
  // actual observation. That makes the learning review appear on the next day
  // the participant uses the computer, even if Coco stayed open overnight.
  nextDaySummaryScheduler = new NextDaySummaryScheduler({
    statePath: path.join(
      app.getPath('userData'),
      'next-learning-review-state.json',
    ),
    onFirstUse: async ({ startTs: todayStartTs }) => {
      if (!tutoringAllowed || postAssessmentActive) return false;
      // Do not replace something time-sensitive. Returning false leaves the
      // date unhandled, so the next observation retries the summary.
      if (proactive.window && !proactive.window.isDestroyed()) {
        return false;
      }

      if (!currentUserId) return true;
      const recaps = readLatestUnreviewedLearningDay(
        app.getPath('userData'),
        currentUserId,
        todayStartTs,
      );
      if (recaps.length === 0) return true;
      const tutorPort = process.env.TUTOR_PORT || '8081';
      const response = await axios.post(
        `http://127.0.0.1:${tutorPort}/daily-learning-review`,
        {
          recaps: recaps.map((recap) => ({
            summary_title: recap.summaryTitle,
            bullets: recap.bullets,
          })),
        },
        { timeout: 45_000 },
      );
      const review = response.data as {
        summary_title?: unknown;
        takeaways?: unknown;
      };
      if (
        typeof review.summary_title !== 'string' ||
        !Array.isArray(review.takeaways) ||
        review.takeaways.length !== 3 ||
        !review.takeaways.every(
          (takeaway): takeaway is string =>
            typeof takeaway === 'string' && Boolean(takeaway.trim()),
        )
      ) {
        throw new Error('Tutor returned an invalid daily learning review.');
      }
      const latestRecap = recaps[recaps.length - 1];
      const summaryDate = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(new Date(latestRecap.generatedAt * 1000));
      // Generation can take several seconds. Preserve any notification that
      // appeared while the daily review was being synthesized and retry later.
      if (proactive.window && !proactive.window.isDestroyed()) {
        return false;
      }
      showNotification({
        message: [
          `**Review from ${summaryDate}**`,
          review.summary_title.trim(),
          ...review.takeaways.map((takeaway) => `- ${takeaway.trim()}`),
        ].join('\n'),
        actionLabel: 'Open Coco',
        notifType: 'daily-summary',
      });
      markLearningRecapsReviewedThrough(
        app.getPath('userData'),
        currentUserId,
        latestRecap.generatedAt,
        Date.now() / 1000,
      );
      return true;
    },
  });

  // Subscribe to the sensing server's live observation feed and forward
  // each event to the avatar window. The SSE client retries with backoff,
  // so it's safe to start before the sensing server is fully up.
  const sensingPort = process.env.SENSING_PORT || '8080';
  startObservationStream({
    url: `http://127.0.0.1:${sensingPort}/observations/stream`,
    onEvent: (event) => {
      const receivedAt = Date.now();
      if (isObservationPaused()) return;
      if (observationSleepGuard.shouldSuppress(event.ts)) {
        if (event.observation) {
          log.info(
            `[Power] Dropped suppressed observation status=${event.status ?? '(none)'}`,
          );
        }
        return;
      }

      const status = event.status;
      if (postAssessmentActive) {
        // Preserve semantic activity for the automatic assessment report, but
        // do not surface observations, precompute help, or open notifications.
        if (status && event.observation) {
          appendActivity({
            ts: event.ts ?? Math.floor(Date.now() / 1000),
            status: status as ObservationStatus,
            observation: cleanObservation(event.observation),
            observation_id: event.observation_id,
            llm_metrics: event.llm_metrics,
          });
        }
        return;
      }
      const { scenario } = readProfile();
      const instantSuggestionEligible = shouldOfferInstantSuggestion(
        scenario,
        isSessionActive,
        event,
      );
      // A suggestion arriving while a tutor reply is on its way would land on
      // top of that reply, so it is dropped rather than shown.
      const suggestionDropped =
        instantSuggestionEligible && interactions.movedOnSince(receivedAt);
      if (suggestionDropped) {
        log.info(
          '[Interaction] Dropped proactive suggestion: a tutor reply is in progress.',
        );
      }
      const offerSuggestion = instantSuggestionEligible && !suggestionDropped;
      const surfaceObservation = shouldSurfaceObservation(event);

      // Tier-2 friction events from the struggle/pause path arrive without an
      // observation_id, but the precompute cache and the renderer bubble must
      // agree on a key. Since the SAME event object is forwarded to the
      // renderer below, stamp a synthetic id here so both sides line up.
      if (status && PRECOMPUTE_STATUSES.has(status) && !event.observation_id) {
        syntheticObsSeq += 1;
        event.observation_id = `synthetic-${Date.now()}-${syntheticObsSeq}`;
      }

      // Progress is kept in history without showing an avatar bubble. Other
      // observation statuses retain their existing feedback. The separate
      // instantSuggestionEligible gate below ensures only Judge-approved events
      // generate a detailed proactive suggestion in AI Upskilling.
      if (
        surfaceObservation &&
        !suggestionDropped &&
        !hideAvatarMode &&
        avatarWindow &&
        !avatarWindow.isDestroyed()
      ) {
        avatarWindow.webContents.send('observation-update', event);
      }

      // Tee into the persistent activity history so the Activity panel survives
      // window reloads and spans sessions. appendActivity ignores statuses that
      // don't belong on the timeline (task_suggested / task_complete).
      if (status && event.observation) {
        appendActivity({
          ts: event.ts ?? Math.floor(Date.now() / 1000),
          status: status as ObservationStatus,
          observation: cleanObservation(event.observation),
          observation_id: event.observation_id,
          proactive_support: offerSuggestion ? { engaged: false } : undefined,
          llm_metrics: event.llm_metrics,
        });
      }

      const taskLabel = event.task_label;

      // ── Eagerly precompute an instant suggestion for Tier-2 bubbles ───
      // AI Upskilling suggestions are generated only for Judge-approved
      // interventions inside an active session. Other modes retain their
      // existing pull-based observer suggestions.
      if (offerSuggestion) {
        const suggestionPromise = precomputeSuggestion(event);
        if (hideAvatarMode && event.observation) {
          const rawObservation = cleanObservation(event.observation);
          latestHiddenSuggestionObservationId = event.observation_id;
          void suggestionPromise?.then((value) => {
            // Hidden-avatar notifications preview the generated suggestion,
            // rather than the observer diagnosis that led to it.
            if (
              !value ||
              isObservationPaused() ||
              !hideAvatarMode ||
              !shouldOfferInstantSuggestion(
                readProfile().scenario,
                isSessionActive,
                event,
              ) ||
              latestHiddenSuggestionObservationId !== event.observation_id
            ) {
              return;
            }
            // Generation takes seconds; if the user messaged the tutor or a
            // reply finished meanwhile, the tutor has the floor.
            if (interactions.movedOnSince(receivedAt)) {
              log.info(
                '[Interaction] Dropped proactive suggestion: the conversation moved on while it was generated.',
              );
              return;
            }
            const suggestion: InstantSuggestion =
              value.kind === 'delegate'
                ? {
                    ...value,
                    availableTools: buildAvailableTools(value.targetTool),
                  }
                : value;
            const chatSuggestion = toChatSuggestion(
              suggestion,
              event.observation_id,
            );
            let surface: 'chat' | 'notification';
            if (isChatPanelVisible()) {
              // The user is already in the chat, so Coco says it there.
              deliverSuggestionToChat(chatSuggestion, false);
              surface = 'chat';
            } else {
              const shown = showNotification({
                message: suggestion.title,
                actionLabel: 'Reveal full suggestion',
                notifType: 'proactive-suggestion',
                observationId: event.observation_id,
                status,
                rawObservation,
                suggestion,
                scenario: readProfile().scenario,
              });
              if (!shown || !proactive.window) return;
              suggestionNotification = {
                window: proactive.window,
                observationId: event.observation_id,
              };
              // A folded copy keeps it findable after the pop-up closes.
              deliverSuggestionToChat(chatSuggestion, true);
              surface = 'notification';
            }
            interactions.note('suggestion_shown');
            recordSuggestionWithTutor(chatSuggestion, event.trigger_type);
            const sensingPort = process.env.SENSING_PORT || '8080';
            axios
              .post(
                `http://127.0.0.1:${sensingPort}/feedback`,
                {
                  kind: 'shown',
                  surface,
                  observation_id: event.observation_id ?? null,
                  status,
                },
                { timeout: 3000 },
              )
              .catch((err) => {
                log.warn(
                  `[Feedback] failed to post: ${(err as Error).message}`,
                );
              });
          });
        }
      }

      // ── Pre-session: suggest starting a tutor session ─────────────────
      // The sensing-side Judge owns the invite decision. Keep the original
      // five-minute UI cooldown so repeated Judge ticks cannot make the session
      // invitation itself feel like a stream of disconnected suggestions.
      if (!isSessionActive && status === 'task_suggested' && taskLabel) {
        const now = Date.now();
        if (now - lastTaskSuggestionMs >= TASK_SUGGESTION_COOLDOWN_MS) {
          lastTaskSuggestionMs = now;
          showSessionInvite(event, taskLabel);
        }
      }

      // ── In-session: detect task completion ───────────────────────────
      if (isSessionActive && status === 'task_complete') {
        showNotification({
          message:
            'Looks like your task is done. Want to wrap up this session?',
          actionLabel: 'Yes, end session',
          cancelLabel: 'Keep going',
          notifType: 'session-end-prompt',
        });
      }

      // This event is the first concrete evidence of use today. The scheduler
      // persists the handled date, so all later observations are no-ops.
      void nextDaySummaryScheduler?.checkNow();
    },
  });
};

app
  .whenReady()
  .then(async () => {
    desktopAppUpdater.start();
    installDockUpdateMenu(desktopAppUpdater);
    await configureLocalServicePorts();
    initializeWakeWordService();
    powerMonitor.on('suspend', () => {
      log.info('[Power] System suspended; clearing proactive UI and cache.');
      systemSuspended = true;
      syncWakeWordService();
      observationSleepGuard.suspend();
      latestHiddenSuggestionObservationId = undefined;
      suggestionCache.clear();
      proactive.setHovered(false);
      proactive.dismissNotification();
      clearAvatarInvite('ignored');
      if (avatarWindow && !avatarWindow.isDestroyed()) {
        avatarWindow.webContents.send('system-suspend');
      }
      chatWindow?.webContents.send('system-suspend');
    });

    powerMonitor.on('resume', () => {
      log.info('[Power] System resumed; suppressing observations briefly.');
      systemSuspended = false;
      syncWakeWordService();
      observationSleepGuard.resume();
      latestHiddenSuggestionObservationId = undefined;
      suggestionCache.clear();
      proactive.setHovered(false);
      proactive.dismissNotification();
      if (avatarWindow && !avatarWindow.isDestroyed()) {
        // Send this again in case the renderer was frozen before handling the
        // suspend event.
        avatarWindow.webContents.send('system-suspend');
      }
    });

    // Ensure default workspace directory exists
    ensureDefaultWorkspaceExists();
    ensureRouterManagedModels();

    // Gateway delivery is opt-in: without a URL this returns null
    // and Coco remains fully local, matching the upstream privacy default.
    gatewayClient = CocoGatewayClient.fromEnvironment(
      log,
      app.isPackaged ? PACKAGED_GATEWAY_URL : '',
    );

    const storedAuth = readAuthSession(app.getPath('userData'));
    if (gatewayClient && storedAuth) {
      try {
        const restored = await gatewayClient.restoreAuthSession(
          storedAuth.token,
        );
        currentUserId = restored.participantId;
        isAuthenticated = true;
        agent101.notifyAccountChanged();
        currentStudyRole = null;
        serverPreAssessmentsComplete = false;
        adminStudentMode = false;
        await configureParticipantRouterCredential();
        log.info(`[Auth] restored session for ${restored.participantId}`);
      } catch (error) {
        clearAuthSession(app.getPath('userData'));
    currentUserId = null;
        isAuthenticated = false;
        agent101.notifyAccountChanged();
        currentStudyRole = null;
        serverPreAssessmentsComplete = false;
        adminStudentMode = false;
        log.warn(
          `[Auth] saved session could not be restored: ${String(error)}`,
        );
        studyAccessStatus = 'unavailable';
        setTutoringAllowed(false);
      }
    }

    // Only start the observer if onboarding is already done. If not, it will
    // be started by the 'onboarding-complete' IPC handler after the user
    // finishes or skips onboarding.
    const canStartConfiguredModels = Boolean(
      readModelConfiguration() ||
        (process.env.TUTOR_MODEL?.trim() && process.env.OBSERVER_MODEL?.trim()),
    );
    if (isAuthenticated && isOnboardingComplete() && canStartConfiguredModels) {
      hideAvatarMode = readHideAvatarSetting();
      startObserver();
    }

    createWindow();
    const studyPolicyTimer = setInterval(() => {
      void refreshTutoringAccess();
    }, 30000);
    studyPolicyTimer.unref();
    createWakeWordCaptureWindow();
    // Keep chat state alive while its panel is closed.
    createChatWindow();

    // Register global shortcut to toggle DevTools (Cmd/Ctrl+Shift+I)
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      const devTarget =
        BrowserWindow.getFocusedWindow() ?? chatWindow ?? avatarWindow;
      if (devTarget && devTarget.webContents) {
        devTarget.webContents.toggleDevTools();
      }
    });

    // Register global shortcut for screenshot capture (Cmd+Shift+Space).
    // Works system-wide even when Electron is not the focused app.
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (!areRequiredPreAssessmentsComplete()) {
        showPreAssessmentLockedMessage();
        return;
      }
      void beginHotkeyCapture();
    });

    // Cmd/Ctrl+Shift+H — toggle the observation history panel on the avatar.
    globalShortcut.register('CommandOrControl+Shift+H', () => {
      toggleAvatarHistory();
    });

    app.on('activate', () => {
      // A Dock click or reopening the running app must always surface Coco,
      // even when the chat panel is merely hidden and the menu bar icon isn't
      // visible.
      revealCoco();
    });
  })
  .catch(console.log);

app.on('before-quit', (event) => {
  runnerTutorial.interrupt();
  for(const requestId of agentRuns.requests.keys())void agentRuns.abort(requestId);
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  log.info('App quitting: waiting up to 10s for services to stop...');
  desktopAppUpdater.stop();
  stopObservationStream();
  wakeWordService?.stop('disabled');
  const shutdownTimeoutMs = 10_000;
  const finishQuit = () => {
    if (installUpdateAfterShutdown) {
      autoUpdater.quitAndInstall(true, true);
    } else {
      app.quit();
    }
  };
  serviceManager
    .shutdown(shutdownTimeoutMs)
    .then(() => {
      log.info('Services stopped, quitting app.');
      finishQuit();
    })
    .catch((e) => {
      log.warn('Error while stopping services, quitting anyway', e);
      finishQuit();
    });
});
