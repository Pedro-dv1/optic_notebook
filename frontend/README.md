# OpticNoteBook frontend

React 19, Vite 8, TypeScript 6 and Tailwind CSS 4. The browser keeps the short-lived access token only in memory. The backend owns the refresh token in an HttpOnly cookie and requires the Django CSRF token on unsafe requests.

## Local setup

1. Copy `.env.example` to `.env.local` and set only the public values.
2. Run `npm install`.
3. Run `npm run dev`.

The Django development origin must match `VITE_API_BASE_URL` and be present in backend `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.

Customer appointments remain the only content of `/cliente/agendamentos`. Profile, e-mail and password management open from the authenticated avatar menu in the shared header. The browser never receives an e-mail-provider credential; it keeps only the existing short-lived access JWT in memory and the one-time account-action authorization while its dialog is open.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm audit
```

Turnstile is loaded explicitly only when `VITE_TURNSTILE_SITE_KEY` exists. Production hosting must send a Content Security Policy that allows the configured API origin, the official IBGE municipalities endpoint at `https://servicodados.ibge.gov.br`, and Cloudflare's documented `https://challenges.cloudflare.com` script/frame/connect sources.
