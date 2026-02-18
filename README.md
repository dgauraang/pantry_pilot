# PantryPilot

## Quickstart (Docker)

### 1) Create an OpenRouter API key
1. Go to https://openrouter.ai/settings/keys.
2. Create an API key.
3. Export it in your shell:

```bash
export LLM_API_KEY="sk-or-v1_your_key_here"
```

### 2) Run development (primary workflow)

```bash
docker compose up app-dev
```

This starts Next.js with hot reload inside the container (`CHOKIDAR_USEPOLLING=true`) and persists SQLite at `./data/pantrypilot.db`.

### 3) Run production (primary workflow)

```bash
docker compose up app
```

### 4) Run unit tests in container

```bash
docker compose run --rm test
```

### 5) Run Playwright E2E tests in container

```bash
docker compose run --rm e2e
```

## Environment variables

- `LLM_API_KEY` (required): OpenRouter API key.
- `LLM_BASE_URL` (default: `https://openrouter.ai/api/v1`): OpenAI-compatible base URL.
- `LLM_MODEL` (default: `openrouter/free`): model name routed by OpenRouter.
- `LLM_FALLBACK_MODELS` (optional): comma-separated fallback models used when the primary model is rate-limited/unavailable.
- `LLM_HTTP_REFERER` (optional): your app/site URL for OpenRouter attribution.
- `LLM_X_TITLE` (optional): app name for OpenRouter attribution.
- `DATABASE_URL` (default: `sqlite:/data/pantrypilot.db`): persisted SQLite path.

## Receipt image import

- Supported upload formats: `.jpg`, `.jpeg`, `.png`, `.webp`
- Single file per request (`multipart/form-data`, field name: `file`)
- Max upload size: `8MB`
- PDF receipts are intentionally not supported

Pipeline:

1. `POST /api/receipts` stores the image in `data/uploads/receipts/`, runs OCR, and parses line items.
2. If OCR confidence is low, the server falls back to LLM-based structured extraction.
3. UI shows editable parsed rows; low-confidence rows require explicit confirmation before apply.
4. `POST /api/receipts/:id/apply` merges rows into pantry quantities using normalized ingredient names + compatible units.

OCR dependency:

- Install `tesseract.js` (already included in `package.json`) and ensure runtime can execute OCR workers.
- If OCR is unavailable at runtime, the API falls back to LLM extraction when possible.

## Swap providers

Use any OpenAI-compatible provider by changing:

- `LLM_BASE_URL`
- `LLM_MODEL`

Keep the same `LLM_API_KEY` variable name and set its value to the provider key.

## OpenRouter connectivity check

```bash
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $LLM_API_KEY"
```

## Project scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

## Prisma startup behavior in Docker

`./scripts/start.sh` runs safe DB setup before boot:

- `prod` mode: `prisma migrate deploy`
- `dev` mode: `prisma migrate dev` (creates/syncs migrations when needed)

Then it starts the app server.
