import { getConnection, listConnections, setConnection } from "../config";
import { Prompter } from "../prompt";
import { printTable } from "../table";

// io.askHidden() closes the shared interface itself on a real TTY (see
// prompt.ts) — the io.close() in `finally` below is a safe no-op there and
// the only actual close on non-TTY/piped input.

export async function configure(): Promise<void> {
	const io = new Prompter();
	try {
		const project = await io.ask("Project id: ");
		if (!project) throw new Error("Project id is required");

		const existing = await getConnection(project);
		const endpointDefault = existing?.endpoint;
		const endpointPrompt = endpointDefault
			? `Instance URL [${endpointDefault}]: `
			: "Instance URL (e.g. https://media.example.com): ";
		const endpointInput = await io.ask(endpointPrompt);
		const endpoint = endpointInput || endpointDefault;
		if (!endpoint) throw new Error("Instance URL is required");

		const apiKey = await io.askHidden("API key: ");
		if (!apiKey) throw new Error("API key is required");

		await setConnection(project, { endpoint, apiKey });
		console.log(`Saved connection for "${project}".`);
	} finally {
		io.close();
	}
}

export async function configureList(): Promise<void> {
	const connections = await listConnections();
	const rows = Object.entries(connections).map(([project, connection]) => [
		project,
		connection.endpoint,
		`${connection.apiKey.slice(0, 10)}...`,
	]);
	printTable(rows, ["PROJECT", "ENDPOINT", "API KEY"]);
}
