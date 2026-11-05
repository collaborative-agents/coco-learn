import { BrowserWindow, screen } from 'electron';
import type { IpcMain } from 'electron';
import { randomUUID } from 'crypto';
import log from 'electron-log';
import { resolveHtmlPath } from './util';
import configureFullscreenCompanionWindow from './services/fullscreen-companion-window';
import { cleanObservation } from '../renderer/components/observation-types';
import type { AiToolButton } from '../renderer/components/observation-types';
import type { CocoGatewayClient } from './services/gateway-client';
import type {
  ChatSeed,
  InstantSuggestion,
  SuggestionObservation,
} from './proactive-types';
import type { SessionStartTrigger } from '../shared/session-start';

interface ProactiveNotificationsDependencies {
  ipc: Pick<IpcMain, 'on' | 'removeAllListeners'>;
  gateway: () => CocoGatewayClient | null;
  avatar: () => BrowserWindow | null;
  recapOpen: () => boolean;
  allowed: () => boolean;
  sleeping: () => boolean;
  assessmentActive: () => boolean;
  suspended: () => boolean;
  avatarHidden: () => boolean;
  sessionActive: () => boolean;
  sessionId: () => string | null;
  taskLabel: () => string | null;
  setTaskLabel: (label: string) => void;
  clearHiddenSuggestion: () => void;
  preload: () => string;
  profile: () => { scenario: string };
  precompute: (
    event: SuggestionObservation,
  ) => Promise<InstantSuggestion | null> | undefined;
  availableTools: (preferredId?: string | null) => AiToolButton[];
  openChat: (sessionId: string, label: string, seed?: ChatSeed) => void;
  startSession: (
    label: string,
    seconds: number,
    trigger: SessionStartTrigger,
    seed?: ChatSeed,
  ) => Promise<string | null>;
}
type VizState = 'none' | 'success' | 'error';
type NotifType =
  | 'default'
  | 'daily-summary'
  | 'proactive-suggestion'
  | 'instant-suggestion'
  | 'session-start-prompt'
  | 'session-end-prompt';

type NotificationOutcome = 'accepted' | 'dismissed' | 'ignored';

interface ActiveNotificationRecord {
  id: string;
  resolved: boolean;
  created: Promise<void>;
  ignoreTimer?: ReturnType<typeof setTimeout>;
}

export interface NotificationPayload {
  message: string;
  actionLabel: string;
  vizState?: VizState;
  notifType?: NotifType;
  cancelLabel?: string;
  observationId?: string;
  status?: string;
  rawObservation?: string;
  suggestion?: InstantSuggestion;
  scenario?: string;
  category?: string;
  /** Pre-session invite; recorded as a session-start prompt. */
  sessionInvite?: boolean;
}

