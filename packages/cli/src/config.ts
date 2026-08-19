import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface Connection {
	endpoint: string;
	apiKey: string;
}

interface StoredConfig {
	connections: Record<string, Connection>;
}

const CONFIG_PATH = join(homedir(), ".ossplay", "config.json");

async function readConfig(): Promise<StoredConfig> {
	try {
		const raw = await readFile(CONFIG_PATH, "utf8");
		return JSON.parse(raw) as StoredConfig;
	} catch {
		return { connections: {} };
	}
}

async function writeConfig(config: StoredConfig): Promise<void> {
	await mkdir(dirname(CONFIG_PATH), { recursive: true });
	await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, "\t")}\n`, "utf8");
}

export async function listConnections(): Promise<Record<string, Connection>> {
	return (await readConfig()).connections;
}

export async function getConnection(project: string): Promise<Connection | null> {
	return (await readConfig()).connections[project] ?? null;
}

export async function setConnection(project: string, connection: Connection): Promise<void> {
	const config = await readConfig();
	config.connections[project] = connection;
	await writeConfig(config);
}
