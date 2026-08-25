# @ossplay/sdk

[![npm](https://img.shields.io/npm/v/@ossplay/sdk)](https://www.npmjs.com/package/@ossplay/sdk)
[![license](https://img.shields.io/npm/l/@ossplay/sdk)](https://github.com/OssPlay/sdk-js/blob/main/LICENSE)

TypeScript/JavaScript client for [OSSPlay](https://ossplay.phuzle.com)'s public consumer API
(`/api/v1`) — list, upload, download, and delete files on a self-hosted OSSPlay instance, plus
on-the-fly image transforms, video renditions, embed links, and presigned direct-to-storage uploads
for a browser.

## Install

```bash
bun add @ossplay/sdk
# or: npm install @ossplay/sdk
```

## Usage

`client` is itself a folder reference, scoped to the project root — every method below works
identically on `client` and on any folder you get from it (`client.folder(id)`). Nothing fetches until
you call a method.

```ts
import { OSSPlay } from "@ossplay/sdk";

const client = new OSSPlay({
  endpoint: "https://media.example.com",
  apiKey: process.env.OSSPLAY_API_KEY, // omit for read-only access to a public project
  project: "my-project",
});

const { folders, assets } = await client.list();

const results = await client.upload({ data: bytes, filename: "report.pdf", mimeType: "application/pdf" });
// -> (AssetRef | ErrorRef)[], one per file — a bad file doesn't fail the rest

const bytes = await client.asset("asset_123").download();

await client.asset("asset_123").delete();
```

### Folders

```ts
const vacation = client.folder("/2026/08/vacation", { create: true }); // auto-creates a missing path
await vacation.upload(file1, file2);

const photos = client.folder("/2026").create("photos"); // a real child; conflicts if it already exists
```

### Direct browser uploads

`client.upload()` needs your API key, which a browser should never hold. For a file picked in the
browser, get a presigned target instead — your backend requests it, the browser `PUT`s straight to
storage, your backend confirms:

```ts
// your backend:
const target = await client.createUploadUrl({ filename: file.name, mimeType: file.type });
// -> send target.assetId + target.uploadUrl down to the browser

// the browser, no API key involved:
await fetch(target.uploadUrl, { method: target.method, body: file });

// your backend again, once the browser confirms the PUT finished:
const asset = await client.asset(target.assetId).confirmUpload();
```

### Image transforms

```ts
const transform = await client.asset("asset_123").transform({ w: 800, format: "webp", q: 80 });
transform.url();
// -> embeddable URL, straight into <img src>

const blob = await transform.blob();
```

Throws if the asset isn't an image — checked before any request.

### Video renditions & embeds

```ts
const variant = await client.asset("asset_123").requestRendition({ kind: "hls-package" });
const { url, iframe } = await client.asset("asset_123").embed({ width: 800, height: 450 });
```

## Docs

Full guide and API reference: [ossplay.phuzle.com/docs/consumer](https://ossplay.phuzle.com/docs/consumer)

Need a CLI instead of writing code? See [`@ossplay/cli`](https://www.npmjs.com/package/@ossplay/cli).
Building a video player? See [`@ossplay/player`](https://www.npmjs.com/package/@ossplay/player).

## License

MIT
