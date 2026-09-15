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

Role chip dabao (PIN nahi). Upar se branch filter, neeche 5 screens.

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

## Public demo

Static files in `public/` (no Node runtime). GitHub Pages publishes that folder:

**https://venkateshwareinstein-svg.github.io/spark-ledger-demo/**

Preferred Spark Strategy hosts (DNS / Netlify account still needed):

- `https://sparkstrategy.co.in/ledger/demo` — path on the existing Netlify site (currently 404)
- `https://demo.sparkstrategy.co.in` — subdomain (currently no DNS)

Connect this repo to Netlify (`netlify.toml` publishes `public/`) or add a Pages CNAME after the subdomain exists.

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
