import { OSSPlay } from "@ossplay/sdk";
import { getConnection } from "../config";
import { printTable } from "../table";

async function clientFor(project: string): Promise<OSSPlay> {
	const connection = await getConnection(project);
	if (!connection) {
		throw new Error(`No connection configured for "${project}" — run "op configure" first.`);
	}
	return new OSSPlay({ endpoint: connection.endpoint, apiKey: connection.apiKey, project });
}

// `mkdir` — a bare name creates a root-level folder; a leading "/" creates
// every missing segment along a nested path (mkdir -p semantics), matching
// the same disambiguation the API itself uses everywhere a folder is named.
export async function folderCreate(project: string, target: string): Promise<void> {
	const client = await clientFor(project);
	const { folder } = await client.folder(target, { create: true }).info;
	if (!folder) throw new Error("Create succeeded but returned no folder");
	console.log(`Created "${folder.name}" (${folder.id})`);
}

// `folders` with no argument lists the project root; with a path/id, shows
// that folder plus its breadcrumb.
export async function folderGet(project: string, target?: string): Promise<void> {
	const client = await clientFor(project);
	if (!target) {
		const folders = await client.list({ folders: true });
		printTable(
			folders.map((f) => [f.summary?.name ?? "", f.summary?.id ?? ""]),
			["NAME", "ID"],
		);
		return;
	}
	const { folder, breadcrumb } = await client.folder(target).info;
	if (!folder) throw new Error("Folder not found");
	console.log(`${breadcrumb.map((f) => f.name).join("/") || folder.name} (${folder.id})`);
}

export async function folderDelete(project: string, folderId: string): Promise<void> {
	const client = await clientFor(project);
	await client.folder(folderId).delete();
	console.log(`Deleted ${folderId}`);
}
