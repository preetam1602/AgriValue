# AgriValue frontend

React and TypeScript with Vite, connected to the FastAPI backend.

## Run locally

In one terminal, from `Backend` (after configuring `.env` and applying migrations):

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

In another terminal, from `Frontend`:

```powershell
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Restart Vite
if it was already running before the proxy configuration was added.
Vite forwards `/api` to `http://127.0.0.1:8000`; the browser uses the same
origin for the page and API, so local development does not require CORS.
The preview command uses the same proxy. Run `npm run build` for TypeScript
validation and a production build.

## Connected flows

- Get started opens OTP sign-in. The request and verification call the accounts
  API. In backend demo mode the screen displays the returned development OTP;
  it does not claim SMS delivery. Errors preserve the mobile number.
- Sign-in offers two independent device options. "Keep me signed in" is on
  initially and stores the session in `localStorage` so closing the browser
  does not force another OTP. Turning it off uses tab-scoped `sessionStorage`.
  "Remember my number" is optional and saves the number and language only
  after successful verification. Shared-device users can leave both off.
- A returning signed-in user opens Home directly. After sign-out or session
  expiry, remembered-number users see a masked number and can send an OTP
  without typing it again. "Use another number" removes the remembered number.
  Remembering a number never signs anyone in or bypasses OTP verification.
- Protected requests include the bearer token. A 401 triggers a shared refresh
  request and one retry; an invalid refresh session signs the user out. The
  backend refresh token expires after seven days and rotates on refresh.
  Browser Web Locks coordinate persistent-session refresh across tabs where
  available; storage events synchronize sign-out between tabs.
- Private screens require sign-in. Profile loads from `/me` and saves name and
  language. Sign out revokes the refresh token and clears the local session;
  if the server is unreachable, the local session is still cleared. Sign-out
  first explains that closing the page is enough when staying signed in was
  selected. Explicit sign-out clears credentials from both browser stores,
  while an opted-in remembered number remains available for the next OTP.
- Home and Harvests load real farms and harvests. Add harvest reuses an existing
  farm or creates one with district, village, coordinates, area and capacities,
  then saves the harvest with the backend's unit codes and field names.
- If farm creation succeeds but harvest validation fails, the saved farm stays
  selected for retry. High-quantity warnings require explicit confirmation.
- `/reference-data` supplies approved districts, active crop codes, varieties,
  grades and bag weights. Configure `PILOT_DISTRICTS` and `CROPS` in the backend
  `.env` and restart the backend before entry. Empty configuration leaves detail fields editable but disables unavailable
  dropdowns and saving, with an explanation; no crop or district values are invented.

The homepage retains English and Kannada copy. The farmer screens currently
use English; profile language controls backend error localization. Market
prices and recommendations are not implemented by the current backend, and
homepage recommendation previews remain clearly labeled samples.

## Production routing

The build uses relative `/api/v1` URLs. Configure the production reverse proxy
to forward `/api` to FastAPI while serving the frontend assets and terminating
HTTPS. Vite's development proxy is not part of the static production build.
Follow the backend README for trusted proxy and production security settings.

The hero asset is stored in `public/images/ragi-farmer.png`.
