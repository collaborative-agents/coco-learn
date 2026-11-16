import { S } from './styles';
import HeaderActionIcon from './WorkspaceIcon';
import WindowControls from './WindowControls';
import { useEffect, useRef } from 'react';

export interface ConversationTab {
  sessionId: string;
  title: string;
}

interface Props {
  chatEnabled: boolean;
  sending: boolean;
  startingNewSession: boolean;
  handleNewSession: () => Promise<void>;
  expanded: boolean;
  changeExpanded: (value: boolean) => void;
  tabs?: ConversationTab[];
  selectedId?: string | null;
  switching?: boolean;
  onSelectTab?: (sessionId: string) => void;
  onCloseTab?: (sessionId: string) => void;
}

export default function ChatHeader({
  chatEnabled,
  startingNewSession,
  handleNewSession,
  expanded,
  changeExpanded,
  tabs = [],
  selectedId,
  switching = false,
  onSelectTab,
  onCloseTab,
}: Props) {
  const tabList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabList.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selectedId]);
  return (
    <div
      className="workspace-chat-actions"
      role="group"
      aria-label="Chat actions"
    >
      <div
        className="workspace-session-tabs"
        role="tablist"
        aria-label="Chat sessions"
        ref={tabList}
      >
        {tabs.map((tab, index) => (
          <div
            className="workspace-session-tab"
            key={tab.sessionId}
            role="presentation"
            data-active={selectedId === tab.sessionId}
          >
            <button
              type="button"
              role="tab"
              className="workspace-session-tab-button"
              aria-selected={selectedId === tab.sessionId}
              aria-controls="chat-session-panel"
              tabIndex={selectedId === tab.sessionId ? 0 : -1}
              aria-disabled={switching}
              title={tab.title}
              onClick={() => onSelectTab?.(tab.sessionId)}
              onKeyDown={(event) => {
                if (switching) return;
                let next = index;
                if (event.key === 'ArrowRight')
                  next = (index + 1) % tabs.length;
                else if (event.key === 'ArrowLeft')
                  next = (index + tabs.length - 1) % tabs.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = tabs.length - 1;
                else return;
                event.preventDefault();
                tabList.current
                  ?.querySelectorAll<HTMLElement>('[role="tab"]')
                  [next]?.focus();
                onSelectTab?.(tabs[next].sessionId);
              }}
            >
              <HeaderActionIcon name="chat" />
              <span>{tab.title}</span>
            </button>
            <button
              type="button"
              className="workspace-session-tab-close"
              aria-label={`Close ${tab.title} tab`}
              title="Close tab"
              disabled={switching || startingNewSession}
              onClick={() => onCloseTab?.(tab.sessionId)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        style={{
          ...S.newSessionBtn,
          ...(startingNewSession || switching || !chatEnabled
            ? S.sendBtnDisabled
            : {}),
        }}
        data-coaching-control="new"
        title="Start a new session"
        aria-label="Start a new session"
        disabled={startingNewSession || switching || !chatEnabled}
        onClick={handleNewSession}
      >
        <HeaderActionIcon name="new" />
        <span>{startingNewSession ? 'Starting…' : 'New'}</span>
      </button>
      <div className="workspace-tab-window-controls">
        <WindowControls expanded={expanded} onExpandedChange={changeExpanded} />
      </div>
    </div>
  );
}
