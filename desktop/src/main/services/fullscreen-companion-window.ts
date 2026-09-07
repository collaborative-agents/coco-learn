import type { BrowserWindow } from 'electron';

type CompanionWindow = Pick<
  BrowserWindow,
  'setAlwaysOnTop' | 'setVisibleOnAllWorkspaces'
>;

/**
 * Keep a lightweight companion surface above the user's current app, including
 * inside another app's macOS fullscreen Space.
 */
export default function configureFullscreenCompanionWindow(
  window: CompanionWindow,
  platform: string = process.platform,
): void {
  window.setAlwaysOnTop(true, 'floating');
  if (platform === 'darwin') {
    window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      // Avoid the process-type transformation that can remove the running
      // indicator from the Dock when companion windows are created repeatedly.
      skipTransformProcessType: true,
    });
  }
}
