# Fixing Signup/Login + Setting Up Google Login

## Part A — Why signup/login was probably failing (do this first)

The single most common cause of "signup doesn't work" with this exact schema is a bug in
the `handle_new_user()` trigger — the function that auto-creates an organization when
someone signs up. If that trigger fails, Supabase shows a generic
**"Database error saving new user"** and the account may or may not actually get created,
leaving things in a broken half-state.

### Step 1 — Reset your database
1. Supabase Dashboard → SQL Editor → New query
2. Paste and run **`supabase/reset.sql`** (in this batch) — this cleanly drops every table,
   trigger, and function from before
3. Then paste and run the **new `supabase/schema.sql`** (also in this batch)

### Step 2 — Delete any broken test accounts
Old signup attempts may have created a user in `auth.users` even if the organization
creation silently failed.
1. Supabase Dashboard → Authentication → Users
2. Delete any test accounts you created while debugging
3. Try signing up fresh after Step 1

### Step 3 — Check your Auth settings (the other common cause)
1. Supabase Dashboard → Authentication → URL Configuration
2. Make sure **Site URL** is set to `http://localhost:3000` (for local dev)
3. Make sure **Redirect URLs** includes `http://localhost:3000/**` (the `/**` wildcard matters —
   without it, `/auth/callback` gets rejected and login/signup redirects silently fail)
4. Supabase Dashboard → Authentication → Providers → Email
   - If **"Confirm email"** is ON (default), users MUST click the emailed link before they
     can log in. For fast local testing, you can turn this OFF temporarily — just remember
     to turn it back ON before going live, since email confirmation is a real anti-spam/
     anti-abuse safeguard you want in production.

### Step 4 — Restart your dev server after any `.env.local` change
Next.js only reads `.env.local` at startup — if you added/changed a Supabase key after
`npm run dev` was already running, stop it (Ctrl+C) and run it again.

---

## Part B — Enabling Google Login (required manual dashboard step)

Code alone can't turn on Google login — Google requires you to register your app with
them first. Here's the full path:

### Step 1 — Google Cloud Console
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project (or use an existing one)
2. APIs & Services → OAuth consent screen → fill in basic app info (name, support email) →
   set to "External" if this is for public signup
3. APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs: add your Supabase callback URL, which looks like:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (find your exact project ref in Supabase Dashboard → Project Settings → General)
4. Copy the generated **Client ID** and **Client Secret**

### Step 2 — Supabase Dashboard
1. Authentication → Providers → Google → toggle **Enable**
2. Paste in the Client ID and Client Secret from Step 1
3. Save

### Step 3 — Test it
Go to `/login` or `/signup` in your app → click "Continue with Google" → it should redirect
to Google's real consent screen, then back to `/auth/callback`, then land on `/dashboard`.

**Common gotcha:** if you get a `redirect_uri_mismatch` error from Google, it means the
redirect URI in Google Cloud Console doesn't exactly match Supabase's callback URL
(including `https://`, no trailing slash mismatch, correct project ref). Double-check
that string is copied exactly.

---

## What's new in this batch, file by file

| File | What it does |
|---|---|
| `supabase/reset.sql` | Cleanly wipes the old schema so you can start fresh |
| `supabase/schema.sql` | Same schema as before, with the trigger bug fixed (`search_path`, `pgcrypto`, error handling) |
| `src/app/auth/callback/route.ts` | **New** — required for both email-confirmation links and Google OAuth to work |
| `src/app/(auth)/login/page.tsx` | Updated — password show/hide toggle, Google button, "Forgot password?" link, back-to-home button |
| `src/app/(auth)/signup/page.tsx` | Updated — password show/hide toggle, Google button, back-to-home button |
| `src/app/(auth)/signup/check-email/page.tsx` | **New** — the page shown right after signup (was previously just a broken link target) |
| `src/app/(auth)/forgot-password/page.tsx` | **New** — request a password reset email |
| `src/app/(auth)/update-password/page.tsx` | **New** — where the reset-password email link lands |
