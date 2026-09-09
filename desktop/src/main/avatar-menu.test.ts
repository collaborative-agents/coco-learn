import { avatarRecoveryItems } from './avatar-menu';

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
