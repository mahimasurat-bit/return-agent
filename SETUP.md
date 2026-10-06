# Return Agent setup

## Fastest: a shareable demo link (about 10 minutes, no keys)

With no environment variables, the deployed app runs on a realistic sample inbox, which is what a tester should see.

1. **github.com** → **New repository** → name `return-agent`, **Private** → **Create**.
2. Click **uploading an existing file** → in Finder open the unzipped `return-agent` folder, **Cmd+A**, drag everything in → **Commit changes**.
3. **vercel.com** → sign up with GitHub → **Add New → Project** → import `return-agent` → **Deploy** (skip environment variables).
4. Open the project in Vercel and copy the domain under **Domains** (e.g. `return-agent-abc.vercel.app`). Share that link.
5. Open it in a private browser window to confirm it loads without a Vercel login. If it asks for one, go to **Settings → Deployment Protection** and turn off **Vercel Authentication**.

To connect your own Gmail later, continue below. Your testers keep using the demo inbox, since only addresses in `ALLOWED_EMAILS` can connect Gmail.

---

# Connect Return Agent to your Gmail

About 45 minutes, once. You'll end up with Return Agent running on Vercel, reading your shopping email every morning.

You need: a Google account (the Gmail you shop with), a GitHub account, and a credit card for the Anthropic API (a few dollars covers months of personal use).

Do the steps in order. Steps 1–4 get it working on your laptop; steps 5–7 put it online with the daily check.

---

## 1. Google Cloud: let Return Agent read Gmail (read-only) · ~15 min

1. Go to **console.cloud.google.com**, sign in with your Gmail account.
2. Top bar → project picker → **New project** → name it `Return Agent` → **Create**. Make sure it's selected.
3. Search bar → **Gmail API** → **Enable**.
4. Search bar → **Google Auth Platform** → **Get started**.
   - App name: `Return Agent`. Support email: your Gmail.
   - Audience: **External**.
   - Contact email: your Gmail. Agree and **Create**.
5. Left menu → **Data Access** → **Add or remove scopes**. Paste this into "Manually add scopes", click **Add to table**, then **Update** and **Save**:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   ```
   Also tick `openid` and `.../auth/userinfo.email` if they're listed.
6. Left menu → **Audience** → under **Test users**, add your Gmail address. Leave the status on **Testing** for now.
   (The **Publish app** button stays greyed out until the Branding page has a home page and privacy policy link, which you only have once the app is on Vercel. You'll do that in step 6. Testing mode works fine meanwhile; Google just asks you to sign in again every 7 days.)
7. Left menu → **Clients** → **Create client**:
   - Application type: **Web application**. Name: `Return Agent web`.
   - **Authorized redirect URIs** → add:
     ```
     http://localhost:3000/api/auth/google/callback
     ```
     (You'll add your Vercel URL in step 6.)
   - **Create**. Copy the **Client ID** and **Client secret** somewhere safe.

## 2. Anthropic: the model that reads your emails · ~5 min

1. Go to **console.anthropic.com** → sign in → **Billing**: add a card and a small credit (e.g. $10).
2. **API keys** → **Create key** → name it `return-agent` → copy it.

Cost: roughly 1¢ per shopping email with the default model (Sonnet 5.5). The first sync reads up to 60 days of shopping email (often $1–2); daily checks are a few cents. Set `ANTHROPIC_MODEL=claude-haiku-4-5-20251001` to cut that in half.

## 3. Run it on your laptop · ~10 min

You need Node.js 20+ (`node -v` to check; install from nodejs.org if needed).

```bash
cd return-agent
npm install
cp .env.example .env.local
openssl rand -base64 32      # copy the output for APP_SECRET
```

Open `.env.local` and fill in:

```
GOOGLE_CLIENT_ID=...            # from step 1.7
GOOGLE_CLIENT_SECRET=...
ALLOWED_EMAILS=you@gmail.com    # your Gmail, exactly
APP_SECRET=...                  # the openssl output
ANTHROPIC_API_KEY=...           # from step 2
```

Leave the Supabase lines empty for now; data is saved to `.data/return-agent.json` on your laptop.

```bash
npm run dev
```

Open **http://localhost:3000** → **Connect Gmail** → **Continue with Google**.

## 4. What you'll see on the Google screens

1. "Google hasn't verified this app" → **Advanced** → **Go to Return Agent (unsafe)**. It's your own app.
2. Permissions: tick **Read your email messages and settings** (if there's a checkbox) → **Continue**.
3. You land on "Finding your purchases…" and watch the real sync log.

Check a few purchases against your email ("View source email" on any card). Anything Return Agent couldn't confirm shows **Needs verification** instead of a guess. Return deadlines are only filled in when the email states one; for the rest, open the card and set the date from the retailer's policy.

## 5. Supabase: where your data lives once it's online · ~5 min

1. **supabase.com** → **New project** → name `return-agent`, pick a strong DB password, region near you (e.g. West US).
2. When it's ready: **SQL Editor** → **New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **service_role** key (the secret one, not anon).

Optional: put these in `.env.local` too and restart `npm run dev` to use Supabase locally. You'll need to connect Gmail again since storage changed.

## 6. GitHub + Vercel · ~10 min

1. Create a **private** repo on GitHub named `return-agent`, then from the project folder:
   ```bash
   git remote add origin https://github.com/<you>/return-agent.git
   git push -u origin main
   ```
2. **vercel.com** → **Add New → Project** → import `return-agent`.
3. Before deploying, open **Environment Variables** and add everything from `.env.local`, plus:
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   CRON_SECRET=<any random string, e.g. another openssl rand -base64 32>
   ```
