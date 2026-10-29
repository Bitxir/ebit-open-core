# Self-hosting & setup

## Requirements

- Bun 1.x (or Node 20+)
- A PostgreSQL database with an auth service and object storage (the reference deployment uses a managed Postgres + storage backend)

## Steps

```bash
git clone <repository-url>
cd ebit-open-core
bun install
cp .env.example .env     # fill in your backend URL and public key
bun run dev
```

Apply the SQL migrations in `drizzle/migrations/` to your database in order, then create a private storage bucket named `originals`.

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | browser + server | Backend URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser + server | Public client key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Privileged key — never ship to the browser |

## Tests

```bash
bun run test
```
