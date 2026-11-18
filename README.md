# TT Tournaments

A table tennis tournament manager. Organizers register players, draw round-robin groups, run a live match queue across several tables, score matches, and publish a knockout bracket. Players follow along on a public page.

**Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, Firebase (Firestore, Auth, Storage; free Spark plan, no Cloud Functions). Deployed to GitHub Pages by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in your Firebase web config, or use the emulators below
npm run dev
```

### With the Firebase emulators (no real project needed)

```bash
npm run emulators            # auth :9199, firestore :8381
```

In another terminal:

```bash
export VITE_FIREBASE_PROJECT_ID=demo-tt-app FIRESTORE_EMULATOR_HOST=127.0.0.1:8381
npm run seed:emulator-admin  # admin@example.test / emulator-pass-1
npm run seed:mecttel-open    # 36 players, groups scored, knockout generated
npm run seed:mecttel-registration   # same division, registration only
```

Put these in `.env.local` so the app talks to the emulators:

```
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-tt-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-tt-app
VITE_FIREBASE_STORAGE_BUCKET=demo-tt-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1
VITE_FIREBASE_APP_ID=1:1:web:demo
VITE_USE_EMULATOR=true
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and production build |
| `npm test` | Unit tests for scheduling, seeding, scoring and standings |
| `npm run test:sim` | Plays whole tournaments (every division type, odd sizes, byes, late join, edits) against the emulators and reports problems; needs `npm run emulators` and the admin seed |
| `npm run test:rules` | Firestore security-rule tests (starts the emulator itself) |
| `npm run lint` | Oxlint |
| `npm run seed:*` | Seed data (see above; without the emulator they use your Firebase CLI login) |

## How the code is laid out

- `src/lib/` holds the logic and the tests: match queue and table assignment, group assignment, knockout seeding, standings, scoring and validation. `tournamentService.ts` is the Firestore data layer.
- `src/pages/` has the public pages and the admin pages (lazy-loaded). `src/components/` holds the UI.
- `src/components/ui/primitives.tsx` is the shared UI kit. `src/components/ui/Modal.tsx` is the one dialog shell (focus trap, Escape, scroll lock); new dialogs should use it.
- `firestore.rules` is the security model: the public reads upcoming and ongoing divisions, only admins write. Match writes are validated (winner must be one of the two entries, scores are non-negative integers, a completed match has a winner and no tie).
- Admin accounts are created on the Admins page (superadmin only) in the browser; there are no Cloud Functions, so the project stays on the free plan.

## Design system

The interactive design prototype this UI was built from is in [`docs/ui-prototype/index.html`](docs/ui-prototype/index.html); open it in a browser.

Colors and radii are CSS variables in `src/index.css` (light and dark). Legacy Tailwind names such as `bg-card`, `text-text-steel` and `bg-brand-500` map onto them, so use the token classes and never literal colors. The accent is orange (`brand-*`, used for primary actions and live state). Errors use `danger`, not the accent. Weights stay between 400 and 600.

## Admins and the superadmin

The superadmin (`profiles/{uid}.role = 'superadmin'`) is the only account that can list admins, create them, remove them and set the master password. Promote the first one by hand (Firebase console, or `npm run admin-tool -- promote admin@mecttel.com` with a service account).

- **Create an admin:** Admins page, enter an email; a password is generated and shown once so you can pass it on. The admin changes it on the Account page.
- **Reset a password:** send a reset email from the Admins page, or `npm run admin-tool` to set one yourself.
- **Remove an admin:** deletes their profile, which ends their access at once. The login itself stays until deleted in the Firebase console or with the admin tool.

## Deleting divisions and tournaments

Deleting erases every entry, group and result for good, so it needs the **master password** (set by the superadmin on the Admins page; use a long one). There is no server code: the browser writes a short-lived "delete grant" containing a SHA-256 proof, and the security rules only allow the delete while a grant that matches the stored proof is under 3 minutes old. Wrong guesses are not counted, so there is no lockout; the password is a railguard against accidents, not against a determined attacker.

## Deploying

- **Web app:** push to `main`; the workflow builds with the `VITE_FIREBASE_*` repository secrets.
- **Rules:** run `npm run test:rules`, then `firebase deploy --only firestore:rules`. Deploy the rules together with the web app, because the new app writes delete grants and the old delete buttons stop working once the new rules are live.
- No Blaze plan needed.