4. **Deploy**. Copy your URL, e.g. `https://return-agent-xyz.vercel.app`.
5. Back in Google Cloud → **Google Auth Platform → Clients → Return Agent web** → add a second redirect URI:
   ```
   https://return-agent-xyz.vercel.app/api/auth/google/callback
   ```
   **Save**. (Changes can take a few minutes.)
6. Publish the Google app so you're not signed out every 7 days. In Google Cloud → **Google Auth Platform → Branding**:
   - **Application home page**: `https://return-agent-xyz.vercel.app`
   - **Application privacy policy link**: `https://return-agent-xyz.vercel.app/privacy` (the app includes this page)
   - **Authorized domains** → **Add domain**: `return-agent-xyz.vercel.app`
   - Check **User support email** and **Developer contact email** are filled → **Save**.
   - Then **Audience** → **Publish app** → **Confirm**. Status should read **In production**. If Google offers to start verification, skip it; it isn't needed for personal use. The next time you connect, you'll see a one-time "Google hasn't verified this app" screen.
7. Open your Vercel URL → **Connect Gmail**.

## 7. The daily check

`vercel.json` schedules `/api/cron/sync` once a day (13:00 UTC, about 6am Pacific). Vercel sends your `CRON_SECRET` automatically. Check it ran under Vercel → your project → **Settings → Cron Jobs** (or **Logs**). You can always hit **Sync** in the app too.

## Quick test: email yourself a sample digest (no Gmail setup)

See a real digest email in your inbox using the demo data. Only needs Resend.

1. **resend.com** → sign up with the email you want the sample sent to → **API Keys** → **Create API key** → copy it.
2. Vercel → your project → **Settings → Environment Variables** → add:
   - `RESEND_API_KEY` = the key
   - `DIGEST_TO` = that same email address
3. **Deployments** → latest → **⋯ → Redeploy**.
4. Open your site once with `?owner=1` on the end (e.g. `https://return-agent-lac.vercel.app/?owner=1`). This shows the sample button in your browser only. Testers never see it.
5. **Try with demo purchases** → **Digest** → **Send a sample to me**. Check your inbox (and spam) within a minute.

Samples only ever go to `DIGEST_TO`, at most one a minute.

## 8. Email digest (optional, about 5 minutes)

Return Agent can email you instead of you opening the app: every 2 days, sooner if a return is due within 2 days, and nothing on quiet days. It needs your real Gmail connected (steps 1 to 7).

1. **resend.com** → sign up **with the same email address you want digests sent to**. (Until you add your own domain, Resend only delivers to your own account email, which is exactly what a personal digest needs.)
2. **API Keys** → **Create API key** → copy it.
3. If your Supabase tables already exist, run this once in **SQL Editor**:
   ```sql
   alter table inboxes add column if not exists last_digest_at timestamptz;
   ```
4. Vercel → your project → **Settings → Environment Variables** → add:
   - `RESEND_API_KEY` = the key from step 2
   - `DIGEST_EVERY_DAYS` = `2` (optional; any number of days)
5. **Deployments** → the latest one → **⋯ → Redeploy** (env changes need a redeploy).
6. In the app, click **Digest** → **Send me one now** to test it.

The daily job (step 7) checks Gmail every morning and sends the digest when one is due.

---

## If something goes wrong

| You see | Fix |
|---|---|
| **Publish app** is greyed out | Branding page is missing the home page / privacy link / authorized domain. See step 6.6. |
| "That Google account isn't on this Return Agent's allowed list" | `ALLOWED_EMAILS` must match the Gmail you signed in with. Redeploy after changing env vars. |
| Google error `redirect_uri_mismatch` | The redirect URI in Google Cloud must match exactly, including `https` and no trailing slash. |
| "Gmail access wasn't granted" | On the Google screen, tick the box to read email. |
| "Google didn't return offline access" | Remove Return Agent at myaccount.google.com/permissions, then connect again. |
| "Gmail access expired" banner | Click **Reconnect Gmail**. If it happens weekly, the Google app is still in Testing (step 6.6). |
| Sync says "ANTHROPIC_API_KEY is not set" | Add the key (and credit) and redeploy. |
| Sync stops with "More emails left" | Big inbox. Hit **Sync** again; it continues where it stopped. |

## Turning it off

In the app: account menu (the shield icon next to your email) → **Disconnect Gmail and delete data**. This revokes Google access and deletes everything stored. You can also remove access at myaccount.google.com/permissions.
