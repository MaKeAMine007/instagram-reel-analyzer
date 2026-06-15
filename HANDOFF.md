# JYCC Reel Tank — Claude Code Handoff

## Project Summary

Instagram Reel campaign management platform for JYCC (Jain Yuva Connect Campaign).
Admins submit, track, and score creators' Instagram reels across 5 campaign weeks.

---

## Environment

- **Dev folder:** `C:\Users\omshi\OneDrive\Desktop\reel_tank` ← work ONLY here
- **Deploy folder:** `C:\Users\omshi\OneDrive\Desktop\Insta_Scraper` ← copy files here to deploy to production legacy system
- **Platform:** Windows 11, PowerShell + Bash available
- **Node:** 24 LTS
- **Framework:** Next.js 16.2.7 (App Router, Turbopack)
- **DB:** Neon PostgreSQL (serverless)
- **Styling:** Tailwind CSS

---

## Deployment

### reel_tank project (NEW — active development)
- **GitHub:** `https://github.com/MaKeAMine007/jycc-reel-tank.git` (branch: `main`)
- **Vercel project:** `reel_tank` (makeamine org)
- **Production URL:** `https://reeltank.vercel.app`
- Deploy: `vercel --prod` from `reel_tank` folder

### Legacy production (DO NOT TOUCH)
- **GitHub:** `https://github.com/MaKeAMine007/instagram-reel-analyzer`
- **Vercel:** `instagram-reel-analyzer`
- **URL:** `https://instagram-reel-analyzer.vercel.app`
- Deploy: copy changed files from `reel_tank` → `Insta_Scraper`, push to that repo

---

## Environment Variables

Stored in `.env.local` (never commit this file).

```
DATABASE_URL        — Neon PostgreSQL connection string
APIFY_TOKEN         — Apify scraping API token
SUPERADMIN_ID       — superadmin
SUPERADMIN_PASSWORD — (set by user, check .env.local)
```

All 4 are also configured on Vercel (Production + Development environments).

**IMPORTANT:** Next.js does NOT hot-reload `.env.local`. After adding/changing env vars, restart the dev server.

---

## Database Schema (Neon — neondb / wandering-meadow, ap-southeast-1)

### submissions
```sql
id              UUID PK
phone           TEXT NOT NULL
name            TEXT NOT NULL
dob             DATE NOT NULL
gender          TEXT NOT NULL
city            TEXT NOT NULL
is_jain         BOOLEAN
is_jito_member  BOOLEAN
submitted_at    TIMESTAMPTZ DEFAULT now()
remarks         TEXT DEFAULT ''
verification_status TEXT DEFAULT '-'
source          TEXT DEFAULT 'form'   -- 'form' | 'csv' | 'legacy'
in_latest_csv   BOOLEAN DEFAULT false
```

### reels
```sql
id              UUID PK
submission_id   UUID FK → submissions(id) ON DELETE CASCADE
url             TEXT NOT NULL
status          TEXT DEFAULT 'pending'  -- 'pending' | 'done' | 'failed'
username        TEXT
views           BIGINT
likes           BIGINT
comments        BIGINT
thumbnail       TEXT
reel_timestamp  TEXT
marks           INTEGER DEFAULT 0
remarks         TEXT DEFAULT ''
reel_index      INTEGER NOT NULL
week            INTEGER DEFAULT 1
```

### campaign_settings
```sql
id          INT PK (always 1)
status      TEXT DEFAULT 'active'   -- 'active' | 'inactive'
active_week INT DEFAULT 1
open_weeks  TEXT  -- JSON array e.g. "[1,3]"
```

### admins
```sql
id          UUID PK
admin_id    TEXT NOT NULL UNIQUE
password    TEXT NOT NULL  -- plain text (by design, phase 1)
status      TEXT DEFAULT 'enabled'  -- 'enabled' | 'disabled'
created_at  TIMESTAMPTZ DEFAULT now()
```

**Run `/api/db-init` (GET) to apply any new migrations. Uses IF NOT EXISTS — safe to re-run.**

---

## Business Rules (NEVER violate)

### Identity
- **Phone number = creator identity.** Only phone number is used to identify/match creators.
- Never match on name, city, gender, Jain status, JITO status, or remarks.

### Reel limits
- One creator + one week = maximum one reel.
- **Exception:** `source = 'legacy'` creators — Week 1 may have multiple historical reels.

### Eligibility
- Week 1 not submitted → cannot access future weeks.
- Week 1 submitted → may skip Weeks 2–5 and remain eligible for any open week.

