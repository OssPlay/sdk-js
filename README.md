# sdk-js

TypeScript/JavaScript client (`@ossplay/sdk`) and CLI (`@ossplay/cli`) for [OSSPlay](https://github.com/OssPlay/ossplay)'s public consumer API (`/v1`).

- [`packages/sdk`](./packages/sdk) — `@ossplay/sdk`, a client for uploading, listing, deleting, and requesting on-the-fly image transforms for a project's files.
- [`packages/cli`](./packages/cli) — `@ossplay/cli`, a CLI (`op`) built on top of the SDK.

See [docs.ossplay.com/reference/sdk](https://docs.ossplay.com/reference/sdk) and [/reference/cli](https://docs.ossplay.com/reference/cli) for usage.

## Development

```bash
bun install
bun run typecheck
bun run lint
bun test
bun run build
```

Both packages publish to npmjs.com under the public `ossplay` org on version tags — see [`.github/workflows/publish.yml`](./.github/workflows/publish.yml).
