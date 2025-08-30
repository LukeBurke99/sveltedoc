import * as vscode from 'vscode';
import { processSvelteDoc } from './generator';
import { fileMatchesPath } from './match';
import type { ProcessOptions } from './types';

let channel: vscode.OutputChannel | undefined;

function logToChannel(message: string, docName?: string): void {
	// Ensure the channel exists, then write a prefixed line, optionally scoped to a document
	channel ??= vscode.window.createOutputChannel('SvelteDoc');
	const scope = docName ? `[${docName}] ` : '';
	// Timestamp in HH:mm:ss.SS (centiseconds)
	const now = new Date();
	const pad2 = (n: number): string => String(n).padStart(2, '0');
	const hh = pad2(now.getHours());
	const mm = pad2(now.getMinutes());
	const ss = pad2(now.getSeconds());
	const cs = pad2(Math.floor(now.getMilliseconds() / 10));
	const ts = `${hh}:${mm}:${ss}.${cs}`;

	channel.appendLine(`[SvelteDoc ${ts}] ${scope}${message}`);
}

export function activate(context: vscode.ExtensionContext): void {
	channel = vscode.window.createOutputChannel('SvelteDoc');
	context.subscriptions.push(channel);

	const registerCommand = vscode.commands.registerCommand(
		'sveltedoc.documentCurrentFile',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor || editor.document.languageId !== 'svelte') return;
			await documentFile(editor.document, true);
		}
	);
	context.subscriptions.push(registerCommand);

	// On-save hook
	const saveSub = vscode.workspace.onWillSaveTextDocument((e) => {
		const doc = e.document;
		const cfg = vscode.workspace.getConfiguration('sveltedoc', doc.uri);
		const onSave = cfg.get<boolean>('documentOnSave', true);
		if (!onSave) return;
		if (doc.languageId !== 'svelte') return;
		const patterns = cfg.get<string[]>('filesToDocument', ['**/components/**']);
		if (!fileMatches(doc.uri, patterns)) {
			logToChannel('(skipping, file pattern does not match)', doc.fileName);
			return;
		}

		const propertyNameMatch = cfg.get<string[]>('propertyNameMatch', ['*Props']);
		// Backward compat: map old settings if present
		const legacyAdd = cfg.get<boolean>('addTitleAndDescription', true);
		const addDescription = cfg.get<boolean>('addDescription', legacyAdd);
		const placeDescriptionBeforeProps = cfg.get<boolean>(
			'placeDescriptionBeforeProps',
			cfg.get<boolean>('placeTitleBeforeProps', true)
		);

		const options: ProcessOptions = {
			propertyNameMatch,
			addDescription,
			placeDescriptionBeforeProps
		};

		const start = Date.now();
		const { updated, changed, log }: { updated: string; changed: boolean; log: string[] } =
			processSvelteDoc(doc.getText(), options);

		logToChannel(
			`${changed ? '(updated)' : '(no change)'} in ${String(Date.now() - start)}ms`,
			doc.fileName
		);
		for (const line of log) logToChannel(line, doc.fileName);

		if (!changed) return;
		const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
		e.waitUntil(Promise.resolve([vscode.TextEdit.replace(fullRange, updated)]));
	});
	context.subscriptions.push(saveSub);
}

export function deactivate(): void {
	// no-op
}

async function documentFile(doc: vscode.TextDocument, showInfo: boolean): Promise<void> {
	channel ??= vscode.window.createOutputChannel('SvelteDoc');
	const cfg = vscode.workspace.getConfiguration('sveltedoc', doc.uri);
	const propertyNameMatch = cfg.get<string[]>('propertyNameMatch', ['*Props']);
	const legacyAdd = cfg.get<boolean>('addTitleAndDescription', true);
	const addDescription = cfg.get<boolean>('addDescription', legacyAdd);
	const placeDescriptionBeforeProps = cfg.get<boolean>(
		'placeDescriptionBeforeProps',
		cfg.get<boolean>('placeTitleBeforeProps', true)
	);

	const options: ProcessOptions = {
		propertyNameMatch,
		addDescription,
		placeDescriptionBeforeProps
	};

	const start = Date.now();
	const { updated, changed, log }: { updated: string; changed: boolean; log: string[] } =
		processSvelteDoc(doc.getText(), options);

	logToChannel(
		`${changed ? '(updated)' : '(no change)'} in ${String(Date.now() - start)}ms`,
		doc.fileName
	);
	for (const line of log) logToChannel(line, doc.fileName);

	if (changed) {
		const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
		const edit = new vscode.WorkspaceEdit();
		edit.replace(doc.uri, fullRange, updated);
		await vscode.workspace.applyEdit(edit);
		if (showInfo) vscode.window.showInformationMessage('SvelteDoc: documentation updated.');
	} else if (showInfo) {
		vscode.window.showInformationMessage('SvelteDoc: no changes needed.');
	}
}

function fileMatches(uri: vscode.Uri, patterns: string[]): boolean {
	const rel = vscode.workspace.asRelativePath(uri).replace(/\\/g, '/');
	return fileMatchesPath(rel, patterns);
}

// globToRegex moved to ./match for reuse in tests
