# The Raw Portal

Private team portal for RAW: today page, calendar, reminders, collab notes, ideas, money, photos, documents, trips, details, lists and countdowns.

- Live address: https://the-raw-portal.netlify.app
- Database, sign-in and file storage: Supabase project `qbpqaaqjgwgsszclenvl` (eu-west-1), under Debby's Organization
- Netlify project: `the-raw-portal`

Only people listed in the `allowed_emails` table can read or change anything. Admins add and remove people in the app under Team.

`setup.sql` records the database setup so it can be re-created in another Supabase project (for example if RAW moves it to their own account).
