# Seven-day training

Open **Training** in the fox's three-dot menu, or **Training & Administration**
in the tray/chat header. Download the unlocked task, then choose **Add screenshot
& complete** and submit a screenshot of the most exciting part of your work.
Screenshots may be PNG, JPEG, or WebP files up to 10 MiB. The next task opens no
earlier than the calendar day after the previous task unlocked, and only after
that task is complete. Screenshots stay on the participant's computer under the
Coco user-data folder in `training-screenshots/<username>`; they are not sent to
the Gateway.
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
along with material metadata, access flags and admin-change audit records.
Materials are private files on the server. No automatic deletion period is
configured yet; include these records/files in the study's privacy and
retention policy.
# Pre-intervention evaluation files

The My tasks page includes two baseline task ZIP downloads above the seven-day
training journey. Instructions are distributed separately. Downloads require
sign-in, but do not require tutoring access or training enrollment and never
start, complete, or unlock training days. No evaluation completion tracking is
added. Existing tutoring permissions are unchanged.

The Gateway exposes availability through `evaluation_tasks` on `/api/study/me`
and serves files through `/api/study/evaluation/pre/{task}/download` (task 1 or 2).
An older Gateway without these fields leaves the buttons disabled.

Materials are private server files, not public repository/package assets.
Deploy `server/coco_gateway/training.py` and `import_evaluation.py`, then run from
the private Gateway's `server/` directory:

```sh
.venv/bin/python -m coco_gateway.import_evaluation /private/Task1.zip /private/Task2.zip
.venv/bin/python -m coco_gateway.import_evaluation /private/Task1.zip /private/Task2.zip --apply
```

The importer preserves ZIP bytes, checks task directories and archive integrity,
and refuses to replace different existing materials. Metadata is stored in
`EvaluationMaterials`; blobs live under the existing `COCO_TRAINING_DIR`.
Restart the Gateway after deploying code. A new desktop package is required to
display the download section.
