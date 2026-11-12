import { useEffect, useRef, useState } from 'react';
import {
  InstantSuggestion,
  ObservationStatus,
  STATUS_LABEL,
} from './observation-types';
import {
  buildFrameworkOverview,
  buildSuggestionExplanation,
} from './framework-overview';
import RatingButtons from './RatingButtons';
import { getGettingStartedArticle, gettingStartedPrompt, gettingStartedStarterPrompt } from '../../shared/getting-started';

export type GettingStartedPhase = 'intro' | 'choose' | 'reading' | 'invite' | 'first' | 'first-done' | 'create';

export interface BubbleState {
  runnerTutorial?: { sessionId: string; action?: import('../../shared/runner-tutorial').RunnerAction };
  /** Local, interactive onboarding uses the same bubble surface as live advice. */
  guide?: { label: string; action?: string; dismissible?: boolean; busy?: boolean };
  status: ObservationStatus;
  phrase: string;
  fadingOut: boolean;
  /** Tier 2: show "Help me with this" button immediately. */
  showHelpButton?: boolean;
  /**
   * Raw observation text from the sensing server (cleaned of JSON wrappers /
   * bracketed metadata). Sent to the webapp as context when the user taps
   * "Help me with this", so the tutor and the chat history both show what
   * triggered the request.
   */
  rawObservation?: string;
  /** Stable id of the observer call behind this bubble (for feedback joins). */
  observationId?: string;
  /**
   * Tier 3: raw tutor guidance text. When set, the bubble renders a truncated
   * preview of the message instead of the observer phrase, plus a
   * "View conversation" button.
   */
  tutorMessage?: string;
  agentReply?: { sessionId: string; requestId: string };
  agentWorking?: { sessionId: string; requestId: string };
  /**
   * Instant suggestion revealed in-place after the user clicks "Help me with
   * this" (pre-computed while the bubble was on screen). When set, the bubble
   * shows the content or delegation prompt with one Chat/Run with Coco action
   * instead of the "Help me with this" button.
   */
  suggestion?: InstantSuggestion;
  /** Tutor mode active when the suggestion was generated. */
  scenario?: string;
  /**
   * Set when the bubble is a session invite. The phrase is the previewed
   * suggestion's title, or the detected task when there is no preview.
   */
  invite?: { inviteId: string; hasPreview: boolean };
  gettingStarted?: { articleId: string | null; phase: GettingStartedPhase };
}

const PREVIEW_CHARS = 120;

function truncatePreview(text: string): string {
  if (text.length <= PREVIEW_CHARS) return text;
  const cutoff = text.lastIndexOf(' ', PREVIEW_CHARS);
  const end = cutoff > 40 ? cutoff : PREVIEW_CHARS;
  return `${text.slice(0, end)}…`;
}