/** Owns proactive notification windows, invitation previews, outcomes, and timers. */
export default function createProactiveNotifications(
  deps: ProactiveNotificationsDependencies,
) {
  let notificationWindow: BrowserWindow | null = null;
  let notificationHovered = false;
  let proactiveSuggestionOpen = false;
  // ── Notification bubble window ────────────────────────────────────────────────
  // Notification is pinned to the top-right corner of the primary display so it
  // is always fully visible and never clipped by the app window edge.

  const NOTIF_WIDTH = 360;
  // Keep the card compact; longer Markdown guidance scrolls inside the body.
  const NOTIF_HEIGHT = 220;
  // Two-page suggestions need enough room for the grounded 4D explanation and
  // the prompt/actions on page 2 without requiring manual window resizing.
  const NOTIF_SUGGESTION_WIDTH = 480;
  const NOTIF_SUGGESTION_HEIGHT = 420;
  // Bounds when a suggestion pop-up fits its window to the content.
  const NOTIF_SUGGESTION_MIN_HEIGHT = 180;
  const NOTIF_SUGGESTION_MAX_HEIGHT = 560;
  const NOTIF_DAILY_SUMMARY_WIDTH = 420;
  const NOTIF_DAILY_SUMMARY_HEIGHT = 300;
  const NOTIF_EXPANDED_WIDTH = 560;
  const NOTIF_EXPANDED_HEIGHT = 520;
  let notificationCollapsedSize = {
    width: NOTIF_WIDTH,
    height: NOTIF_HEIGHT,
  };

  let activeNotificationRecord: ActiveNotificationRecord | null = null;

  const resolveNotificationRecord = (
    record: ActiveNotificationRecord | null,
    outcome: NotificationOutcome,
  ) => {
    if (!record || record.resolved) return;
    record.resolved = true;
    if (record.ignoreTimer) clearTimeout(record.ignoreTimer);
    void record.created.then(() =>
      deps.gateway()?.resolveNotification(record.id, outcome),
    );
  };

  const notificationCategory = (notifType: NotifType | undefined): string => {
    switch (notifType) {
      case 'session-start-prompt':
        return 'session_start';
      case 'session-end-prompt':
        return 'session_end';
      case 'proactive-suggestion':
      case 'instant-suggestion':
        return 'proactive_suggestion';
      default:
        return 'general';
    }
  };

  const NOTIFICATION_IGNORE_MS = 5 * 60_000;

  // Record a shown notification with the gateway. One left unanswered resolves
  // as ignored after NOTIFICATION_IGNORE_MS, and onIgnored then runs.
  const createNotificationRecord = (
    payload: NotificationPayload,
    {
      id = randomUUID(),
      onIgnored,
    }: { id?: string; onIgnored?: () => void } = {},
  ): ActiveNotificationRecord => {
    const notifType = payload.sessionInvite
      ? 'session-start-prompt'
      : payload.notifType;
    const record: ActiveNotificationRecord = {
      id,
      resolved: false,
      created:
        deps.gateway()?.addNotification({
          id,
          category: payload.category ?? notificationCategory(notifType),
          notificationType: notifType ?? 'default',
          message: payload.message,
          shownAt: new Date(),
          sessionId: deps.sessionActive()
            ? (deps.sessionId() ?? undefined)
            : undefined,
          observationId: payload.observationId,
          actionLabel: payload.actionLabel,
          cancelLabel: payload.cancelLabel,
          status: payload.status,
          fourDDimension: payload.suggestion?.fourDDimension,
          triggerType: payload.suggestion?.triggerType,
        }) ?? Promise.resolve(),
    };
    record.ignoreTimer = setTimeout(() => {
      resolveNotificationRecord(record, 'ignored');
      onIgnored?.();
    }, NOTIFICATION_IGNORE_MS);
    return record;
  };

  const showNotification = (payload: NotificationPayload): boolean => {
    if (!deps.allowed() || (deps.sleeping() && payload.category !== 'system'))
      return false;
    if (deps.assessmentActive() && payload.category !== 'system') {
      log.info(
        `[Post-assessment] Dropped proactive notification ${payload.notifType ?? payload.category ?? 'general'}`,
      );
      return false;
    }
    if (payload.notifType === 'session-end-prompt' && deps.recapOpen()) {
      log.info(
        '[Notification] Session recap is already open; dropping wrap-up prompt.',
      );
      return false;
    }
    if (proactiveSuggestionOpen) {
      if (notificationWindow && !notificationWindow.isDestroyed()) {
        log.info(
          `[Notification] Interactive suggestion is open; dropping ${payload.notifType ?? 'default'} replacement.`,
        );
        return false;
      }
      // Recover from a stale lock if the window disappeared before its closed
      // callback ran. A missing window must never suppress notifications forever.
      proactiveSuggestionOpen = false;
    }
    if (payload.notifType !== 'proactive-suggestion') {
      deps.clearHiddenSuggestion();
    }
    if (
      notificationHovered &&
      notificationWindow &&
      !notificationWindow.isDestroyed()
    ) {
      log.info(
        '[Notification] Keeping hovered notification; dropping replacement.',
      );
      return false;
    }
    // Destroy any existing notification before showing a new one (dedup guard).
    notificationHovered = false;
    resolveNotificationRecord(activeNotificationRecord, 'ignored');
    notificationWindow?.destroy();

    const notificationRecord =
      payload.notifType !== 'daily-summary'
        ? createNotificationRecord(payload)
        : null;
    activeNotificationRecord = notificationRecord;

    const isInteractiveSuggestion =
      payload.notifType === 'proactive-suggestion' &&
      payload.suggestion != null;
    if (isInteractiveSuggestion) {
      notificationCollapsedSize = {
        width: NOTIF_SUGGESTION_WIDTH,
        height: NOTIF_SUGGESTION_HEIGHT,
      };
    } else if (payload.notifType === 'daily-summary') {
      notificationCollapsedSize = {
        width: NOTIF_DAILY_SUMMARY_WIDTH,
        height: NOTIF_DAILY_SUMMARY_HEIGHT,
      };
    } else {
      notificationCollapsedSize = { width: NOTIF_WIDTH, height: NOTIF_HEIGHT };
    }
    const { width: initialWidth, height: initialHeight } =
      notificationCollapsedSize;
    const { workArea } = screen.getPrimaryDisplay();
    const x = workArea.x + workArea.width - initialWidth - 16;
    const y = workArea.y + 16;
    const adjustable = deps.avatarHidden();

    const nextNotificationWindow = new BrowserWindow({
      show: false,
      x,
      y,
      width: initialWidth,
      height: initialHeight,
      transparent: true,
      frame: false,
      // The card draws its own CSS shadow; the native one would outline the
      // full transparent window bounds, including space below compact cards.
      hasShadow: false,
      alwaysOnTop: true,
      resizable: adjustable,
      minimizable: false,
      maximizable: false,
      minWidth: adjustable ? 320 : undefined,
      minHeight: adjustable ? 180 : undefined,
      skipTaskbar: process.platform !== 'darwin',
      webPreferences: { preload: deps.preload() },
    });
    if (process.platform === 'darwin') {
      nextNotificationWindow.excludedFromShownWindowsMenu = true;
    }
    configureFullscreenCompanionWindow(nextNotificationWindow);
    notificationWindow = nextNotificationWindow;

    // AI-upskilling suggestions open directly on the interactive framework
    // overview. Lock from the first page—not only after the user advances—so a
    // later observation cannot replace the card while it is being read/rendered.
    if (
      payload.notifType === 'proactive-suggestion' &&
      payload.scenario === 'ai_upskilling' &&
      payload.suggestion
    ) {
      proactiveSuggestionOpen = true;
    }

    const url = `${resolveHtmlPath('index.html')}?view=notification`;
    nextNotificationWindow.loadURL(url);

    nextNotificationWindow.on('ready-to-show', () => {
      if (notificationWindow !== nextNotificationWindow) return;
      nextNotificationWindow.showInactive();
      nextNotificationWindow.webContents.send('notification', {
        ...payload,
        notificationId: notificationRecord?.id,
        adjustable,
      });
    });

    nextNotificationWindow.on('closed', () => {
      resolveNotificationRecord(notificationRecord, 'ignored');
      // An older window can finish closing after its replacement was assigned.
      // Only the window that still owns the slot may clear the active lock.
      if (notificationWindow !== nextNotificationWindow) return;
      notificationWindow = null;
      if (activeNotificationRecord === notificationRecord) {
        activeNotificationRecord = null;
      }
      notificationHovered = false;
      proactiveSuggestionOpen = false;
    });
    return true;
  };

  // ── Session invite ────────────────────────────────────────────────────────────
  // Before a session exists, Coco offers one for the task the observer detected.
  // The invite previews a suggestion written for that moment: a bubble beside
  // Coco when the avatar is visible, otherwise the corner pop-up. Opening the
  // suggestion only shows it; "Chat with Coco" or "Run with Coco" starts the
  // session. If the writer abstains, the invite shows the detected task and
  // "Help me with this" starts the session. Either way it is recorded as a
  // session_start notification.

  const SESSION_INVITE_STRUGGLE_SECONDS = 120;

  interface SessionInviteContent {
    taskLabel: string;
    rawObservation: string;
    observationId?: string;
    suggestion?: InstantSuggestion;
  }

  // The invite bubble on the avatar. Its record is created only once the
  // renderer confirms the bubble is on screen, and shares the invite's id.
  let avatarInvite:
    | (SessionInviteContent & {
        id: string;
        record: ActiveNotificationRecord | null;
      })
    | null = null;
  // The observation behind the latest invite, so a slow preview for an older
  // invite is dropped.
  let latestInviteObservationId: string | undefined;
  let syntheticObsSeq = 0;
  // What the observer saw when it detected the invited task. Attached to the
  // user's first chat message if they accept an invite without a preview.
  let pendingInviteObservation = '';

  const sessionInvitePayload = (
    invite: SessionInviteContent,
  ): NotificationPayload =>
    invite.suggestion
      ? {
          message: invite.suggestion.title,
          actionLabel: 'Reveal full suggestion',
          notifType: 'proactive-suggestion',
          observationId: invite.observationId,
          status: 'task_suggested',
          rawObservation: invite.rawObservation,
          suggestion: invite.suggestion,
          scenario: deps.profile().scenario,
          sessionInvite: true,
        }
      : {
          message: invite.taskLabel,
          actionLabel: 'Help me with this',
          notifType: 'session-start-prompt',
          sessionInvite: true,
        };

  function clearAvatarInvite(outcome: NotificationOutcome) {
    const avatarWindow = deps.avatar();
    if (!avatarInvite) return;
    const { id, record } = avatarInvite;
    avatarInvite = null;
    resolveNotificationRecord(record, outcome);
    if (avatarWindow && !avatarWindow.isDestroyed()) {
      avatarWindow.webContents.send('session-invite-clear', { inviteId: id });
    }
  }

  const presentSessionInvite = (invite: SessionInviteContent) => {
    const avatarWindow = deps.avatar();
    clearAvatarInvite('ignored');
    if (
      deps.avatarHidden() ||
      !avatarWindow ||
      avatarWindow.isDestroyed() ||
      !avatarWindow.isVisible()
    ) {
      showNotification(sessionInvitePayload(invite));
      return;
    }
    avatarInvite = { ...invite, id: randomUUID(), record: null };
    avatarWindow.webContents.send('session-invite', {
      inviteId: avatarInvite.id,
      taskLabel: invite.taskLabel,
      observationId: invite.observationId,
      rawObservation: invite.rawObservation,
      suggestionTitle: invite.suggestion?.title,
    });
  };

  const showSessionInvite = (
    event: SuggestionObservation,
    taskLabel: string,
  ) => {
    if (!deps.allowed() || deps.assessmentActive()) return;
    if (!event.observation_id) {
      syntheticObsSeq += 1;
      event.observation_id = `invite-${Date.now()}-${syntheticObsSeq}`;
    }
    const observationId = event.observation_id;
    const rawObservation = event.observation
      ? cleanObservation(event.observation)
      : '';
    latestInviteObservationId = observationId;
    // Writing the preview takes several seconds; the invite waits for it.
    (deps.precompute(event) ?? Promise.resolve(null))
      .then((value) => {
        if (
          latestInviteObservationId !== observationId ||
          deps.sessionActive() ||
          deps.sleeping() ||
          !deps.allowed() ||
          deps.suspended() ||
          deps.assessmentActive()
        ) {
          return;
        }
        deps.setTaskLabel(taskLabel);
        pendingInviteObservation = rawObservation;
        let suggestion: InstantSuggestion | undefined;
        if (value) {
          suggestion =
            value.kind === 'delegate'
              ? {
                  ...value,
                  availableTools: deps.availableTools(value.targetTool),
                }
              : value;
        }
        presentSessionInvite({
          taskLabel,
          rawObservation,
          observationId: suggestion ? observationId : undefined,
          suggestion,
        });
      })
      .catch((err) => {
        log.warn(`[SessionInvite] Could not show invite: ${err}`);
      });
  };

  // Accepting an invite without a preview: prefill a message the user can edit
  // to correct the task, with the observation attached as removable context.
  const acceptSessionInvite = async () => {
    const taskLabel = deps.taskLabel() || 'General help session';
    const observation = pendingInviteObservation;
    pendingInviteObservation = '';
    const seed: ChatSeed = {
      phrase: '',
      label: taskLabel,
      rawObservation: '',
      ...(observation && { screenObservation: observation }),
      deferUntilUserMessage: true,
      draft: `I'm working on: ${taskLabel.replace(/[.\s]+$/, '')}. Help me with this.`,
    };
    // A session can begin some other way while the invite is up.
    if (deps.sessionActive() && deps.sessionId()) {
      deps.openChat(deps.sessionId()!, deps.taskLabel() || '', seed);
      return;
    }
    await deps.startSession(
      taskLabel,
      SESSION_INVITE_STRUGGLE_SECONDS,
      'proactive_suggestion',
      seed,
    );
  };

  deps.ipc.removeAllListeners('session-invite-shown');
  deps.ipc.on(
    'session-invite-shown',
    (_event, { inviteId }: { inviteId?: string }) => {
      if (
        !avatarInvite ||
        avatarInvite.id !== inviteId ||
        avatarInvite.record
      ) {
        return;
      }
      const invite = avatarInvite;
      invite.record = createNotificationRecord(sessionInvitePayload(invite), {
        id: invite.id,
        onIgnored: () => {
          if (avatarInvite === invite) clearAvatarInvite('ignored');
        },
      });
    },
  );

  // Once the user opens the full suggestion, the invite stays until they act
  // on it or close it, rather than expiring as ignored mid-read.
  deps.ipc.removeAllListeners('session-invite-revealed');
  deps.ipc.on(
    'session-invite-revealed',
    (_event, { inviteId }: { inviteId?: string }) => {
      if (!inviteId) return;
      let record: ActiveNotificationRecord | null = null;
      if (avatarInvite && avatarInvite.id === inviteId) {
        record = avatarInvite.record;
      } else if (activeNotificationRecord?.id === inviteId) {
        record = activeNotificationRecord;
      }
      if (record?.ignoreTimer) clearTimeout(record.ignoreTimer);
    },
  );

  // The avatar bubble is holding a suggestion the user opened, so the invite
  // goes to the corner pop-up instead.
  deps.ipc.removeAllListeners('session-invite-busy');
  deps.ipc.on(
    'session-invite-busy',
    (_event, { inviteId }: { inviteId?: string }) => {
      if (!avatarInvite || avatarInvite.id !== inviteId) return;
      const invite = avatarInvite;
      avatarInvite = null;
      showNotification(sessionInvitePayload(invite));
    },
  );

  // Dismissing an avatar invite, or accepting one without a preview. Previews
  // are accepted through chat-about-suggestion.
  deps.ipc.removeAllListeners('session-invite-response');
  deps.ipc.on(
    'session-invite-response',
    (
      _event,
      {
        inviteId,
        outcome,
      }: { inviteId?: string; outcome?: NotificationOutcome },
    ) => {
      if (!avatarInvite || avatarInvite.id !== inviteId) return;
      if (outcome !== 'accepted' && outcome !== 'dismissed') return;
      const { record } = avatarInvite;
      avatarInvite = null;
      resolveNotificationRecord(record, outcome);
      if (outcome === 'accepted') acceptSessionInvite();
    },
  );

  // "Help me with this" on a corner invite without a preview. Its outcome is
  // reported through notification-response like any other notification.
  deps.ipc.removeAllListeners('session-invite-accepted');
  deps.ipc.on('session-invite-accepted', () => {
    notificationWindow?.destroy();
    acceptSessionInvite();
  });

  deps.ipc.removeAllListeners('notification-response');
  deps.ipc.on(
    'notification-response',
    (
      _event,
      payload: { notificationId?: string; outcome?: NotificationOutcome },
    ) => {
      if (
        !payload?.notificationId ||
        payload.notificationId !== activeNotificationRecord?.id ||
        !['accepted', 'dismissed', 'ignored'].includes(payload.outcome ?? '')
      ) {
        return;
      }
      resolveNotificationRecord(
        activeNotificationRecord,
        payload.outcome as NotificationOutcome,
      );
    },
  );

  deps.ipc.removeAllListeners('notification');
  deps.ipc.on('notification', (_event, args) => {
    const { msg, buttonText } = args;
    showNotification({
      message: msg,
      actionLabel: buttonText,
      category: 'tutor_guidance',
    });
  });

  deps.ipc.removeAllListeners('notification-hover-state');
  deps.ipc.on(
    'notification-hover-state',
    (_event, { hovered }: { hovered?: boolean }) => {
      notificationHovered = hovered === true;
    },
  );

  deps.ipc.removeAllListeners('proactive-suggestion-open-state');
  deps.ipc.on(
    'proactive-suggestion-open-state',
    (_event, { open }: { open?: boolean }) => {
      proactiveSuggestionOpen = open === true;
    },
  );

  deps.ipc.removeAllListeners('set-notification-expanded');
  deps.ipc.on(
    'set-notification-expanded',
    (_event, { expanded }: { expanded?: boolean }) => {
      if (
        !deps.avatarHidden() ||
        !notificationWindow ||
        notificationWindow.isDestroyed()
      ) {
        return;
      }

      const current = notificationWindow.getBounds();
      const display = screen.getDisplayMatching(current);
      const targetWidth = expanded
        ? NOTIF_EXPANDED_WIDTH
        : notificationCollapsedSize.width;
      const targetHeight = expanded
        ? NOTIF_EXPANDED_HEIGHT
        : notificationCollapsedSize.height;
      const width = Math.min(targetWidth, display.workArea.width);
      const height = Math.min(targetHeight, display.workArea.height);

      // Preserve a user-dragged position where possible, while ensuring the
      // resized notification remains fully reachable on its current display.
      const x = Math.max(
        display.workArea.x,
        Math.min(
          current.x,
          display.workArea.x + display.workArea.width - width,
        ),
      );
      const y = Math.max(
        display.workArea.y,
        Math.min(
          current.y,
          display.workArea.y + display.workArea.height - height,
        ),
      );
      notificationWindow.setBounds({ x, y, width, height }, true);
    },
  );

  // AI-upskilling suggestion pages ask for a window height that fits their card.
  // Only the top edge stays put, so the pop-up grows or shrinks downward.
  deps.ipc.removeAllListeners('fit-notification-height');
  deps.ipc.on(
    'fit-notification-height',
    (event, { height }: { height?: unknown } = {}) => {
      if (
        !notificationWindow ||
        notificationWindow.isDestroyed() ||
        event.sender !== notificationWindow.webContents ||
        typeof height !== 'number' ||
        !Number.isFinite(height)
      ) {
        return;
      }
      const current = notificationWindow.getBounds();
      const { workArea } = screen.getDisplayMatching(current);
      const maxHeight = Math.min(
        NOTIF_SUGGESTION_MAX_HEIGHT,
        workArea.y + workArea.height - current.y,
      );
      const fitted = Math.round(
        Math.max(NOTIF_SUGGESTION_MIN_HEIGHT, Math.min(height, maxHeight)),
      );
      if (fitted !== current.height) {
        notificationWindow.setBounds({ ...current, height: fitted });
      }
    },
  );

  return {
    showNotification,
    showSessionInvite,
    clearAvatarInvite,
    get window() {
      return notificationWindow;
    },
    dismissNotification: () => notificationWindow?.destroy(),
    setHovered: (hovered: boolean) => {
      notificationHovered = hovered;
    },
    setSuggestionOpen: (open: boolean) => {
      proactiveSuggestionOpen = open;
    },
    invalidateInvite: () => {
      latestInviteObservationId = undefined;
    },
    acceptPreview: (inviteId?: string) => {
      if (!avatarInvite || avatarInvite.id !== inviteId) return false;
      resolveNotificationRecord(avatarInvite.record, 'accepted');
      avatarInvite = null;
      return true;
    },
    clearPendingObservation: () => {
      pendingInviteObservation = '';
    },
    dispose: () => {
      latestInviteObservationId = undefined;
      clearAvatarInvite('ignored');
      resolveNotificationRecord(activeNotificationRecord, 'ignored');
      notificationWindow?.destroy();
    },
  };
}
