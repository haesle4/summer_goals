# Developer guide (no Supabase admin access)

You have three options:

## Option A — Keep building now (no DB access)

The app auto-detects when the new database tables are missing and falls back to **browser localStorage** for:

- habit day schedules
- checkoffs / completions
- per-habit chat

General chat still uses the existing `messages` table. A yellow banner appears at the top when dev mode is active.

```bash
cd CascadeProjects/Summer_Goals
npm start
# open http://localhost:8080
```

## Option B — Ask your friend (one-time, ~2 min)

Send them this message:

> Hey — can you open our Supabase project → SQL Editor → New query, paste the file `supabase/migration.sql` from the repo, and click Run? That enables habit schedules, checkoffs, and per-habit chat.

They do not need to give you their password. They just run the SQL once.

## Option C — Your own Supabase project (best for serious dev)

1. Create a free project at [supabase.com](https://supabase.com)
2. Run the SQL from `README.md` (original tables) **then** `supabase/migration.sql`
3. Update `config.js` with your project URL and anon key
4. You own the database and can test everything end-to-end
