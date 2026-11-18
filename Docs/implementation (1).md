# AgriValue Backend Implementation Plan

## 1. Scope and setup

AgriValue helps a farmer decide where and when to sell ragi and whether to keep or sell the resulting straw. Start with one selected region of Karnataka. Rank decisions by estimated net return after costs and respect the farmer's cash, storage and transport limits.

Use one Python FastAPI application with PostgreSQL/PostGIS, SQLAlchemy and Alembic. Keep separate modules for accounts, market data, crop decisions, residue, combined decisions and administration. Run imports, forecast training and backups as separate commands that can be scheduled. Use seed data and FastAPI's API docs to demonstrate the backend.

Before seeding data, record the pilot region, initial markets, price data source and effective-dated defaults for transport, storage, crop loss and residue recovery. Mark demo prices and facilities as demo data. Store money in INR, crop and residue quantities in quintals, distances in kilometres and prices in ₹/quintal. Convert bags using the crop's configured bag weight.

## 2. Build in this order

### Step 1 — Accounts and harvest records

- Create users, roles, farms, harvests and residue records. Store farm location, storage and vehicle capacity, harvest date, crop variety, grade, quantity, latest sale date and any cash amount and deadline. Record residue type, moisture and quantity kept.
- Implement mobile OTP with expiry and retry limits, short-lived access tokens and refresh tokens. Store the language preference and return stable reason and warning codes for Kannada and English. Check ownership or active consent on every protected record. Protect personal data in transit and at rest and keep phone numbers out of logs.
- **Done when** a farmer can register, save and edit their own farm and harvest, and access to another farmer's records is denied without consent.

### Step 2 — Market data and admin setup

- Create crops, markets, daily prices, monthly prices, forecasts, default costs and buyer facility tables. Add role-protected admin operations for these records, role management, buyer verification and recommendation logs.
- Import CSV/Excel with row-level validation. Require minimum ≤ modal ≤ maximum and upsert by market, crop and price date so re-importing does not duplicate rows. Keep the source and price date. Aggregate modal prices by month.
- Find markets within the configured radius, initially 100 km. Return latest prices and 12 months of history. Prices aged 0–7 days are current, 8–30 days carry a warning, and prices over 30 days are excluded from recommendations. Label straight-line distances as estimates when used for costing.
- **Done when** an admin can import the same sheet twice, inspect invalid rows and see freshness warnings on affected prices.

### Step 3 — Crop-selling engine

- Generate sell-now options across eligible markets. Add 1–6 month storage options where forecasts exist and 25%, 50% and 75% sell-now splits when the farmer has a cash need. For split sales, calculate each leg and apply storage costs and losses to the stored portion.
- Compute net return as sale revenue minus transport, market charges, storage and waiting costs. Apply crop loss to stored sale quantity. Calculate trips by rounding quantity divided by capacity up and charge round-trip distance. Use commission and fees on revenue plus labour per quintal. Use the best sell-now net return and monthly interest rate to calculate the waiting cost. Prefer farmer-entered cost overrides and label their source.
- Check sale deadlines, available storage and net cash proceeds by the cash deadline. Rank feasible options by net return. Recommend waiting over the best immediate sale only when the expected improvement is at least 3% and estimated probability of beating it is at least 60%. Estimate that probability from historical forecast errors. Where a forecast is unavailable, show storage as unevaluated.
- Save the options, selected result, inputs, cost assumptions, price dates, warnings and reasons in each recommendation run. Label money values as estimates.
- **Done when** the API ranks two markets by take-home return, handles a cash deadline and explains why any storage option was excluded.

### Step 4 — Residue estimation and buyer matching

- Calculate generated residue as grain quantity × residue-to-product ratio. Multiply by the recovery factor and subtract the amount kept to obtain the available quantity. Validate that the kept amount does not exceed recoverable residue.
- Suggest eligible uses from residue type, quality and moisture. Always include keeping the residue. Allow buyers to maintain location, accepted quality, minimum lot, demand window, price and pickup or delivery terms. Use verified, active facilities for matching and filter by type, quality, quantity, date and distance.
- Compute sale net return as quantity × buyer price minus baling, loading and farmer-paid transport. Rank eligible buyers using normalized net return, nearness and quantity fit with initial weights of 0.5, 0.3 and 0.2. Compare sale proceeds with the value of keeping the residue.
- **Done when** buyers with unsuitable moisture limits or lot sizes are excluded and keeping the residue can be the top recommendation.

### Step 5 — Combined crop and residue plan

- Evaluate feasible crop and residue pairs, including keeping the residue. Check shared storage space, vehicle capacity, transport budget and cash proceeds by the required date across both activities. Track timing so later proceeds do not count toward an earlier deadline.
- Recommend the feasible pair with the highest total estimated return. Show the independently selected crop and residue options, whether that pair is feasible, and the difference in estimated value. Report the reason if no combined plan meets the constraints.
- **Done when** the API can reject the individually highest-return pair because it exceeds a shared limit and select the best feasible pair.

### Step 6 — Forecasts, follow-up features and evaluation

- Check for at least 36 months of monthly price history and at most 20% missing observations. Start with the same-month-last-year seasonal baseline and Holt–Winters as the first challenger. Backtest in time order on the last 12 months, use the challenger only if it beats the baseline, and store up to six months of P50 prices and P10–P90 ranges using historical forecast errors. If a usable forecast cannot be produced, keep the sell-now comparison available.
- Add saved recommendation history and actual sale outcomes. Release buyer contact details through the match flow only after farmer confirmation. Add consent-based advisor access, record who enters data, and keep what-if changes transient. Then add anonymized matching supply for buyers and village/date collection summaries and vehicle rates for logistics providers. Build FPO member aggregation and bulk crop comparison only if decision D7 is approved.
- Backtest against selling at harvest using only data available on each historical decision date. Record net-return difference and forecast error. Compare combined and independent choices and identify constraint violations. Schedule daily backups and verify a restore. Check the five-second recommendation target on the seeded dataset.

## 3. Main API routes

| Area | Routes |
|---|---|
| Login and profile | `/auth/otp/request`, `/auth/otp/verify`, `/me` |
| Farm and harvest | `/farms`, `/harvests`, `/harvests/{id}/residues` |
| Markets | `/markets`, `/markets/{id}/prices`, `/forecasts` |
| Recommendations | `POST /harvests/{id}/crop-recommendations`, `POST /residues/{id}/recommendations`, `POST /harvests/{id}/combined-recommendations` |
| Results and outcomes | `GET /recommendations/{runId}`, `POST /recommendations/{runId}/outcome` |
| Buyers and logistics | `/facilities`, `/facilities/{id}/matched-supply`, `POST /matches/{id}/contact`, `POST /vehicles` |
| Administration | `/admin/...` for crops, markets, costs, imports, users, verification and audit logs |

## 4. Final backend demo

Seed one ragi farm, two markets, a harvest and a straw lot. Import prices, run crop and residue recommendations, then run the combined plan with a transport limit and a cash deadline. Verify duplicate imports, stale prices, missing forecasts, the storage threshold, buyer eligibility, access control and consent. Cross-check the cost calculations against the FSD worked examples and save one actual sale outcome.

Based on the AgriValue Synopsis, FSD, SDD and User Stories. The FSD contains the detailed formulas, API permissions and worked examples.
