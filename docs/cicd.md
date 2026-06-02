# CI/CD

## GitHub Actions workflow (`.github/workflows/ci.yml`)

### Triggers

| Event | Branch | Action |
|---|---|---|
| `pull_request` | any | CI only (lint, test, build) |
| `push` | `dev` | CI + deploy to **dev** project |
| `push` | `main` | CI + deploy to **prod** project |

### Jobs

**`ci`** — runs on every PR and every push to `dev` or `main`:
- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

**`deploy`** — runs after `ci` only on push to `dev` or `main`:
- Authenticates to GCP via Workload Identity (service account JSON key stored in GitHub secrets)
- Builds client with the appropriate Vite mode (`development` for dev, `production` for prod)
- Runs `firebase deploy` with the corresponding project alias (`dev` or `prod`)

### Deploy targets

| Target | Firebase project | Hosting URL | Branch trigger |
|---|---|---|---|
| Production | `handysign-ab77f` | `https://handysign-ab77f.web.app` | `main` |
| Development | `handysign-dev` | `https://handysign-dev.web.app` | `dev` |

### GitHub secrets required

| Secret name | Description |
|---|---|
| `GCP_SA_KEY_PROD` | JSON key for the service account with Firebase Admin role on the prod project |
| `GCP_SA_KEY_DEV` | JSON key for the service account with Firebase Admin role on the dev project |

### Env files

Vite automatically loads the correct `.env` file based on the mode:

- `vite build` (production mode) → loads `.env.production`
- `vite build --mode development` → loads `.env.development`

Cloud Functions loads the correct `.env` file based on the project alias:

- `firebase deploy --project dev` → also loads `functions/.env.dev`
- `firebase deploy --project prod` → also loads `functions/.env.prod`
