# CoCo Data Retention Statement

> **Draft for study-team review — not yet approved for participant distribution**  
> Applies to the current AI Fluency Upskilling pilot build  
> Last updated: August 15, 2026

This statement explains what the current CoCo pilot stores, where it is stored,
how long it remains, and what is required to delete it. It reflects the current
software implementation. The study team must add the approved study retention
period, contact information, and any IRB or consent-language requirements before
giving this statement to participants.

## Summary

- CoCo processes screen images to provide proactive AI support.
- The study Gateway stores participant accounts, chat text, session timing,
  recap results, model identifiers, latency timestamps, and software-version
  metadata in MongoDB.
- The study Gateway does **not** receive screenshots, pasted-image bytes, raw
  keyboard/mouse events, or raw sensing observations.
- Screen images and text prompts are sent through the study's LLM Router to the
  configured model provider for inference.
- The Router currently stores text prompts, text responses, model and timing
  metadata for usage analysis. The Router's own usage log omits image bytes on
  the OpenAI-compatible route used by the desktop app.
- Most local records and the Gateway/Router research records currently have no
  automatic deletion deadline. They remain until deleted manually, except where
  a specific period is listed below.

## Data stored on the participant's computer

CoCo stores local data under:

`~/Library/Application Support/coco`

| Data | Purpose | Current retention |
|---|---|---|
| Participant profile and onboarding choices | Restore mode, AI tools, and preferences | Until changed or manually deleted |
| Sign-in token | Keep the participant signed in without storing the password locally | Up to 180 days with **Keep me signed in**, otherwise up to 1 day; may also be cleared locally |
| Chat conversation history, including locally pasted images | Display and resume prior chats | No automatic deletion |
| Session start/end and recap events | Local usage history and recovery | No automatic deletion |
| Activity-history summaries | Display recent activity and suggestion engagement | Automatically pruned after 30 days |
| Semantic memory and observation database | Personalize future assistance | No automatic deletion |
| Observer/tutor records and diagnostic logs | Run the product and diagnose failures | No automatic deletion |
| Rolling screenshots | Supply current context to the observer model | Deleted after the observer reads them |
| Explicit hotkey captures | Supply user-selected visual context | Until removed in the app or local data is deleted |
| Training screenshots | Optional model-development data | Disabled in the distributed pilot unless explicitly enabled; if enabled, retained until manually deleted |

Removing the CoCo application alone may leave this folder in place.

## Data stored by the study Gateway

The Gateway stores the following MongoDB collections:

### Users

- Username (stored internally as participant ID) and its case-normalized form
- Salted `scrypt` password hash; the plaintext password is not stored
- Account creation time

### AuthSessions

- Hash of the sign-in token
- Participant reference
- Creation and expiration times

MongoDB automatically deletes expired AuthSession records. The current expiry
is 180 days when **Keep me signed in** is selected and 1 day otherwise.

### Sessions

- Session ID and username (stored internally as participant ID)
- Start, last-message, end, and recap-completion timestamps
- Whether the session began from a proactive suggestion or user action
- Tutor and observer model names
- Recap quiz answered/skipped state, correctness, and selected answer index
- Application provenance: repository, Git commit, branch, and dirty state

### Messages

- Message ID and associated session ID
- User or AI role
- Chat text
- Message timestamp
- For AI responses: request-start, first-token, and completion timestamps and
  model name

The Gateway deliberately excludes screenshots, pasted-image bytes, raw input
events, sensing observations, and locally inferred semantic memory.

### Current Gateway retention

Users, Sessions, and Messages currently have **no automatic deletion policy**.
They remain until the study team deletes them manually. Before participant
distribution, replace this sentence with the approved policy:

> **[REQUIRED: Records will be retained for ___ after ___ and then securely
> deleted. Specify whether and how backups are included.]**

## Data processed and stored by the LLM Router

The desktop app sends model requests to the study-operated CoCo Router. The
Router authenticates a participant-scoped credential issued after sign-in and
forwards requests to the configured model provider. The credential is stored
only as a hash on the server, expires with the participant's sign-in session,
and is not embedded in the desktop package.

