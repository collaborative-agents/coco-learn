# Contextual Back to my idea button

The floating guide keeps its teaching text, but removes its focus/navigation action while the matching game conversation is the visible, focused chat. The action is available from Training, Settings, another conversation, or while the chat is hidden or unfocused. Other actions, including Retry and Play, are preserved.

The chat renderer reports its actual page and displayed conversation through a sender-checked IPC message. Native focus, visibility, minimize and restore events refresh the presentation. The original guide is retained so its navigation action can return when useful. Dismissal clears the active guide to prevent navigation from resurrecting it.

Verification: 76 focused tests passed across guide-presentation, chat-context and avatar suites. TypeScript and the development main build passed. The real isolated app verified hidden coaching/Welcome back actions in chat, visible return actions in Training/Settings, and preserved dismissal across navigation. It used default permissions and did not answer approvals.

[Welcome back in chat](08-welcome-already-in-chat.png) · [Coaching in chat](06-already-in-chat.png) · [Return action from Training](07-return-from-training.png) · [Live results](results.json).

Earlier harness failures are retained in sibling capture-attempt/dismiss-click-attempt directories. Both passed the contextual-button checks; one subsequently tried to capture an interpretation cleared by resume, and another raced the native No thanks click. The final targeted verifier uses the actual dismissal IPC handler and passes. This is app-level verification, not certification of physical macOS input.
