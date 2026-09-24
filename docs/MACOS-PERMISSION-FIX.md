# macOS permission handoff fix (based on v0.1.3)

This change is independent of Training integration and requires no backend
update. It does not reset any user's macOS permissions or modify their profile.

- Authentication and onboarding windows no longer force themselves above
  System Settings and consent dialogs.
- The sign-in screen includes Permissions and Quit CoCo Learn buttons. Closing
  the unauthenticated window now requests app shutdown instead of hiding it.
- Permissions can be reopened without signing in. Only the authentication
  window can invoke its new IPC handlers.
- An explicit Open Screen Recording click requests screen capture access when
  the status is not determined/unknown, using a discarded 1×1 thumbnail. No
  images are saved or sent to the backend/model by this check.
- Consent enumeration is bounded to three seconds so a pending native dialog
  cannot block access to settings. The launch explicitly targets Apple's
  `com.apple.systempreferences` bundle; errors show manual instructions.

## Verification before release

Unit tests cover first-time consent, already-decided statuses, capture failure,
timeout, settings-launch failure, non-screen targets, and sign-in UI actions.
The isolated UI preview uses mock IPC and does not request real permissions.

The native consent transition still needs testing with the signed packaged app
on a Mac where this app has not previously been authorized (or a dedicated
test account/VM). Do not reset a participant's permissions to run this test.

1. Install the app in Applications and launch without signing in.
2. Choose Open Screen Recording. Verify System Settings/consent is visible,
   not obscured by the login window, and CoCo Learn can be enabled.
3. If it is absent, use + in Screen Recording to select the installed app.
4. Return to Permissions and check the other settings independently.
5. Verify Quit CoCo Learn and the standard quit action terminate the process.
6. Relaunch after granting permission; confirm the warning no longer asks for
   Screen Recording. Confirm login and onboarding still work.

The reporter's original native failure was not reproduced on their machine;
do not describe mock tests as proof of a successful first-install macOS grant.
