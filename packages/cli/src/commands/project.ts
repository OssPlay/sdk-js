import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { AssetRef, ErrorRef, type ImageFormat, OSSPlay, type RenditionSpec } from "@ossplay/sdk";
import { getConnection } from "../config";
import { mimeTypeForFilename } from "../mime";
import { printTable } from "../table";

async function clientFor(project: string): Promise<OSSPlay> {
	const connection = await getConnection(project);
	if (!connection) {
		throw new Error(`No connection configured for "${project}" — run "op configure" first.`);
	}
	return new OSSPlay({ endpoint: connection.endpoint, apiKey: connection.apiKey, project });
}

export async function projectLs(project: string, options: { folder?: string }): Promise<void> {
	const client = await clientFor(project);
	const scope = options.folder ? client.folder(options.folder) : client;
	const result = await scope.list();
	if (result.folders.length > 0) {
		console.log("Folders:");
		printTable(
			result.folders.map((f) => [f.summary?.name ?? "", f.summary?.id ?? ""]),
			["NAME", "ID"],
		);
		console.log();
	}
	console.log("Assets:");
	printTable(
		result.assets.map((a) => [
			a.summary?.filename ?? "",
			a.id,
			a.summary?.mimeType ?? "",
			String(a.summary?.size ?? ""),
			a.summary?.status ?? "",
		]),
		["FILENAME", "ID", "MIME TYPE", "SIZE", "STATUS"],
	);
}

export interface GetOptions {
	output?: string;
	w?: number;
	h?: number;
	format?: ImageFormat;
	q?: number;
}

export async function projectGet(project: string, assetId: string, options: GetOptions): Promise<void> {
	const client = await clientFor(project);
	const asset = client.asset(assetId);
	const hasTransform = options.w || options.h || options.format || options.q;

	let bytes: Uint8Array;
	if (hasTransform) {
		const transform = await asset.transform(options);
		const blob = await transform.blob();
		bytes = new Uint8Array(await blob.arrayBuffer());
	} else {
		bytes = await asset.download();
	}

	const outputPath = options.output ?? assetId;
	await writeFile(outputPath, bytes);
	console.log(`Saved to ${outputPath} (${bytes.byteLength} bytes)`);
}

export async function projectDelete(project: string, assetId: string): Promise<void> {
	const client = await clientFor(project);
	await client.asset(assetId).delete();
	console.log(`Deleted ${assetId}`);
}

export async function projectUpload(
	project: string,
	filePaths: string[],
	options: { folder?: string } = {},
): Promise<void> {
	const client = await clientFor(project);
	const scope = options.folder ? client.folder(options.folder, { create: true }) : client;
	const files = await Promise.all(
		filePaths.map(async (filePath) => {
			const data = await readFile(filePath);
			return {
				data: new Uint8Array(data),
				filename: basename(filePath),
				mimeType: mimeTypeForFilename(filePath),
			};
		}),
	);
	const results = await scope.upload(...files);
	printTable(
		results.map((result, i) =>
			result instanceof AssetRef
				? [result.id, files[i]?.filename ?? "", "ok"]
				: [result instanceof ErrorRef ? result.filename : "", "", `FAILED: ${result.error.message}`],
		),
		["ID", "FILENAME", "STATUS"],
	);
}

export async function projectMove(
	project: string,
	assetId: string,
	options: { to?: string; name?: string },
): Promise<void> {
	if (!options.to && !options.name) {
		throw new Error("Usage: op <project> mv <assetId> [--to <folder>] [--name <filename>]");
	}
	const client = await clientFor(project);
	const asset = client.asset(assetId);
	if (options.to !== undefined) await asset.move(options.to);
	if (options.name !== undefined) await asset.rename(options.name);
	console.log(`Updated ${assetId}`);
}

export async function projectInfo(project: string, assetId: string): Promise<void> {
	const client = await clientFor(project);
	const asset = await client.asset(assetId).info;
	printTable(
		[
			["id", asset.id],
			["filename", asset.filename],
			["mimeType", asset.mimeType],
			["size", String(asset.size ?? "")],
			["status", asset.status],
			["folderId", asset.folderId ?? "(root)"],
			["createdAt", asset.createdAt],
		],
		["FIELD", "VALUE"],
	);
}

export async function projectUrl(
	project: string,
	assetId: string,
	options: { disposition?: "inline" | "attachment" },
): Promise<void> {
	const client = await clientFor(project);
	const result = await client.asset(assetId).url(options);
	console.log(result.url);
}

export async function projectTranscode(project: string, assetId: string, spec: RenditionSpec): Promise<void> {
	const client = await clientFor(project);
	const variant = await client.asset(assetId).requestRendition(spec);
	const info = await variant.info;
	console.log(`${info.id} — ${info.status}`);
}

export async function projectVariants(project: string, assetId: string): Promise<void> {
	const client = await clientFor(project);
	const variants = await client.asset(assetId).variants();
	const rows = await Promise.all(variants.map((v) => v.info));
	printTable(
		rows.map((v) => [v.id, v.filename, v.mimeType, v.status]),
		["ID", "FILENAME", "MIME TYPE", "STATUS"],
	);
}
