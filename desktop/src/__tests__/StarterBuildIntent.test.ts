import { isStarterBuildRequest } from '../shared/runner-tutorial';
it.each(["Let's guid a game", "Let's build a game", 'A number-guessing game', 'picked', 'I picked a folder', 'Can you build a game?', 'ready'])('recognizes a build request or confirmation: %s', text => {
 expect(isStarterBuildRequest(text)).toBe(true);
});
it.each(['who are you', 'What game are we building?', 'How do I pick a folder?', "don't build a game", 'not now', 'Can you explain what a game is?'])('leaves questions and refusals to chat: %s', text => {
 expect(isStarterBuildRequest(text)).toBe(false);
});
