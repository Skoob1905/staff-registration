# CI/CD

## GitHub Actions workflow (`.github/workflows/ci.yml`)

### Trigger

| Event | Branch |
|---|---|
| `pull_request` | any |

### Job

**`ci`** — runs on every push to an open pull request:

- `npm ci` — clean install dependencies
- `npm run lint` — run ESLint
- `npm run test` — run Vitest tests
- `npm run build` — TypeScript check + Vite build