For its current OpenAI-compatible route, the Router stores:

- Username (stored internally as participant ID), credential type, and credential reference
- Endpoint and timestamp
- Model name and request duration
- Text prompt/request data, including chat and observer context
- Text response or error details

The Router replaces image URLs with an `"[image omitted]"` marker before
writing its own usage-history record. The image itself is still transmitted to
the model provider so the requested visual inference can be performed.

Expired participant Router credentials are automatically removed by MongoDB's
TTL index. Router usage-history records currently have **no automatic deletion
policy**. Because those records include the username, the study team can
locate participant-specific Router usage, but the approved retention and
deletion procedure still needs to specify when and how those records and any
backups are removed.

## Third-party model processing

Screen images, chat/context text, and generated prompts may be transmitted by
the Router to Google Gemini or another configured model provider. The provider's
handling and retention are governed by the account, product tier, contract, and
provider policy used by the study team.

Before participant distribution, the study team must document:

- The exact provider and product/API tier
- Whether provider-side logging or model training is enabled
- The provider's applicable retention period
- Any regional processing or subprocessors relevant to the study

Approved wording:

> **[REQUIRED: Insert the provider-specific processing and retention statement.]**

## Deletion and withdrawal

### Delete local data

1. Quit CoCo from its menu-bar menu.
2. In Finder, select **Go → Go to Folder…**.
3. Enter `~/Library/Application Support/coco`.
4. Move the `coco` folder to Trash and empty Trash if permanent deletion is
   intended.

This removes local profiles, tokens, conversations, memory, activity history,
records, and logs. It does not delete server-side records.

### Request deletion of Gateway data

A participant should provide their username to:

**[STUDY CONTACT NAME AND EMAIL — REQUIRED BEFORE DISTRIBUTION]**

The study team can use that ID to locate the participant's Users, AuthSessions,
Sessions, and associated Messages records. The approved process must define the
response time, backup handling, legal/IRB exceptions, and confirmation method.

### Router and provider data

Router usage records can be located by username. The study team must
define the deletion procedure and backup handling before promising a complete
remote deletion. Provider-side deletion depends on the provider controls and
agreement and must also be addressed in the consent process.

## Security notes

- Passwords are stored as salted hashes, not plaintext.
- Auth tokens are stored as hashes on the Gateway and expire automatically.
- The current macOS build is unsigned and not notarized, so Gatekeeper displays
  a warning.
- The package contains the Router URL but no shared Router or Gemini provider
  key. A participant-scoped, revocable credential is issued after sign-in.
- A signed/notarized build is recommended before broader deployment.

## Required approvals before publication

### Human-to-human Friends chat

When the Friends API is deployed, adding a friend sends their username to the
study Gateway. The Gateway stores the two account IDs, request status and
timestamps in `Friendships`. After acceptance, text messages are stored in
`DirectMessages`, including message/conversation IDs, sender and recipient IDs,
content, creation time, read time and deployment identifier. The recipient can
read these messages. This route does not send messages to the LLM Router or
AI tutor and does not start an AI tutoring session. Messages are not end-to-end
encrypted; authorized backend/database operators can access stored content.
No automatic expiration is configured for these two collections. A retention
and deletion policy must be approved before study use.

### Approval checklist

- [ ] Add the study name, responsible institution, and IRB/protocol number if applicable.
- [ ] Add the study contact and privacy/deletion contact.
- [ ] Approve a retention period for Gateway Users, Sessions, and Messages.
- [ ] Approve a retention period and deletion method for Router usage history.
- [ ] Document MongoDB Atlas backup retention and deletion behavior.
- [ ] Confirm the model provider, API tier, logging/training settings, and retention.
- [ ] Decide whether participant-specific Router log deletion is required and document its procedure.
- [ ] Sign and notarize the macOS package.
- [ ] Reconcile this statement with the consent form and institutional policy.
