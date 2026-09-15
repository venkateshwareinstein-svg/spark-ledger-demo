# Spark Ledger — lead demo

**Spark Ledger** by **Spark Strategy**.

Standalone walkthrough of the hospital-group ledger product surface:

- Doctor Khaata (combined IPD + OPD ledger, threshold, pay-later, in-flight payout)
- Cash Book (per-branch hospital + pharmacy tills, maker-checker, reverse-not-delete)
- Payment Register (cash / bank, READY → paid, blocked, cancelled)
- Bills / NA Hisaab (line-wise settlement, validator ✓ / hold)

Yeh app **live hospital data se nahi juta**. Seed poora fictional **Meridian Care Group** hai (4 branches). Production portal, real hospital names, patient records, aur secrets is repo me nahi hain.

## Local run

Node 18+ (sirf static files serve karta hai — koi npm dependency nahi).

```bash
cd spark-ledger-demo   # already in this repo root if you cloned spark-ledger-demo
npm start
```

Browser: [http://127.0.0.1:4173](http://127.0.0.1:4173)

Role row se Enter (PIN nahi). Left sidebar: Group, Doctor Khaata, Cash Book, Payment Register, Bills. Topbar unit dropdown.

Static-only (bina custom server):

```bash
npx --yes serve public -p 4173
```

Koi `.env` mat banao. Demo kuch secret padhta hi nahi. Optional template: `.env.example`.

## Demo seed

`public/data/seed.json`

| Branch | Name | Role in story |
| --- | --- | --- |
| MCY | Meridian City | flagship |
| MRV | Meridian Riverside | secondary |
| MOR | Meridian Orchard | day-care |
| MHT | Meridian Heights | community |

Walkthrough (Group Director role):

1. **Group** — 4-unit cash + khaata rollup
2. **Doctor Khaata** — RF 4401 ready combined payout; RF 4408 pay-later; RF 4411 in-flight
3. **Kholo** — wajah ke saath combined payment register me READY
4. **Cash Book** — pending ✓ jaanch; ulat-entry (delete nahi)
5. **Payment Register** — cash vs bank, blocked number, cash-flag hold
6. **Bills / NA Hisaab** — line %; pending TPA case par Sahi/Hold

Mutations sirf is browser session ki memory me hain. Refresh = seed wapas.

## Checks

```bash
npm test
```

- `scripts/scrub-check.js` — production hospital / portal names is tree me nahi
- `scripts/smoke.js` — seed shape + local HTTP

## Publish

Target: `venkateshwareinstein-svg/spark-ledger-demo` (public).

Cloud GitHub App tokens is sibling repo ko **create** nahi kar sakte (contents-on-existing-repo only). Jis machine par `gh` se private repo ban sake:

```bash
chmod +x scripts/publish-to-github.sh
./scripts/publish-to-github.sh
```

Ya pehle empty private repo banao, phir isi folder se:

```bash
git init
git add .
git commit -m "Spark Ledger lead demo — fictional Meridian Care Group seed"
git branch -M main
git remote add origin https://github.com/venkateshwareinstein-svg/spark-ledger-demo.git
git push -u origin main
```

## Public demo (caller-facing URL)

Static files in `public/` (no Node runtime). **Do not share a github.io URL** — it embeds a personal GitHub username.

Preferred Spark Strategy hosts (need the Netlify account that already serves `sparkstrategy.co.in`):

- `https://sparkstrategy.co.in/ledger/demo` — **proxy path** on the existing Netlify site. Do **not** replace `/ledger` (the marketing page).
- `https://demo.sparkstrategy.co.in` — dedicated subdomain.

Until that DNS is attached, share a `*.netlify.app` host produced by connecting this repo (or dropping `public/`) as a **separate** Netlify site. `netlify.toml` publishes `public/` at the site root.

### DNS / Netlify (existing `sparkstrategy.co.in` site — do not overwrite `/ledger`)

1. Create a **new** Netlify site from this repo (`publish = public`). Note its `https://<site>.netlify.app` URL.
2. **Subdomain (preferred):** in DNS (NS1, already on this domain), add  
   `CNAME demo.sparkstrategy.co.in` → `<site>.netlify.app`  
   Then in the **new** site: Domain management → add `demo.sparkstrategy.co.in` → verify TLS.
3. **Path (optional, keeps one hostname):** on the **existing** marketing Netlify site only, add a rewrite — do not copy demo files into `/ledger/`:  
   `/ledger/demo/*  https://<site>.netlify.app/:splat  200!`  
   `/ledger/demo    https://<site>.netlify.app/        200!`  
   `/ledger` and `/ledger/` stay the marketing page.

This GitHub App cannot log into that Netlify account, so the rewrite/CNAME has to be clicked there.

## UI

The interactive demo is an **ops shell** (navy sidebar, sticky topbar, dense tables, Spark Ledger gold stamps) using the public Spark Ledger tokens from `sparkstrategy.co.in/ledger` (Archivo, IBM Plex Mono, `#0D1B2C` / `#B5841F`). It is not the marketing landing layout. The private live-portal repo is not readable by this token, so pixel-matching that runtime CSS was not possible.

## What was extracted / scrubbed

**Extracted (product surface, not the portal runtime):**

- Combined doctor ledger + OPD credit queue
- Dual cash books per unit, maker ≠ checker, reverse entries
- Payment register statuses and cash/bank split
- Bill-line NA hisaab with scheme + audit state
- Multi-branch identity on every money row

**Left behind (portal coupling):**

- Auth / PIN / live users
- Sheet / Firebase / Drive
- OTP, WhatsApp, bank e-Net files, GPS
- Counselling, committee votes, CRM, targets, sales upload
- Real metrics and production case IDs

**Scrubbed:** real hospital brand names, real branch codes, real patient/staff names, live rupee totals from production. Demo rupees are story numbers only.