### Campaign Control
- Multiple weeks can be active simultaneously.
- Only active (open) weeks available on registration form.
- Week 1 eligibility rule always enforced regardless of campaign state.
- Registration form can be enabled/disabled independently.

---

## System Accounts (NEVER editable via UI)

| Account | Credentials | Where defined |
|---|---|---|
| Emergency Admin | `admin` / `admin123` | Hardcoded in `app/api/admin/auth/route.ts` |
| Super Admin | `superadmin` / (see .env.local) | `SUPERADMIN_ID` + `SUPERADMIN_PASSWORD` env vars |

These never appear in Admin Panel. Never delete or edit them.

---

## Routes

### Public
- `/` — landing page
- `/form` — creator registration form
- `/admin` — admin login

### Admin (requires `adminLoggedIn` in localStorage)
- `/dashboard` — main admin dashboard
- `/campaign` — campaign control (week activation)

### Super Admin (requires `superAdminLoggedIn` in localStorage)
- `/superadmin` — super admin login
- `/superadmin/dashboard` — super admin dashboard (clone of admin dashboard + Delete button)
- `/superadmin/admins` — admin management (create/edit/enable/disable admins)

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/submissions` | GET | List all creators (aggregated by phone) |
| `/api/submissions` | POST | New submission from form |
| `/api/submissions/[id]` | PATCH | Update remarks + verification_status |
| `/api/submissions/[id]/reels/[reelId]` | PATCH | Update reel marks/status/metrics |
| `/api/submissions/weeks` | GET | Get occupied weeks for a phone number |
| `/api/admin/auth` | POST | Admin login (emergency + DB check) |
| `/api/superadmin/auth` | POST | Super admin login (env var check) |
| `/api/admins` | GET | List all managed admins |
| `/api/admins` | POST | Create new admin |
| `/api/admins/[id]` | PATCH | Edit admin (id/password/status) |
| `/api/creators/[phone]` | DELETE | Delete creator + all submissions (super admin only) |
| `/api/campaign` | GET/PATCH | Campaign settings |
| `/api/import` | POST | CSV import (preview + execute) |
| `/api/analyze` | POST | Scrape reel via Apify |
| `/api/thumbnail` | GET | Proxy reel thumbnail |
| `/api/db-init` | GET | Run schema migrations |

---

## Key Files

```
app/
  admin/page.tsx              — Admin login (calls /api/admin/auth)
  dashboard/page.tsx          — Main admin dashboard
  form/page.tsx               — Public registration form
  campaign/page.tsx           — Campaign control
  superadmin/
    page.tsx                  — Super admin login
    dashboard/page.tsx        — Super admin dashboard (has Delete button)
    admins/page.tsx           — Admin management page
  api/
    admin/auth/route.ts       — Admin auth (emergency + DB)
    superadmin/auth/route.ts  — Super admin auth (env vars)
    admins/route.ts           — CRUD for managed admins
    admins/[id]/route.ts      — Edit single admin
    creators/[phone]/route.ts — DELETE creator
    submissions/route.ts      — GET all + POST new submission
    submissions/[id]/route.ts — PATCH remarks + verification_status
    import/route.ts           — CSV import logic
    db-init/route.ts          — Schema migrations
  components/
    AdminNavbar.tsx           — Admin nav (logout → /admin)
    SuperAdminNavbar.tsx      — Super admin nav (logout → /superadmin)
    PublicNavbar.tsx          — Public nav
  lib/
    db.ts                     — Neon SQL client
    submissions.ts            — Creator + ReelResult interfaces
    weekTopics.ts             — Week 1-3 topic titles + descriptions
    formatters.ts             — formatNumber, formatSubmittedAt
```

---

## Week Topics (Display Only — backend always uses week numbers 1–5)

```typescript
// app/lib/weekTopics.ts
Week 1 → "A Day In My Life / Hustle"
         "Show your daily lifestyle, hustle, routine..."

Week 2 → "My City Through My Lens"
         "Capture the culture, vibes, food, people..."

Week 3 → "Living a Legacy 😎 / Yuva Ki Mann Ki Baat"
         "Choose a personality, founder, brand..."

