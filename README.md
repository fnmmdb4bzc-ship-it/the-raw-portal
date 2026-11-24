# The Raw Portal

Internal operations app for the RAW group, built from the "Raw App development brief" (November 2026).

- Live address: https://the-raw-portal.netlify.app
- Code: this repository. Netlify publishes it automatically when it changes.
- Database, sign-in, files and the reminder engine: Supabase project `qbpqaaqjgwgsszclenvl` (eu-west-1)

## What is in it

- **Dashboard and My actions**: what needs attention, overdue, approvals, payments, team load.
- **One workflow engine for everything**: every step has an owner, a deadline, reminders, the next person's handover, and closes only when every step is done.
  - Payment requests: request, someone takes it on (only one person can), pay with proof, operational follow-up, Zoho capture, closed.
  - Campaigns: submit, approve or request revisions, schedule, confirm published.
  - Customer reconciliations: created automatically before each customer's monthly date; contact, reconcile, invoice, payment received, Zoho.
  - Supplier and stock follow-ups: action, then Zoho confirmation.
  - Partnerships and legal records keep a linked "next action" task; legal renewals get reminders from 30 days out.
- **Reminders**: 72 h, 24 h, 3 h before, at the deadline, then daily when overdue. Critical items escalate to the people chosen in settings. Seeing a reminder never completes the task.
- **Daily briefing and weekly summary** for anyone with briefing switched on.
- **Quick capture**: type or dictate an instruction, attach photos, screenshots, files or a voice note; the app suggests actions (simple rules, not AI) for you to check.
- **Comments with @mentions, files and history** on every task and record.
- Finance (GBP and THB kept separate), calendar, documents, contacts, search, Excel export.
- **More**: collab notes, ideas, photos, business trips, lists, countdowns.
- Light and dark mode.

## Access

Team and settings > Who has access. Full access, Financial oversight (finance only), Marketing assistant (marketing only), or choose areas one by one, optionally limited to some brands. Everyone always sees actions they own, collaborate on or created. Sensitive legal records and admin-only documents are limited to admins and the responsible person. The database enforces all of this, not just the screens.

Each new Gmail address must also be added as a test user in Google Cloud (project "The Raw Portal" > Google Auth Platform > Audience).

## Behind the scenes

- `supabase/functions/engine`: the reminder engine. Runs every 5 minutes (pg_cron) and immediately when a notification is created.
- Secrets for phone notifications live in the server-only `app_config` table.
- `setup.sql` summarises the database rules.
- Nothing is connected to Zoho, Planable, Google Calendar, WhatsApp or Slack yet, as the brief asked. WhatsApp buttons only open WhatsApp with a message ready.
