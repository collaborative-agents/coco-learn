import { avatarRecoveryItems, cocoNavigationItems } from './avatar-menu';

it('shares the avatar navigation order and routes each tray shortcut', () => {
  const actions = {
    'open-main-window': jest.fn(),
    'open-training': jest.fn(),
    'open-chat-settings': jest.fn(),
  };
  const items = cocoNavigationItems(actions);
  expect(items.map(({ label }) => label)).toEqual([
    'Open Chat',
    'Training',
    'Settings',
  ]);
  items.forEach((item) => (item.click as () => void)());
  Object.values(actions).forEach((action) =>
    expect(action).toHaveBeenCalledTimes(1),
  );
});

describe('Tray avatar recovery', () => {
  it('offers a direct restore action when the avatar is hidden', () => {
    const show = jest.fn();
    const items = avatarRecoveryItems(true, show);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Show Coco');
    (items[0].click as () => void)();
    expect(show).toHaveBeenCalledTimes(1);
  });
  it('does not offer restore when the avatar is already visible', () => {
    expect(avatarRecoveryItems(false, jest.fn())).toEqual([]);
  });
});
