# FITIQ — Supabase setup

FITIQ works fully in **guest mode** without Supabase. Cloud accounts add
cross-device sync for the wardrobe, original photos, Wear Status, wear
history, saved outfits, Planner and My Style.

The browser only ever uses `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key). A secret or
service-role key must never be placed in `.env` — the client rejects one if it
is detected.

## 1. Environment

`.env` (gitignored):

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Restart the dev server after changing `.env`.

## 2. Create the schema

Open **Supabase Dashboard → SQL Editor**, paste the contents of
[`migrations/0001_fitiq_cloud.sql`](./migrations/0001_fitiq_cloud.sql) and run
it once, then run
[`migrations/0002_expand_wardrobe_categories.sql`](./migrations/0002_expand_wardrobe_categories.sql)
to apply the expanded clothing categories on existing projects. 0001 already
contains the expanded list for fresh installs; 0002 is idempotent and safe to
run in either order (it no-ops if the table does not exist yet). It never
rewrites rows — every original category id remains valid.

0001 creates:

- `wardrobe_items`, `wear_log`, `saved_outfits`, `planner_days`,
  `style_profiles`
- Row Level Security (`auth.uid() = user_id`) on every table, forced even for
  the table owner
- the **private** `wardrobe-photos` bucket (10 MB, image MIME types only)
- Storage policies that only allow a user to read/write
  `<their-user-id>/…`

If you use the Supabase CLI:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

No service-role key is needed for the app. (A project owner running the SQL
editor is enough.)

## 3. Auth URL configuration

In **Authentication → URL Configuration**:

- **Site URL**: your production origin, e.g. `https://fitiq.example`
- **Redirect URLs**: add every origin you use, including
  - `http://localhost:5173/auth`
  - `http://localhost:5173/auth/reset`
  - `https://<production-origin>/auth`
  - `https://<production-origin>/auth/reset`

Email confirmation is on by default. Sign-up shows a “check your inbox”
message until the link is confirmed. Password reset emails redirect to
`/auth/reset`, where the user sets a new password.

## 4. Verify

```bash
node scripts/check-supabase.mjs
```

The script uses only the publishable key and reports whether Auth, the five
tables and the private bucket are reachable. It never prints keys.

## Data model notes

- Row ids are the same stable ids the app already uses
  (`gar_…`, `wear_…`, `outfit_…`), so migration is an idempotent upsert and
  cannot duplicate pieces.
- `photo_path` is a Storage object path, never a URL. The app signs it on
  read and shows the original capture untouched.
- `category` is limited to `shirt`, `blouse`, `top`, `pants`, `jeans`, `skirt`,
  `dress`, `jumpsuit`, `ethnic`, `shoes` and `accessory`. There is no gender
  column and no gender selection anywhere in the product.
- Wear Status and wear counts live on `wardrobe_items`; the append-only
  `wear_log` keeps one row per confirmed wear.
- Deletions are propagated with local tombstones, so removing a piece on one
  device also removes its row and private photo.
- Guest data is snapshotted once before the first sign-in and restored on
  sign-out. Local data is never deleted during migration.
