<<<<<<< HEAD
# new-year-card
# new-year-card

3D Spring Festival greeting card (Vite + React + Canvas).

- Frontend: Vite + React
- Backend (optional): Express short-link service under `server/`

## Dev

Install deps:

```bash
npm install
npm --prefix server install
```

Run both client and server:

```bash
npm run dev
```

The frontend uses Vite proxy to call the backend at `/api/*`.

## Deploy (GitHub Pages)

This repo includes a GitHub Actions workflow that builds the Vite app and deploys `dist/` to GitHub Pages.

1) In GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2) Push to `main` or `master`.
3) Visit:

`https://huangjie127.github.io/new-year-card/`

Note: GitHub Pages is static hosting. The `server/` backend will NOT be deployed there.
Note: GitHub Pages is static hosting. The `server/` backend will NOT be deployed there. If your frontend needs `/api/*` in production, you must host the backend elsewhere and point the frontend to that URL.
