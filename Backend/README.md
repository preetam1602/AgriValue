# AgriValue backend — Step 1

Implements **Step 1 — Accounts and harvest records** from `Docs/implementation (1).md`, following FSD sections 3, 4.1, 4.2 and 7 and SDD sections 4, 5 and 8. All implementation files are under `Backend`. Source documents are unchanged.

In development, an empty `PILOT_DISTRICTS` setting allows farmers to enter their district manually and save farms and harvests. The reference-data response exposes `allow_manual_district` so the form can show a text field. Configured district lists still apply when present; production continues to require configured pilot districts. Farm coordinates, area, crop, quantity and date validation still apply.

## Setup (PowerShell, from Backend)

The farmer form uses `POST /api/v1/harvest-records` to save a complete record in one transaction. Supply harvest details plus either a nested `farm` object or an existing `farm_id`. The response contains `farm` and `harvest`; the saved harvest immediately appears in `GET /api/v1/harvests` for subsequent operations. Failed validation or a database write failure creates no partial farm record. Existing farm and harvest endpoints remain available for API compatibility.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -c "import secrets; from cryptography.fernet import Fernet; print('JWT_SECRET=' + secrets.token_urlsafe(48)); print('LOOKUP_SECRET=' + secrets.token_urlsafe(48)); print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
```

Put the generated values in `.env`. Set `DATABASE_URL` to a dedicated PostgreSQL database with PostGIS available. The initial migration enables PostGIS, creates the Step 1 tables and inserts the six role names. It creates no user, farm, harvest, price or facility demo records. The database migration account needs permission to enable PostGIS, or a database administrator must enable it first.

Set `PILOT_DISTRICTS` to a JSON array of the approved pilot districts. Set `CROPS` to a JSON object keyed by the approved crop code. Each crop entry requires `active`, `varieties` and `grades`; bag conversion additionally requires `bag_weight_kg`. Optional `high_quantity_qtl_per_acre` enables the farm-area warning. These settings are supplied by the operator for Step 1; crop reference tables and administrative management belong to Step 2. No region, variety, grade, bag weight or yield threshold is invented or seeded here.

`MAX_FARM_ACRES=100` and `MAX_STORAGE_MONTHS=6` are configurable FSD placeholders. OTP resend cooldown is configurable, initially 60 seconds. Money is INR, capacities and stored quantities are quintals, and original quantity and area inputs are preserved. Decimal response fields are strings to preserve precision.

In development, an empty `CROPS` setting loads `app/development_crops.json` to populate the harvest dropdowns. Its generic variety categories and A/B/C labels are development choices, not official grading standards. No bag weights or yield thresholds are assumed. Explicit `CROPS` settings take precedence; production and tests do not use this fallback. Restart the backend after changing configuration. Production still requires the operator's approved crop, variety and grade list.

```powershell
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for the API demonstration.

Farm location capture can fill district and village through authenticated
`POST /api/v1/location/reverse`. It sends coordinates to OpenStreetMap Nominatim
only after the user requests location capture. Names can be corrected manually;
detected districts do not expand the approved pilot list. Provider errors leave
manual entry available. `GEOCODING_URL` can point to a compatible reverse endpoint
(default: `https://nominatim.openstreetmap.org/reverse`). Responses are cached in
memory (512 entries); PostgreSQL advisory locking and a one-second gap serialize
uncached requests across workers sharing the database. Separate deployments
sharing a provider must use a shared rate limiter or their own geocoding service.
Production proxies should not log location request bodies.

For local development on PostgreSQL without PostGIS installed, use
`python -m alembic -x skip_postgis=true upgrade head` instead of the normal
migration command. This option requires `ENVIRONMENT=development`; the current
Step 1 tables use numeric coordinates, not spatial types. Install and enable
PostGIS before adding spatial features or deploying to production. Missing
tables (including `otp_states`) cause API requests to fail, so complete the
migration before requesting an OTP.

## OTP and security