function formatMetricTokens(n?: number): string {
  if (typeof n !== 'number') return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function formatMetricLatency(ms?: number): string {
  if (typeof ms !== 'number') return '0s';
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;
  return `${Math.round(ms)}ms`;
}

function suggestionToolLabel(suggestion: InstantSuggestion): string {
  const preferred = (suggestion.availableTools ?? []).find(
    (tool) => tool.id === suggestion.targetTool,
  );
  if (preferred) return preferred.label;
  if (suggestion.availableTools?.[0]) return suggestion.availableTools[0].label;
  return 'an AI tool';
}

export default function ObservationBubble({
  bubble,
  onHelpMe,
  onDismiss,
  onViewConversation,
  onChatAboutSuggestion,
  onRunSuggestion,
  onMouseEnter,
  onMouseLeave,
}: {
  bubble: BubbleState | null;
  onHelpMe?: () => void;
  onDismiss?: () => void;
  onViewConversation?: () => void;
  onChatAboutSuggestion?: () => void;
  onRunSuggestion?: () => void;
  /** Hovering pauses the auto-hide so the user can read / copy the bubble. */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  // Local clicked state: shows "Opening…" immediately after the user taps the
  // button so there is visible confirmation while the suggestion is fetched.
  const [helpClicked, setHelpClicked] = useState(false);
  // Transient confirmation shown after Copy / Approve.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Current rating for the revealed suggestion. The opposite thumb remains
  // available so an accidental rating can be corrected.
  const [rated, setRated] = useState<'up' | 'down' | null>(null);
  const [suggestionPage, setSuggestionPage] = useState<0 | 1>(0);
  // The "?" explanation opens inside the card: the bubble window is sized to
  // the card, so anything drawn outside it would be clipped.
  const [helpTipOpen, setHelpTipOpen] = useState(false);
  // When the suggestion was revealed — lets latency_s capture time-to-rate.
  const suggestionShownAt = useRef<number>(Date.now());

  // Reset clicked state when a new observation arrives. ObservationBubble is
  // never remounted between observations (same position in the tree), so local
  // state would otherwise carry over from a previous bubble and leave the button
  // permanently stuck in the "Opening…" / disabled state.
  useEffect(() => {
    setHelpClicked(false);
    setToast(null);
    setRated(null);
    setHelpTipOpen(false);
  }, [bubble?.status, bubble?.phrase]);

  useEffect(() => {
    if (bubble?.suggestion) {
      suggestionShownAt.current = Date.now();
      setSuggestionPage(0);
    }
  }, [bubble?.suggestion]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  if (!bubble) return null;
  if (bubble.guide) {
    return (
      <div className={`observation-bubble is-guide status-${bubble.status}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <div className="observation-bubble-header">
          <div className="observation-bubble-label">{bubble.guide.label}</div>
          {bubble.guide.dismissible && bubble.runnerTutorial && <button type="button" aria-label="Close tip" title="Dismiss" className="bubble-dismiss-btn" onClick={onDismiss}>×</button>}
        </div>
        <div className="observation-bubble-text">{bubble.phrase}</div>
        {bubble.guide.action && <button type="button" className="bubble-action-btn" disabled={bubble.guide.busy} onClick={onHelpMe}>{bubble.guide.action}</button>}
        {bubble.guide.dismissible && !bubble.runnerTutorial && <button type="button" aria-label={bubble.runnerTutorial ? 'Close tip' : undefined} className="bubble-dismiss-btn guide-decline" onClick={onDismiss}>{bubble.runnerTutorial ? '✕' : 'No thanks'}</button>}
        <span className="observation-bubble-tail" aria-hidden />
      </div>
    );
  }
  if (bubble.gettingStarted) {
    const article = bubble.gettingStarted.articleId
      ? getGettingStartedArticle(bubble.gettingStarted.articleId)
      : undefined;
    const phase = bubble.gettingStarted.phase;
    let message = '';
    let prompt: string | null = null;
    let tip: string | null = null;
    let actionLabel: string | null = null;
    switch (phase) {
      case 'intro':
        message = 'Hi, I’m Coco. We’ll read one short article, try a real conversation, then make an animated web page. We can take it one step at a time.';
        actionLabel = 'Choose an article ↗';
        break;
      case 'choose':
        message = 'Pick whichever article interests you. Read it at your own pace; I’ll wait here.';
        break;
      case 'reading':
        message = `You chose “${article?.title ?? 'this article'}.” Take your time with it. When you have the main idea, tell me you’re ready.`;
        actionLabel = 'I’ve read it';
        break;
      case 'invite':
        message = 'Now let’s go to Chat. You can ask in your own words; I’ll offer an example and explain why it works.';
        actionLabel = 'Open Chat ↗';
        break;
      case 'first':
        message = 'What would you like to understand or explain from this article? Write your own question in Chat, or copy this starting point:';
        prompt = article ? gettingStartedStarterPrompt(article) : null;
        tip = 'Why it works: it names the source, audience, time limit, example, and what to leave out.';
        actionLabel = 'I tried Coco ↗';
        break;
      case 'first-done':
        message = 'You’ve tried Coco in Chat. When you’re ready, let’s ask it to build something you can keep.';
        actionLabel = 'Show the page prompt ↗';
        break;
      case 'create':
        message = `Let’s turn “${article?.title ?? 'your article'}” into an animated web page. Here’s the complete prompt:`;
        prompt = article ? gettingStartedPrompt(article) : null;
        actionLabel = 'Go to Chat ↗';
        break;
      default:
        break;
    }
    return (
      <div className="observation-bubble getting-started-bubble" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <div className="observation-bubble-header">
          <div className="observation-bubble-label">Coco · Getting Started</div>
          <button type="button" className="bubble-dismiss-btn" aria-label="Dismiss" onClick={onDismiss}>×</button>
        </div>
        <div className="observation-bubble-text getting-started-bubble-intro">{message}</div>
        {prompt && <pre className="getting-started-bubble-prompt">{prompt}</pre>}
        {tip && <p className="getting-started-bubble-tip">{tip}</p>}
        {(prompt || actionLabel) && (
          <div className="bubble-tool-actions getting-started-bubble-actions">
            {prompt && <button type="button" className="bubble-action-btn" onClick={() => { navigator.clipboard.writeText(prompt).then(() => showToast('Copied prompt')).catch(() => showToast('Could not copy')); }}>Copy prompt</button>}
            {actionLabel && <button type="button" className="bubble-action-btn bubble-tool-btn" onClick={onChatAboutSuggestion}>{actionLabel}</button>}
          </div>
        )}
        {toast && <div role="status" className="observation-bubble-toast">{toast}</div>}
        <span className="observation-bubble-tail" aria-hidden />
      </div>
    );
  }
  const {
    status,
    phrase,
    fadingOut,
    showHelpButton,
    tutorMessage,
    suggestion,
  } = bubble;
  const isTier3 = !!tutorMessage;
  const isFrameworkPager =
    suggestion != null && bubble.scenario === 'ai_upskilling';
  const isFrameworkOverview = isFrameworkPager && suggestionPage === 0;
  const runWithCoco =
    suggestion?.kind === 'delegate' && Boolean(onRunSuggestion);
  const explanation = suggestion
    ? buildSuggestionExplanation(suggestion)
    : null;
  const frameworkOverview = suggestion
    ? buildFrameworkOverview(
        suggestion,
        suggestionToolLabel(suggestion),
        bubble.rawObservation,
      )
    : null;
  const label = bubble.agentWorking
    ? 'Working'
    : bubble.agentReply
      ? 'Reply ready'
      : isTier3
        ? 'AI Tutor'
        : bubble.invite
          ? 'Support available'
          : (STATUS_LABEL[status] ?? STATUS_LABEL.observing);

  // Rate the revealed suggestion. Logged into feedback.jsonl via the sensing
  // server so it joins observations by observation_id.
  const rate = (dir: 'up' | 'down') => {
    if (rated === dir || !suggestion) return;
    const previousRating = rated;
    setRated(dir);
    window.electron?.ipcRenderer.sendMessage('training-feedback', {
      kind: dir === 'up' ? 'thumbs_up' : 'thumbs_down',
      previous_kind: previousRating ? `thumbs_${previousRating}` : null,
      surface: 'bubble',
      observation_id: bubble?.observationId ?? null,
      status,
      latency_s: (Date.now() - suggestionShownAt.current) / 1000,
      text: suggestion.copyText ?? null,
    });
    window.electron?.ipcRenderer.sendMessage('activity-support-rated', {
      observationId: bubble?.observationId ?? null,
      rating: dir,
      ratedAt: Math.floor(Date.now() / 1000),
    });
    showToast(previousRating ? 'Feedback updated' : 'Thanks for the feedback');
  };

  const ratingButtons =
    suggestion && !isFrameworkOverview ? (
      <RatingButtons
        value={rated}
        onRate={rate}
        labels={{ up: 'Good suggestion', down: 'Not helpful' }}
        className="coco-rating--compact"
      />
    ) : null;

  return (
    <div
      className={`observation-bubble status-${status}${fadingOut ? ' is-leaving' : ''}${isTier3 ? ' is-tier3' : ''}${suggestion ? ' has-suggestion' : ''}${isFrameworkOverview ? ' is-framework-overview' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="observation-bubble-header">
        <div className="observation-bubble-label">
          {/* eslint-disable-next-line no-nested-ternary */}
          {isFrameworkOverview
            ? (explanation?.competency ?? '4D framework')
            : suggestion
              ? suggestion.title
              : label}
        </div>

        {/* Tier-1 (progress/observing): no suggestion. A passive "?" explains that
          there's nothing proactive right now and points to clicking the pet. */}
        {!isTier3 && !showHelpButton && !suggestion && (
          <button
            type="button"
            className="bubble-help-badge"
            aria-label="Why no suggestion?"
            aria-expanded={helpTipOpen}
            onClick={() => setHelpTipOpen((open) => !open)}
          >
            ?
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            className="bubble-dismiss-btn"
            aria-label="Dismiss"
            title="Dismiss"
            onClick={onDismiss}
          >
            ×
          </button>
        )}
      </div>

      {/* eslint-disable-next-line no-nested-ternary */}
      {isFrameworkOverview && explanation ? (
        <div className="bubble-framework-overview">
          {explanation.sentences.map((sentence, index) => (
            <div
              key={sentence}
              className={`bubble-why-line${index === 0 ? ' bubble-why-line--lead' : ''}`}
            >
              {sentence}
            </div>
          ))}
        </div>
      ) : isFrameworkOverview && suggestion ? (
        <div className="bubble-framework-overview">
          <div className="bubble-framework-heading">
            {frameworkOverview?.heading}
          </div>
          {frameworkOverview?.concepts.map((concept) => (
            <div className="bubble-framework-concept" key={concept.term}>
              <span className="bubble-framework-term">{concept.term}</span>
              <span>{concept.explanation}</span>
            </div>
          ))}
        </div>
      ) : suggestion ? (
        <div className="observation-bubble-text observation-suggestion-body">
          {suggestion.kind === 'delegate' ? suggestion.prompt : suggestion.body}
        </div>
      ) : isTier3 ? (
        <div className="observation-bubble-text observation-bubble-tutor-preview">
          {truncatePreview(tutorMessage)}
        </div>
      ) : (
        <div className="observation-bubble-text">{phrase}</div>
      )}

      {helpTipOpen && (
        <p className="bubble-help-tip">
          No proactive suggestion right now. If you still need help, click me
          (the fox) to open the chat.
        </p>
      )}

      {suggestion?.llm_metrics && !isFrameworkOverview && (
        <div className="bubble-metrics-row">
          <span>
            {formatMetricTokens(
              suggestion.llm_metrics.input_tokens ??
                suggestion.llm_metrics.prompt_tokens,
            )}{' '}
            in
          </span>
          <span>
            {formatMetricTokens(
              suggestion.llm_metrics.output_tokens ??
                suggestion.llm_metrics.completion_tokens,
            )}{' '}
            out
          </span>
          <span>{formatMetricLatency(suggestion.llm_metrics.duration_ms)}</span>
        </div>
      )}

      {suggestion && !isFrameworkOverview && (
        <div className="bubble-tool-actions">
          <button
            type="button"
            className="bubble-action-btn bubble-chat-action"
            onClick={runWithCoco ? onRunSuggestion : onChatAboutSuggestion}
          >
            {runWithCoco ? 'Run with Coco' : 'Chat with Coco'}
          </button>
        </div>
      )}

      {/* Rate the suggestion; the opposite choice stays editable. */}
      {ratingButtons && !isFrameworkPager && (
        <div className="bubble-feedback-row">{ratingButtons}</div>
      )}

      {isFrameworkPager && (
        <div className="bubble-framework-pager" aria-label="Suggestion pages">
          {ratingButtons && (
            <div className="bubble-pager-rating">{ratingButtons}</div>
          )}
          <div className="bubble-framework-page-bars" aria-hidden="true">
            <span
              className={`bubble-framework-page-bar${suggestionPage === 0 ? ' is-active' : ''}`}
            />
            <span
              className={`bubble-framework-page-bar${suggestionPage === 1 ? ' is-active' : ''}`}
            />
          </div>
          <button
            type="button"
            className="bubble-framework-arrow"
            onClick={() => setSuggestionPage(suggestionPage === 0 ? 1 : 0)}
          >
            {suggestionPage === 0 ? 'Show me how →' : '← Why'}
          </button>
        </div>
      )}

      {isTier3 && (
        <button
          type="button"
          className="bubble-action-btn"
          onClick={onViewConversation}
        >
          {bubble.agentWorking
            ? 'View progress →'
            : bubble.agentReply
              ? 'View reply →'
              : 'View conversation →'}
        </button>
      )}

      {!isTier3 && !suggestion && showHelpButton && (
        <button
          type="button"
          className={`bubble-action-btn${helpClicked ? ' is-clicked' : ''}`}
          disabled={helpClicked}
          onClick={() => {
            setHelpClicked(true);
            onHelpMe?.();
          }}
        >
          {helpClicked ? 'Opening…' : 'Help me with this'}
        </button>
      )}

      {toast && <div className="observation-bubble-toast">{toast}</div>}

      <span className="observation-bubble-tail" aria-hidden />
    </div>
  );
}
