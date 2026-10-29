# EBiT Open Core

Open-source infrastructure for physical-world data: ingestion, persistent identity, identity graph, rights, provenance and verification. Starts with biodiversity and environmental monitoring.

- Documentation: [`docs/`](docs/overview.md) (also served at `/docs` in the app)
- Architecture: [`docs/architecture.md`](docs/architecture.md)
- Adapters: [`docs/adapters.md`](docs/adapters.md)
- Contributing: [`docs/contributing.md`](docs/contributing.md)
- Security: [`docs/security.md`](docs/security.md)

## Quick start

```bash
bun install
cp .env.example .env
bun run dev
bun run test
```

Licence: code under [Apache-2.0](LICENSE), documentation under CC BY 4.0, example datasets under their own licences ([sources](docs/examples/SOURCES.md)).
