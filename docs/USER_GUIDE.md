# CoCo User Guide

> Pilot build for macOS (Apple silicon)  
> Last updated: August 15, 2026

CoCo is a proactive AI co-assistant that observes your on-screen work, notices
moments when AI may help, and offers suggestions through a desktop avatar and
chat. In the AI Fluency Upskilling mode, CoCo uses the 4D Framework:
Delegation, Description, Discernment, and Diligence.

## Before you begin

You need:

- The CoCo `.dmg` supplied by the study team
- A Mac with Apple silicon
- An internet connection
- Your username and a password of at least eight characters
- Permission to enable Screen Recording and Accessibility for CoCo

This pilot build is unsigned and not notarized. macOS will therefore display a
security warning. Install it only if you received it directly from the study
team. Do not redistribute the installer.

## 1. Install CoCo

1. Quit any older copy of CoCo.
2. Open the supplied `coco-0.1.0-arm64.dmg`.
3. Drag **CoCo** into **Applications**.
4. Open the Applications folder, Control-click CoCo, and select **Open**.
5. If macOS still blocks it, open **System Settings → Privacy & Security**, find
   the CoCo warning, select **Open Anyway**, and confirm.

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
2. Choose **AI Fluency Upskilling (4D Framework)** when asked how CoCo should
   support you.
3. Select the AI chatbots and agents you can access. CoCo uses this list when
   recommending where to send a task.
4. Review the two ways to use CoCo: proactive suggestions and direct chat.
5. Finish onboarding and grant the requested macOS permissions.

The pilot uses study-managed models through the CoCo Router. Participants do
not need to enter a personal model API key during onboarding.

## 4. Grant macOS permissions

CoCo may request:

- **Screen Recording** so the sensing model can interpret the visible screen
- **Accessibility** so CoCo can detect activity and display timely support

Enable CoCo under **System Settings → Privacy & Security**. If macOS asks you to
restart the app after changing a permission, quit and reopen CoCo.

Avoid displaying passwords, financial information, health information, private
messages, or other sensitive material while CoCo sensing is active. Visible
screen images are sent through the study's LLM Router to the configured model
provider for inference.

## 5. Use proactive suggestions

1. Work normally with CoCo running.
2. When CoCo detects a useful teaching moment, a bubble or notification appears.
3. Select **Help me with this** or the corresponding action to accept it.
4. The first page explains the relevant 4D concept, such as Delegation or
   Description.
5. Use the arrow to move to the suggested prompt.
6. Choose an available action:
   - **Copy prompt** copies the suggestion to your clipboard.
   - **Chat about it** opens the CoCo chat with the suggestion as context.
   - **Open [tool]** opens one of the AI tools selected during onboarding.

Dismissing a suggestion continues your work without opening a session.

## 6. Ask CoCo directly

You can start direct support in either of these ways:

- Click the CoCo avatar and type in the chat box.
- Press **Cmd + Shift + Space** to capture the current screen and open chat with
  the capture attached.

You can paste images into the chat when visual context is necessary. Press
Enter or select **Send** to submit a message.

## 7. Finish a session and complete the recap

In AI Fluency Upskilling mode, select **Finish** in the chat when your task is
complete. CoCo displays:

- A short summary of the session
- A multiple-choice recap question based on the session
- Feedback after you answer

Select **End session** after answering, or **Skip** to finish without answering.
Both answered and skipped recaps record the completion time.

## 8. History and settings

From the chat header or the CoCo menu-bar menu:

- **History** shows recent local activity and previous conversations.
- **Settings** lets you update your mode, available AI tools, avatar visibility,
  tutor model, and editable memory.
- **Health** checks the local sensing and tutor services and sends brief model
  test requests. The sensing test includes a small test image.

Closing the chat hides it but does not quit CoCo. Use the CoCo menu-bar icon and
select **Quit** to stop the app and its sensing services.

## Frequently asked questions

### Why does macOS say CoCo cannot be verified?

The current pilot is unsigned and not notarized. Only open a package received
directly from the study team. The production distribution should be signed and
notarized before broader release.

### Why did onboarding not appear?

Onboarding is associated with the signed-in username and is normally
shown only for a new account. If a new account unexpectedly skips onboarding,
quit CoCo and contact the study team rather than reusing another participant's
local profile.

### Why is Screen Recording required?

CoCo uses screen images to understand the task and determine whether help may
be useful. Raw input events help determine when to observe but are not uploaded
to the study Gateway.

### Why did no suggestion appear?

CoCo intentionally stays quiet when it detects normal progress. A suggestion
appears only when the sensing model identifies a relevant teaching moment. You
can always click the avatar to ask directly.

### What does “Sensing server not connected” mean?

Wait a few seconds and select **Settings → Health → Check again**. If the model
is connected but the service remains unavailable, quit and reopen CoCo. Send
the time of the error and the Health text to the study team if it continues.

### What does “Tutor agent not connected” mean?

Check your internet connection, then use **Check again**. If only the Tutor
agent fails repeatedly, restart CoCo and report the Health details.

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

### Does uninstalling CoCo delete all local data?

Not necessarily. macOS may keep CoCo's data under
`~/Library/Application Support/coco` after the application is removed. Follow
the deletion instructions in the Data Retention Statement if you need to erase
local data.

### Can I share the installer?

No. This is an unsigned study pilot intended only for authorized participants.
The package does not contain a shared Router key or the Gemini provider key;
CoCo receives a participant-specific, expiring Router credential after sign-in.

### Who should I contact?

Contact **[STUDY CONTACT NAME AND EMAIL — REQUIRED BEFORE DISTRIBUTION]** and
include your username, macOS version, and the approximate time of the
problem. Do not send passwords or screenshots containing sensitive data.
