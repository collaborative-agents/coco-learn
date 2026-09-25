# Seven-day training

Open **Training** in the fox's three-dot menu, or **Training & Administration**
in the tray/chat header. Download the unlocked task and check **I have completed
this task** after finishing it. The next task opens no earlier than the calendar
day after the previous task unlocked, and only after that task is complete.
Your timezone is recorded when you choose **Start Day 1** and cannot be changed.
Progress is stored on the study server, so reinstalling does not reset it.

Materials not yet registered show “Material coming soon.” Day 1 cannot begin
until its material exists. Completion cannot be undone from the app.

## Administration

The existing `shunta-test` account is the permanent Super Admin and can add or
remove admins by exact username. It cannot be removed or demoted. Admins can
upload a PDF or ZIP for each day (20 MiB maximum), inspect all participant
progress/completion dates, and enable/disable AI tutoring for an existing user.

Restricted users retain training downloads and human-to-human messages, but
not Tutor chat, voice help, proactive suggestions, recap quizzes or learning
summaries. Disabling tutoring revokes participant Router credentials on the
server; the app also rechecks access every 30 seconds. It blocks AI access if
policy verification fails. Re-enabling access is picked up without signing out.

## Deployment order

1. Deploy the monorepo Gateway changes (`server/coco_gateway/main.py` and
   `training.py`) and restart the Gateway. Keep the shared Router separate.
2. Verify `/api/study/me` with an authenticated account and verify Router
   revocation against the live deployment. Ensure the legitimate `shunta-test`
   account already exists (public registration of this ID is reserved).
3. Configure a persistent `COCO_TRAINING_DIR` and sufficient reverse-proxy
   request-body size for uploads (at least 28 MiB for the maximum file size).
4. Package and distribute this desktop version. The older Gateway does not
   expose the policy endpoint, so this app will not enable tutoring against it.
5. Sign in as `shunta-test`, add admins/restrictions, and upload the seven tasks
   when ready. No database passwords, material contents, or role credentials
   need to be included in the desktop package.

The backend stores training start time, fixed timezone and completion dates,
material metadata, access flags and admin-change audit records. Materials are
private files on the server. No automatic deletion period is configured yet;
include these records/files in the study's privacy and retention policy.