Week 4, 5 → no topic defined (shows "Week 4", "Week 5")
```

---

## Creator Row Coloring (Dashboard)

- **Green** (`bg-green-50`) — creator is in the latest imported CSV (`in_latest_csv = true`)
- **Red** (`bg-red-50`) — creator was from CSV but NOT in latest import (`source = 'csv'` and `in_latest_csv = false`)
- **White** — form-submitted creator

---

## Verification Status

Creator-level field `verification_status` on the `submissions` table.
Values: `-` (default) | `Verified` | `Unverified`
Saved via the Save button (same PATCH call as remarks).
Shown as dropdown in both admin and super admin dashboards.

---

## CSV Import/Export

### Export columns
Name, Phone, DOB, Gender, City, Jain, JITO, Week, Instagram Username, Reel URL, Status, Views, Likes, Comments, Reel Marks, Creator Remark

### Import columns (header row, case-insensitive)
name, phone, dob, gender, city, jain, jito, week, instagram username, reel url, status, views, likes, comments, reel marks, creator remark

### Import modes
- **Merge & Update** — updates existing creators/reels, creates new
- **Create New Records Only** — skips existing, only creates new

### Legacy import
Creators imported with `source = 'legacy'` bypass the one-reel-per-week rule for Week 1 (allows multiple historical reels).

---

## Authentication Flow

### Admin login (`/admin`)
1. POST `/api/admin/auth` with `{ id, password }`
2. Server checks: emergency admin (`admin`/`admin123`) OR `admins` table (`status = 'enabled'`)
3. Success → `localStorage.setItem("adminLoggedIn", "true")` → redirect `/dashboard`

### Super Admin login (`/superadmin`)
1. POST `/api/superadmin/auth` with `{ id, password }`
2. Server checks `process.env.SUPERADMIN_ID` + `SUPERADMIN_PASSWORD`
3. Success → `localStorage.setItem("superAdminLoggedIn", "true")` → redirect `/superadmin/dashboard`

### Session protection
- Dashboard checks localStorage key on `useEffect` → redirects to login if absent
- No JWT, no cookies — simple localStorage pattern

---

## Dev Workflow

```bash
# Start dev server
cd C:\Users\omshi\OneDrive\Desktop\reel_tank
npm run dev
# → http://localhost:3000

# After adding new DB columns — run migration
curl http://localhost:3000/api/db-init

# Build check (TypeScript + build)
npm run build

# Deploy to reeltank.vercel.app
vercel --prod
```

### Deploy to LEGACY production (instagram-reel-analyzer.vercel.app)
1. Test locally
2. `npm run build` passes
3. Copy changed files to `C:\Users\omshi\OneDrive\Desktop\Insta_Scraper`
4. Do NOT copy: `node_modules/`, `.next/`, `.vercel/`
5. Preserve `.git` folder in Insta_Scraper
6. Commit + push from Insta_Scraper
7. Vercel auto-deploys

---

## Safety Rules

### Database
- Never `ALTER TABLE` / `DROP TABLE` / `DELETE` historical data without explicit instruction
- Never change `DATABASE_URL`
- Never re-run legacy import
- For schema changes: add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` to `db-init/route.ts`, then call `/api/db-init`

### Code
- Do NOT modify normal admin dashboard (`app/dashboard/page.tsx`) when working on super admin features
- Do NOT add creator logic changes to super admin pages — they share the same APIs
- Reserved admin IDs: `admin`, `superadmin` — blocked server-side in `/api/admins`

### Git
- Working branch: `main`
- Remote: `origin` → `https://github.com/MaKeAMine007/jycc-reel-tank.git`
- Do NOT change the remote

---

## Recent Session Work (completed)

1. **Verification Status** — `verification_status` column on submissions, dashboard dropdown (-, Verified, Unverified), saved with remarks
2. **Week Topics** — `app/lib/weekTopics.ts` centralizes Week 1–3 topic titles/descriptions; used on form (topic cards replace select) and dashboard expanded view
3. **Super Admin System** — `/superadmin` login, `/superadmin/dashboard` (clone + Delete button), `/superadmin/admins` (create/edit/enable/disable admins)
4. **Admin Management** — `admins` DB table, full CRUD APIs, dynamic admin auth integrated into `/admin` login
5. **Creator Delete** — `DELETE /api/creators/[phone]` (super admin only, confirmation modal)
6. **Deployed** — live at `https://reeltank.vercel.app`

---

## Known Limitations / Future Phases

- Admin passwords stored plain text (phase 1 design decision — hash in future phase)
- No audit logs yet
- No role management yet
- No email/OTP yet
- Preview env on Vercel missing `SUPERADMIN_ID`/`SUPERADMIN_PASSWORD` (CLI limitation with branch-scoped preview vars — add manually via Vercel dashboard if needed)
- Super Admin session is localStorage only — no server-side session validation
