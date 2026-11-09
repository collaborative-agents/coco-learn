# Coco User Guide

> Pilot build for macOS (Apple silicon)  
> Last updated: August 15, 2026

Coco is a proactive AI co-assistant that observes your on-screen work, notices
moments when AI may help, and offers suggestions through a desktop avatar and
chat. In the AI Fluency Upskilling mode, Coco uses the 4D Framework:
Delegation, Description, Discernment, and Diligence.

## Before you begin

You need:

- The Coco `.dmg` supplied by the study team
- A Mac with Apple silicon
- An internet connection
- Your username and a password of at least eight characters
- Permission to enable Screen Recording and Accessibility for Coco

This pilot build is unsigned and not notarized. macOS will therefore display a
security warning. Install it only if you received it directly from the study
team. Do not redistribute the installer.

## 1. Install Coco

1. Quit any older copy of Coco.
2. Open the supplied `coco-0.1.0-arm64.dmg`.
3. Drag **Coco** into **Applications**.
4. Open the Applications folder, Control-click Coco, and select **Open**.
5. If macOS still blocks it, open **System Settings → Privacy & Security**, find
   the Coco warning, select **Open Anyway**, and confirm.

The warning appears because this pilot package has not yet been signed or
notarized by Apple; it does not by itself mean that macOS detected malware.

## 2. Create or access your account

On first launch:

1. Select **Sign up**.
2. Enter your assigned username. Usernames are case-insensitively unique and
   may contain letters, numbers, periods, underscores, and hyphens.
3. Create a password of at least eight characters.
4. Leave **Keep me signed in** selected on your personal computer.
5. Select **Create account**.

Returning participants should use **Sign in**. Keep me signed in lasts for up
to 180 days; an unremembered sign-in lasts for up to one day.

There is currently no self-service password reset. Contact the study team if
you lose your password.

## 3. Complete onboarding

New accounts complete onboarding once.

1. Read the introduction to proactive support.
2. Choose **AI Fluency Upskilling (4D Framework)** when asked how Coco should
   support you.
3. Select the AI chatbots and agents you can access. Coco uses this list when
   recommending where to send a task.
4. Review the two ways to use Coco: proactive suggestions and direct chat.
5. Finish onboarding and grant the requested macOS permissions.

When setup finishes, Coco opens **Training tasks**. Select **Start Task** beside
**Play with Coco**. Press Space or Up, or tap the game, to jump. Hold Down or
Duck to pass beneath flying obstacles. Sound is optional, and Pause stops play.

The floating fox explains that the team made the game with AI. After your first
round, select **Make it mine** in Coco’s bubble. The regular chat opens with an
empty message box. Describe your own idea. Coco may offer a short tip while you
type. **Check my understanding** lets Coco repeat your idea back before you send
it; your words stay in the box.

When you send, Coco works on the game’s actual files. You can keep playing while
it works. After checking the changes, Coco opens your version. Play it and tell
Coco what to improve through the same chat. **Open my game** returns to the game
window. **Undo change** restores the previous working version. Select **Looks
good**, then **Continue** in Coco’s bubble when you are finished.

The **Ready to go** setup screen previews both advice locations. With the avatar
visible, a bubble appears beside the desktop fox. With **Menu bar only**, it
appears below the menu-bar fox. Only the selected preview loops; reduced-motion
preferences show a still preview.

The pilot uses study-managed models through the Coco Router. Participants do
not need to enter a personal model API key during onboarding.

## 4. Grant macOS permissions

Coco may request:

- **Screen Recording** so the sensing model can interpret the visible screen
- **Accessibility** so Coco can detect activity and display timely support

Enable Coco under **System Settings → Privacy & Security**. If macOS asks you to
restart the app after changing a permission, quit and reopen Coco.

Avoid displaying passwords, financial information, health information, private
messages, or other sensitive material while Coco sensing is active. Visible
screen images are sent through the study's LLM Router to the configured model
provider for inference.

## 5. Use proactive suggestions

1. Work normally with Coco running.
2. When Coco detects a useful teaching moment, a bubble or notification appears.
3. Select **Help me with this** or the corresponding action to accept it.
4. The first page explains the relevant 4D concept, such as Delegation or
   Description.
5. Use the arrow to move to the suggested prompt.
6. Choose an available action:
   - **Copy prompt** copies the suggestion to your clipboard.
   - **Chat about it** opens the Coco chat with the suggestion as context.
   - **Run with Coco** asks Coco to carry out the suggestion in chat.
   - **Open [tool]** opens one of the AI tools selected during onboarding.

