# CI/CD

## GitHub Actions workflow (`.github/workflows/ci.yml`)

### Triggers

| Event | Branch | Action |
|---|---|---|
| `push` | any branch except `main` | CI + deploy all resources (hosting, functions, rules) to **development** |
| `push` | `main` | CI + deploy all resources (hosting, functions, rules) to **production** |

### Jobs

**`ci`** — runs on every push:
- `npm ci` (root + functions)
- `npm run lint` (root + functions)
- `npm run test` (root + functions)
- `npm run build` (root + functions)

**`deploy-dev`** — runs after `ci` on any branch except `main`:
- Writes `.env.development` from secrets
- Authenticates to GCP via service account JSON key
- Runs `npm run deploy:dev` (builds + deploys all resources to the `development` project)

**`deploy-prod`** — runs after `ci` only on `main`:
- Writes `.env.production` from secrets
- Authenticates to GCP via service account JSON key
- Runs `npm run deploy:prod` (builds + deploys all resources to the `production` project)

### GitHub secrets required

| Secret name | Description |
|---|---|
| `ENV_FILE_DEV` | Full contents of `.env.development` (Vite frontend env vars for dev) |
| `ENV_FILE_PROD` | Full contents of `.env.production` (Vite frontend env vars for prod) |
| `GCP_SA_KEY_DEV` | JSON key for the service account with Firebase Admin role on the dev project |
| `GCP_SA_KEY_PROD` | JSON key for the service account with Firebase Admin role on the prod project |

### Updating env files in secrets

When an env file changes, update the corresponding secret with one command:

```bash
gh secret set ENV_FILE_DEV --repo Skoob1905/staff-registration < .env.development
gh secret set ENV_FILE_PROD --repo Skoob1905/staff-registration < .env.production
```

### Env files

Vite automatically loads the correct `.env` file based on the mode:

- `vite build` (production mode) → loads `.env.production`
- `vite build --mode development` → loads `.env.development`

Cloud Functions secrets are managed via the Firebase Secret Manager (`functions:secrets:set`) and read at runtime through `defineString`/`defineBoolean` params — no env files are injected during CI.

## Vercel deployment control

Automatic Vercel Git deployments are disabled in `vercel.json`, so pushes no longer consume Vercel deployment credits by default.

Use the manual workflow in `.github/workflows/vercel-manual.yml` whenever you want a Vercel deploy:

1. Open the **Actions** tab in GitHub
2. Select **Vercel Manual Deploy**
3. Choose `preview` or `production`
4. Run the workflow from the branch you want to deploy

### Vercel secrets required

| Secret name | Description |
|---|---|
| `VERCEL_TOKEN` | Vercel personal/team token used by the CLI |
| `VERCEL_ORG_ID` | Vercel team or personal account ID |
| `VERCEL_PROJECT_ID` | Vercel project ID for this app |
