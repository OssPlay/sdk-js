# @ossplay/sdk

[![npm](https://img.shields.io/npm/v/@ossplay/sdk)](https://www.npmjs.com/package/@ossplay/sdk)
[![license](https://img.shields.io/npm/l/@ossplay/sdk)](https://github.com/OssPlay/sdk-js/blob/main/LICENSE)

TypeScript/JavaScript client for [OSSPlay](https://ossplay.phuzle.com)'s public consumer API
(`/api/v1`) — list, upload, download, and delete files on a self-hosted OSSPlay instance, plus
on-the-fly image transforms and video embed links.

## Install

```bash
bun add @ossplay/sdk
# or: npm install @ossplay/sdk
```

## Usage

```ts
import { OSSPlay } from "@ossplay/sdk";

const client = new OSSPlay({
  endpoint: "https://media.example.com",
  apiKey: process.env.OSSPLAY_API_KEY, // omit for read-only access to a public project
  project: "my-project",
});

const { folders, assets } = await client.files.list();

await client.files.upload({ data: bytes, filename: "report.pdf", mimeType: "application/pdf" });

const blob = await client.files.download("asset_123");

await client.files.delete("asset_123");
```

### Image transforms

```ts
client.image("asset_123", { w: 800, format: "webp", q: 80 }).url();
// -> embeddable URL, straight into <img src>

const blob = await client.image("asset_123", { w: 800 }).blob();
```

### Video embeds

```ts
const url = await client.video("asset_123").embedUrl();
const iframe = await client.video("asset_123").embedIframe({ width: 800, height: 450 });
```

## Docs

Full guide and API reference: [ossplay.phuzle.com/docs/consumer](https://ossplay.phuzle.com/docs/consumer)

Need a CLI instead of writing code? See [`@ossplay/cli`](https://www.npmjs.com/package/@ossplay/cli).
Building a video player? See [`@ossplay/player`](https://www.npmjs.com/package/@ossplay/player).

## License

MIT
