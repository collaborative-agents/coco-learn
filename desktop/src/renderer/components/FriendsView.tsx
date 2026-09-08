import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DirectMessage, DirectMessagePage, FriendshipList } from '../../main/services/social-service';

// Separate from tutor conversations: human messages never start a tutor session.
export default function FriendsView({ onClose }: { onClose: () => void }) {
  const [inbox, setInbox] = useState<FriendshipList>({ friends: [], incoming: [], outgoing: [] });
  const [username, setUsername] = useState('');
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [before, setBefore] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const historyLoaded = useRef(false);
  const invoke = window.electron.ipcRenderer.invoke;

  const refresh = useCallback(async () => {
    const current = generation.current;
    try {
      const next = await invoke('social-list-friendships') as FriendshipList;
      const page = selected
        ? await invoke('social-list-messages', selected) as DirectMessagePage : null;
      if (current !== generation.current) return;
      setInbox(next);
      if (page) {
        setMessages((previous) => {
          const merged = new Map(previous.map((message) => [message._id, message]));
          page.messages.forEach((message) => merged.set(message._id, message));
          return [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
        if (!historyLoaded.current) setBefore(page.next_before ?? null);
        await invoke('social-mark-read', selected);
      }
      if (current === generation.current) setError('');
    } catch (e) {
      if (current === generation.current) setError(`Could not load Friends. ${String(e)}`);
    }
  }, [invoke, selected]);

  useEffect(() => {
    generation.current += 1;
    let running = false;
    const poll = async () => {
      if (running) return;
      running = true;
      try { await refresh(); } finally { running = false; }
    };
    void poll();
    const timer = setInterval(() => { void poll(); }, 5000);
    return () => { clearInterval(timer); generation.current += 1; };
  }, [refresh]);

  const act = async (action: () => Promise<unknown>, reload = true) => {
    if (busy) return;
    setBusy(true);
    try { await action(); if (reload) await refresh(); } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  return (
    <section aria-label="Friends" style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'white', padding: 20, overflow: 'auto', color: '#243349' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Friends — chat with people</h2><button type="button" onClick={onClose}>Back to CoCo</button>
      </header>
      <p>Messages go to your friend, not the AI tutor. Both people need a CoCo Learn account.</p>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); void act(async () => { await invoke('social-request-friend', username.trim()); setUsername(''); }); }}>
        <input aria-label="Friend username" placeholder="Exact username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button type="submit" disabled={busy || !username.trim()}>Add friend</button>
      </form>
      {inbox.incoming.map((friend) => <p key={friend.friendship_id}>
        {friend.participant_id} wants to connect.{' '}
        <button disabled={busy} type="button" onClick={() => void act(() => invoke('social-accept-friend', friend.friendship_id))}>Accept</button>{' '}
        <button disabled={busy} type="button" onClick={() => void act(() => invoke('social-decline-friend', friend.friendship_id))}>Decline</button>
      </p>)}
      {inbox.outgoing.map((friend) => <p key={friend.friendship_id}>Request pending: {friend.participant_id}</p>)}
      <nav aria-label="Friends list" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        {inbox.friends.map((friend) => <button type="button" disabled={busy} key={friend.participant_id} aria-pressed={selected === friend.participant_id} onClick={() => { if (selected === friend.participant_id) return; generation.current += 1; historyLoaded.current = false; setSelected(friend.participant_id); setMessages([]); setDraft(''); setBefore(null); }}>
          {friend.participant_id}{friend.unread_count ? ` (${friend.unread_count} unread)` : ''}
        </button>)}
      </nav>
      {!inbox.friends.length && <p>Add a friend by username. You can chat after they accept.</p>}
      {selected && <>
        <h3>Chat with {selected}</h3>
        {before && <button type="button" disabled={busy} onClick={() => void act(async () => {
          const page = await invoke('social-list-messages', selected, before) as DirectMessagePage;
          historyLoaded.current = true;
          setMessages((previous) => [...new Map([...page.messages, ...previous].map((message) => [message._id, message])).values()]); setBefore(page.next_before ?? null);
        }, false)}>Load earlier messages</button>}
        <div aria-label="Human messages" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
          {messages.map((message) => <div key={message._id} style={{ padding: 12, marginBottom: 8, background: '#f0f4fa', borderRadius: 8 }}>
            <strong>{message.sender_id}</strong>{' '}<time>{new Date(message.created_at).toLocaleString()}</time>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.content}</p>
          </div>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void act(async () => { await invoke('social-send-message', selected, draft); setDraft(''); }); }}>
          <textarea aria-label="Message to friend" maxLength={4000} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: '100%', minHeight: 80 }} />
          <button type="submit" disabled={busy || !draft.trim()}>Send to friend</button>
        </form>
      </>}
    </section>
  );
}
