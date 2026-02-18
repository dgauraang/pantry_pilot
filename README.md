# PantryPilot

## Quickstart (Docker)

### 1) Create a Hugging Face token
1. Go to https://huggingface.co/settings/tokens.
2. Create a token with inference permission.
3. Export it in your shell:

```bash
export LLM_API_KEY="hf_your_token_here"
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

- `LLM_API_KEY` (required): Hugging Face token for Inference Providers.
- `LLM_BASE_URL` (default: `https://router.huggingface.co/v1`): OpenAI-compatible base URL.
- `LLM_MODEL` (default: `deepseek-ai/DeepSeek-R1:fastest`): model name routed by HF.
- `DATABASE_URL` (default: `sqlite:/data/pantrypilot.db`): persisted SQLite path.

## Swap providers

Use any OpenAI-compatible provider by changing:

- `LLM_BASE_URL`
- `LLM_MODEL`

Keep the same `LLM_API_KEY` variable name and set its value to the provider key.

## HF Router connectivity check

```bash
curl https://router.huggingface.co/v1/models \
  -H "Authorization: Bearer $LLM_API_KEY"
```

## Project scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test`
- `npm run test:e2e`
- `npm run lint`

## Prisma startup behavior in Docker

`./scripts/start.sh` runs safe DB setup before boot:

- `prod` mode: `prisma migrate deploy`
- `dev` mode: `prisma migrate dev` (creates/syncs migrations when needed)

Then it starts the app server.
