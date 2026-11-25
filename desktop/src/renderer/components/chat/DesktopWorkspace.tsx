import { useRef, type ReactNode } from 'react';
import cocoIcon from '../../../../assets/icon.png';
import WorkspaceIcon from './WorkspaceIcon';
import WindowControls from './WindowControls';
import './DesktopWorkspace.css';
import type { RunnerGuide } from '../../../shared/runner-tutorial';
import GuideSpotlight from '../getting-started/GuideSpotlight';

interface Props {
  expanded: boolean;
  chatInvited?: boolean;
  guideHighlight?: RunnerGuide['highlight'];
  anchoredGuide?: RunnerGuide;
  onGuideControlUsed?: (target: RunnerGuide['highlight']) => void;
  onExpandedChange: (expanded: boolean) => void;
  active: 'chat' | 'tasks' | 'settings';
  historyOpen: boolean;
  onHistoryOpen: () => void;
  onHistoryClose: () => void;
  onNavigate: (page: 'chat' | 'tasks' | 'settings') => void;
  history: ReactNode;
  children: ReactNode;
  details: ReactNode;
}

export default function DesktopWorkspace({
  expanded,
  chatInvited = false,
  guideHighlight,
  anchoredGuide,
  onGuideControlUsed,
  onExpandedChange,
  active,
  historyOpen,
  onHistoryOpen,
  onHistoryClose,
  onNavigate,
  history,
  children,
  details,
}: Props) {
  const chatButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      className={`desktop-workspace ${expanded ? 'is-expanded' : 'is-collapsed'}${window.electron?.platform === 'darwin' ? ' has-native-titlebar' : ''}`}
      data-coaching-target={guideHighlight}
      onClickCapture={event => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-coaching-control]');
        if (button && !button.disabled) onGuideControlUsed?.(button.dataset.coachingControl as RunnerGuide['highlight']);
      }}
    >
      <GuideSpotlight target={guideHighlight} guide={anchoredGuide} />
      {window.electron?.platform === 'darwin' && (
        <div className="workspace-native-titlebar" aria-hidden="true" />
      )}
      <div
        className="workspace-navigation"
        role="presentation"
        onMouseLeave={onHistoryClose}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            onHistoryClose();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            chatButtonRef.current?.focus();
            onHistoryClose();
            event.stopPropagation();
          }
        }}
      >
        <nav className="workspace-rail" aria-label="Main navigation">
          <div className="workspace-logo">
            <img src={cocoIcon} alt="Coco" />
          </div>
          <div className="workspace-rail-pages">
            <button
              ref={chatButtonRef}
              type="button"
              title="Chat"
              aria-label="Chat"
              data-guided-target={chatInvited ? 'true' : undefined}
              aria-current={active === 'chat' ? 'page' : undefined}
              aria-expanded={historyOpen}
              aria-controls="conversation-sidebar"
              onMouseEnter={onHistoryOpen}
              onFocus={onHistoryOpen}
              onClick={() => onNavigate('chat')}
            >
              <WorkspaceIcon name="chat" />
            </button>
            <button
              type="button"
              title="Training tasks"
              data-coaching-control="training"
              aria-label="Training tasks"
              aria-current={active === 'tasks' ? 'page' : undefined}
              onMouseEnter={onHistoryClose}
              onClick={() => onNavigate('tasks')}
            >
              <WorkspaceIcon name="todo" />
            </button>
          </div>
          <button
            type="button"
            className="workspace-settings-button"
            title="Settings"
            aria-label="Settings"
            aria-current={active === 'settings' ? 'page' : undefined}
            onMouseEnter={onHistoryClose}
            onClick={() => onNavigate('settings')}
          >
            <WorkspaceIcon name="settings" />
          </button>
        </nav>
        {historyOpen && history}
      </div>
      <section
        className="workspace-chat"
        aria-label="Chat"
        hidden={active !== 'chat'}
      >
        {children}
      </section>
      <section
        className="workspace-details"
        aria-label={
          active === 'settings' ? 'Settings panel' : 'Training tasks panel'
        }
        hidden={active === 'chat'}
      >
        <header className="workspace-page-header">
          <span>Coco</span>
          <div className="workspace-window-controls">
            <WindowControls
              expanded={expanded}
              onExpandedChange={onExpandedChange}
            />
          </div>
        </header>
        <div className="workspace-page-content">{details}</div>
      </section>
    </div>
  );
}
