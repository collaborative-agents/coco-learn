import type { MenuItemConstructorOptions } from 'electron';

export function avatarRecoveryItems(
  hidden: boolean,
  showAvatar: () => void,
): MenuItemConstructorOptions[] {
  return hidden ? [{ label: 'Show Coco', click: showAvatar }] : [];
}
