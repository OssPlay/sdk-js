# @ossplay/cli

[![npm](https://img.shields.io/npm/v/@ossplay/cli)](https://www.npmjs.com/package/@ossplay/cli)
[![license](https://img.shields.io/npm/l/@ossplay/cli)](https://github.com/OssPlay/sdk-js/blob/main/LICENSE)

Command-line client for [OSSPlay](https://ossplay.phuzle.com)'s public consumer API, built on
[`@ossplay/sdk`](https://www.npmjs.com/package/@ossplay/sdk). List, upload, download, and delete
project files from a terminal or script.

## Install

```bash
bun add -g @ossplay/cli
# or: npm install -g @ossplay/cli
```

Installs both `op` and `ossplay` (same binary — `op` for short).

## Configure a connection

```bash
op configure
```

Prompts for a project id, instance URL, and API key, and saves them under that project id — every
other command reads whichever connection was saved for the project it's run against.

```bash
op configure ls
```

Lists every saved connection without exposing full secrets.

## Commands

```
op <project> ls [--folder <id>]
op <project> get <assetId> [-o <path>] [--w <n>] [--h <n>] [--format <fmt>] [--q <n>]
op <project> upload <file...>
op <project> delete <assetId>
```

- **`ls`** — list folders and files, optionally scoped to `--folder <id>`.
- **`get`** — download an asset. Adding `--w`, `--h`, `--format`, or `--q` requests an image
  transform instead of the original bytes (image assets only).
- **`upload`** — upload one or more local files by path.
- **`delete`** — permanently delete an asset by id.

## Docs

Full reference: [ossplay.phuzle.com/docs/consumer/guides/cli](https://ossplay.phuzle.com/docs/consumer/guides/cli)

## License

MIT
