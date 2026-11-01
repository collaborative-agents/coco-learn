import isQuestConversation from './quest-conversations';

test('identifies all legacy quest chapters while retaining ordinary conversations', () => {
  for (let chapter = 1; chapter <= 5; chapter += 1) {
    expect(isQuestConversation({ problem: `Chapter ${chapter} · Quest` })).toBe(
      true,
    );
  }
  expect(isQuestConversation({ problem: 'Help me write chapter 1' })).toBe(
    false,
  );
  expect(isQuestConversation({ problem: 'General help session' })).toBe(false);
  expect(
    isQuestConversation({ agent101Quest: true, problem: 'Renamed task' }),
  ).toBe(true);
});