- Explicit development demo mode (`ENVIRONMENT=development`, `SMS_MODE=demo`) returns `demo_otp` in the OTP request response. It never prints OTPs or phone numbers. Production configuration rejects demo mode.
- No SMS provider was identified in the documents. The HTTP adapter expects a configured HTTPS service accepting `{phone, otp, expires_in_seconds}` with bearer `SMS_TOKEN`; a successful HTTP response means accepted delivery. Configure a compatible provider adapter before real use. Errors return `OTP_FAILED` without exposing provider payloads.
- OTPs are six digits, expire after five minutes, and can be used once. Three wrong attempts exhaust one OTP. Five failures across OTPs in a rolling one-hour window lock the phone for one hour; requesting a new OTP does not reset failures. PostgreSQL row and advisory locks serialize OTP changes across API processes.
- Access JWTs expire after 15 minutes. Opaque refresh tokens expire after seven days and are stored only as keyed hashes. Refresh rotates the token; logout revokes the supplied refresh token. Existing access tokens expire normally after logout.
- Names and phones are encrypted using Fernet. Phone lookup and OTP/token verification use keyed hashes. Profile responses omit phone numbers; audit rows contain IDs and action codes, without names, phones or tokens. Keep keys outside version control and retain the encryption key securely to read existing data.
- Production rejects HTTP. Terminate TLS at the reverse proxy and configure Uvicorn `--proxy-headers --forwarded-allow-ips` for only the trusted proxy addresses. Do not log request bodies, authorization headers or query strings containing personal data at the proxy. Use encrypted database storage/volumes and TLS (`sslmode=verify-full` with the appropriate CA) for remote PostgreSQL connections.
- Registration cannot assign the admin role. Buyer/logistics registration creates pending accounts. Role management and verification operations are Step 2.

## Routes and acceptance flow

All application routes are under `/api/v1`.

1. `POST /auth/otp/request` with `phone`, `language` (`en` or `kn`) and optional `role` (default `farmer`). `POST /auth/otp/verify` with `phone` and `otp` returns tokens. Use the access token with the Swagger **Authorize** button.
2. `GET/PUT /me` reads or changes `name` and `language`. `POST /auth/refresh` rotates a `refresh_token`; authenticated `POST /auth/logout` revokes it.
3. `POST/GET /farms`, `GET/PUT /farms/{id}` manage farm location, area, storage and vehicle capacities. Farmers own their farms. Advisors specify `owner_id` and need active consent.
4. `POST/GET /harvests`, `GET/PUT /harvests/{id}` manage crop, variety, grade, quantity, harvest/sale dates and optional cash need/deadline. Supported quantity units: `kg`, `qtl`, `tonne`, `bags`. High-quantity warnings require resubmission with `confirm_high_quantity=true`; the saved response retains `HIGH_QUANTITY_FOR_AREA` in `warnings`.
5. `POST/GET /harvests/{id}/residues`, `GET/PUT /residues/{id}` manage residue type, optional moisture, measured recoverable quantity and kept quantity. Kept quantity cannot exceed recoverable quantity. Automatic residue estimation belongs to Step 4.
6. Farmer `POST /me/consents` with `advisor_id` and timezone-aware `expires_at` grants access; `GET /me/consents` lists grants and `DELETE /me/consents/{id}` revokes one. Only owners can grant/revoke consent. Expired or revoked consent immediately removes advisor access on subsequent requests. Entry and update user IDs are recorded.
7. Sign in as a second farmer or buyer and request the first farmer's farm, harvest or residue: expect `403 FORBIDDEN`. Lists include only accessible records. Admin accounts have read-only record access under the FSD permission table; optional FPO membership access is not implemented in Step 1.

Errors return stable `code` and localized `message` fields. `Accept-Language: kn` selects Kannada; English is the default. Validation errors use HTTP 400 and do not echo submitted values. OpenAPI exposes required input fields. Step 2–6 market data, administrative CRUD, forecasts and recommendation engines are outside this implementation.

## Validation

```powershell
python -m pytest -q
```

Tests apply the actual Alembic migration to isolated SQLite databases with foreign keys enabled, then check registration, encryption, language, token rotation/revocation, ownership, consent expiry/revocation, author attribution, OTP expiry/retry/lockout/replay, pending buyer denial, SMS failures, dates, residue limits and quantity conversion. SQLite tests do not validate PostGIS or PostgreSQL locking; those require a dedicated PostgreSQL/PostGIS test database and credentials. No live SMS delivery is claimed.
