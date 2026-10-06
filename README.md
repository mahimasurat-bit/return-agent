# Return Agent

**Never miss a return again.** A personal agent that finds your purchases in email, tracks return deadlines, organizes returns into drop-off trips, and makes sure the refund actually lands.

> Connect Gmail → agent discovers purchases → Returns Inbox appears automatically. Manual entry is a fallback.

## Run it

**With your real Gmail:** follow [SETUP.md](SETUP.md) (Google Cloud, Anthropic key, Supabase, Vercel).

**Demo only (no setup):**

```bash
npm install
npm run dev        # http://localhost:3000 → "Try with demo purchases"
```

**Developer checks:**

```bash
npm run test:pipeline   # Gmail parsing, verification, sync, matching (fake Gmail + fake model, no network)
npm run dev:fake        # full live mode with fake Gmail: open /api/dev/login
npm run build
```

## Demo script (~5 min)

1. **Connect Gmail** → consent sheet explains the read-only, shopping-only scope → *Continue with demo inbox*.
2. **Discovery**: agent log ticks through orders, shipments, saved return codes, refunds → *12 purchases found*.
3. **Dashboard**: `$689 waiting to be returned`, `2 deadlines this week`, `$308 at risk`.
4. **Agent insight**: best next action is one UPS trip (2 items, $276), and *“Decide on Pegasus 41 today and it can go on the same trip.”*
5. **Review returns** → Pegasus 41 → **Return** → *Too small* → *UPS Store* (badge: “Joins 2 other returns”) → **Start return**.
6. Simulated retailer steps run (labeled **Simulated**) → **Return ready** with placeholder QR, $160 refund, return by Oct 9.
7. **View trip** → Drop off tab: **UPS Store · 3 items · $436**, plus FedEx · 1 item. *“One UPS trip, take these three things.”*
8. **Refunds** tab: Vomero 18 **Refund overdue** (12 days) → **Check refund**; Nordstrom $189 received Oct 4 with its source email.
9. **What Return Agent handled**: timeline of everything the agent did, simulated steps tagged.
10. **View source email** on any card: original email with extracted values highlighted.

## What’s real vs mocked

| Area | Live mode (your Gmail) | Demo mode |
|---|---|---|
| Gmail connection | **Real**: Google OAuth, read-only scope, refresh token encrypted at rest (AES-256-GCM) | Fixtures |
| Finding purchases | **Real**: one Gmail search for shopping email (shown in the app), Claude extraction with a forced JSON schema | Fixtures |
| “Never invent” | **Enforced in code**: order numbers, prices, return codes, links and images must literally appear in the email; a return deadline needs an exact quote from the email. Anything else is dropped and shows *Needs verification* | Fixture deadlines are fictional |
| Matching | **Real**: shipping, return and refund emails attach to orders by order number (then item name) | Fixtures |
| Return codes / labels | **Real** when a retailer’s return email contains one | Placeholder |
| Refund tracking | **Real**: refund emails mark items refunded; “Check refund” runs a Gmail sync | Simulated |
| Daily check | **Real**: Vercel Cron → `/api/cron/sync` | n/a |
| Starting a return with a retailer | **Simulated** in both modes, labeled *Simulated*. Nothing is submitted to any retailer | Simulated |
| Return policy lookup | Not built. You can set a deadline yourself on any purchase | n/a |
| Product images | From the email when Claude can match one to the item | Illustrations |
| Storage | Supabase (or a local JSON file when Supabase isn’t configured) | localStorage |

## Architecture

```
Browser (Next.js client)                       Server (Next.js route handlers)
  store.tsx  ── optimistic actions ──► /api/actions   applies the same pure transition (lib/domain.ts) and saves
             ◄── NDJSON progress ───── /api/sync      Gmail → parse → Claude → verify → match → save
                                       /api/cron/sync daily, all connected inboxes
                                       /api/auth/*    Google OAuth, sign out, disconnect + delete
                                       /api/session, /api/state
```

```
src/lib/
  types.ts             Purchase, EmailSource, Return, Refund, AgentActivity …
  domain.ts            Pure state transitions shared by browser and server
  selectors.ts         Summary, urgency, drop-off trips, refunds
  services/email-source.ts   The Gmail search (shown verbatim in the app)
src/server/
  google.ts            OAuth + Gmail REST client
  gmail-parse.ts       MIME → text, link and product-image candidates
  extract.ts           Claude extraction + verification against the email text
  sync-apply.ts        Turns one extracted email into purchases/returns/refunds (pure)
  sync.ts              Orchestration: search, dedupe, concurrency, resume, save
  repo.ts              Supabase or local-file storage
  crypto.ts, session.ts  Encrypted token, signed session cookie
  fakes.ts             Dev/test-only fake Gmail + model
supabase/schema.sql    inboxes + records tables, RLS on, no public access
```

Security: single-user by design (`ALLOWED_EMAILS`). The Supabase service key never reaches the browser; RLS blocks the public key entirely. Email content is treated as untrusted input to the model, and the model can only answer through a fixed schema.

## Roadmap

**Built:** Gmail ingestion, AI extraction with verification, shipment/return/refund matching, daily sync.

**Next:** a return-policy agent (fills in deadlines from verified policy pages), a morning digest email, and the browser agent below.

### Future agent architecture

- **Email ingestion**: Gmail API search for order confirmations, shipping confirmations, delivery notifications, return confirmations and refund confirmations (`GMAIL_QUERIES`).
- **AI extraction**: LLM extracts retailer, order number, items, price, purchase date, order link. Never guesses; uncertain fields become *Needs verification*.
- **Return policy agent**: looks up retailer policy pages to determine window, deadline, exceptions and return methods. Stores source URL + `verifiedAt`. Never invents policies.
- **Browser agent**: Playwright or computer-use automation opens the retailer, finds the order, navigates the return flow, selects item, reason and method, and retrieves the QR code or label. **Pauses for user confirmation before any consequential submit.**
- **Return artifact storage**: QR codes, shipping labels, drop-off instructions, refund amount and deadline in Supabase Storage, one place for everything needed to complete returns.
- **Refund agent**: watches email for return received / refund initiated / refund completed, updates status automatically, alerts when a refund looks overdue.
- **Scheduled agent**: daily run (Vercel Cron or Supabase scheduled function) checks new purchases, upcoming deadlines, returns not dropped off, and refunds not received, then surfaces only what needs attention.
- **Multi-inbox** (not implemented): multiple authorized household email accounts feed one Return Agent account (`connected_inboxes` table is ready). This is how Amazon purchases from the other household account will come in.
