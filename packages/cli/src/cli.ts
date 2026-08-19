import type { ImageFormat } from "@ossplay/sdk";
import { configure, configureList } from "./commands/configure";
import {
	type GetOptions,
	projectDelete,
	projectGet,
	projectLs,
	projectUpload,
} from "./commands/project";

const USAGE = `Usage:
  op configure                       Save a connection (instance URL + API key) for a project
  op configure ls                    List configured connections
  op <project> ls [--folder <id>]    List a project's files
  op <project> get <assetId> [-o <path>] [--w <n>] [--h <n>] [--format <fmt>] [--q <n>]
  op <project> upload <file...>      Upload one or more local files
  op <project> delete <assetId>      Delete a file`;

// Flags are parsed positionally (no external arg-parsing dependency) — the
// command set is small and fixed enough that this stays simple.
function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> } {
	const positional: string[] = [];
	const flags: Record<string, string> = {};
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-o" || arg?.startsWith("--")) {
			const name = arg === "-o" ? "output" : arg.slice(2);
			const value = args[++i];
			if (value === undefined) throw new Error(`Missing value for ${arg}`);
			flags[name] = value;
		} else if (arg !== undefined) {
			positional.push(arg);
		}
	}
	return { positional, flags };
}

function toInt(value: string | undefined): number | undefined {
	return value === undefined ? undefined : Number.parseInt(value, 10);
}

export async function run(argv: string[]): Promise<void> {
	const [first, ...rest] = argv;

	if (!first || first === "--help" || first === "-h") {
		console.log(USAGE);
		return;
	}

	if (first === "configure") {
		if (rest[0] === "ls") await configureList();
		else await configure();
		return;
	}

	const project = first;
	const [subcommand, ...subArgs] = rest;
	const { positional, flags } = parseFlags(subArgs);

	switch (subcommand) {
		case "ls":
			await projectLs(project, { folder: flags.folder });
			return;
		case "get": {
			const assetId = positional[0];
			if (!assetId) throw new Error("Usage: op <project> get <assetId>");
			const options: GetOptions = {
				output: flags.output,
				w: toInt(flags.w),
				h: toInt(flags.h),
				format: flags.format as ImageFormat | undefined,
				q: toInt(flags.q),
			};
			await projectGet(project, assetId, options);
			return;
		}
		case "upload":
			if (positional.length === 0) throw new Error("Usage: op <project> upload <file...>");
			await projectUpload(project, positional);
			return;
		case "delete": {
			const assetId = positional[0];
			if (!assetId) throw new Error("Usage: op <project> delete <assetId>");
			await projectDelete(project, assetId);
			return;
		}
		default:
			console.log(USAGE);
	}
}