Dismissing a suggestion continues your work without opening a session.

## 6. Ask Coco directly

You can start direct support in either of these ways:

- Click the Coco avatar and type in the chat box.
- Press **Cmd + Shift + Space** to capture the current screen and open chat with
  the capture attached.

You can paste images into the chat when visual context is necessary. Press
Enter or select **Send** to submit a message.

Coco can work through tasks using files, shell commands, screen context, and
memory. Choose a **working folder** above the composer before asking it to
work on a project. Coco remembers the folder for each conversation, including
after restarting the app. New conversations start in Coco’s own workspace.
The folder sets where commands and relative file paths start, and does not
restrict access to that folder.

Progress messages and tool cards appear as Coco works. Expand **Live output**
or **View details** to inspect a command or file operation. The final answer
appears below the completed steps. Select **Stop** to cancel a running task;
files already changed remain changed. Voice messages use the same execution
path after transcription. Proactive suggestions run only when you select
**Run with Coco** or explicitly ask for the work in chat.

In AI Fluency Upskilling mode, you can open a previous conversation and select
**Check my understanding** to review that conversation and complete its quiz.

## 7. Finish a session and complete the recap

In AI Fluency Upskilling mode, select **Check my understanding** when your task is
complete. Coco displays:

- A short summary of the session
- A multiple-choice recap question based on the session
- Feedback after you answer

Select **End session** after answering, or **Skip** to finish without answering.
Both answered and skipped recaps record the completion time.

## 8. History and settings

From the chat header or the Coco menu-bar menu:

- **History** shows recent local activity and previous conversations.
- **Settings** lets you update your mode, available AI tools, avatar visibility,
  tutor model, and editable memory.
- **Health** checks the local sensing and tutor services and sends brief model
  test requests. The sensing test includes a small test image.

Closing the chat hides it but does not quit Coco. Use the Coco menu-bar icon and
select **Quit** to stop the app and its sensing services.

## Frequently asked questions

### Why does macOS say Coco cannot be verified?

The current pilot is unsigned and not notarized. Only open a package received
directly from the study team. The production distribution should be signed and
notarized before broader release.

### Why did onboarding not appear?

Onboarding is associated with the signed-in username and is normally
shown only for a new account. If a new account unexpectedly skips onboarding,
quit Coco and contact the study team rather than reusing another participant's
local profile.

### Why is Screen Recording required?

Coco uses screen images to understand the task and determine whether help may
be useful. Raw input events help determine when to observe but are not uploaded
to the study Gateway.

### Why did no suggestion appear?

Coco intentionally stays quiet when it detects normal progress. A suggestion
appears only when the sensing model identifies a relevant teaching moment. You
can always click the avatar to ask directly.

### What does “Sensing server not connected” mean?

Wait a few seconds and select **Settings → Health → Check again**. If the model
is connected but the service remains unavailable, quit and reopen Coco. Send
the time of the error and the Health text to the study team if it continues.

### What does “Tutor agent not connected” mean?

Check your internet connection, then use **Check again**. If only the Tutor
agent fails repeatedly, restart Coco and report the Health details.

### Where are my chats?

Chat history is stored locally and can be opened from **History**. When signed
in to this pilot, chat text and session metadata are also sent to the study
Gateway. See [Data Retention Statement](DATA_RETENTION_STATEMENT.md).

### Why is there a session with no messages?

In the current pilot, opening a fresh chat can create a session before the
first message is sent. If the chat is closed without a message, an empty session
record may remain. This does not remove or overwrite the preceding session.

### Are screenshots stored in the research database?

No. The study Gateway does not store screenshots or pasted-image bytes. Screen
images are sent through the LLM Router to the model provider for inference.
Temporary rolling screenshots are deleted locally after the observer reads
them. Explicit hotkey captures may remain locally until removed.

### Does uninstalling Coco delete all local data?

Not necessarily. macOS may keep Coco's data under
`~/Library/Application Support/coco` after the application is removed. Follow
the deletion instructions in the Data Retention Statement if you need to erase
local data.

### Can I share the installer?

No. This is an unsigned study pilot intended only for authorized participants.
The package does not contain a shared Router key or the Gemini provider key;
Coco receives a participant-specific, expiring Router credential after sign-in.

### Who should I contact?

Contact **[STUDY CONTACT NAME AND EMAIL — REQUIRED BEFORE DISTRIBUTION]** and
include your username, macOS version, and the approximate time of the
problem. Do not send passwords or screenshots containing sensitive data.
