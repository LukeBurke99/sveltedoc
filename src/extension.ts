import * as vscode from 'vscode';
import { type ProcessOptions, processSvelteDoc } from './generator';

let channel: vscode.OutputChannel | undefined;

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
	const saveSub = vscode.workspace.onWillSaveTextDocument(async (e) => {
		const cfg = vscode.workspace.getConfiguration('sveltedoc', e.document.uri);
		const onSave = cfg.get<boolean>('documentOnSave', true);
		if (!onSave) return;
		if (e.document.languageId !== 'svelte') return;
		const patterns = cfg.get<string[]>('filesToDocument', ['src/components/*']);
		if (!fileMatches(e.document.uri, patterns)) return;
		await documentFile(e.document, false);
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
	const addTitleAndDescription = cfg.get<boolean>('addTitleAndDescription', true);
	const placeTitleBeforeProps = cfg.get<boolean>('placeTitleBeforeProps', true);

	const options: ProcessOptions = {
		propertyNameMatch,
		addTitleAndDescription,
		placeTitleBeforeProps
	};

	const start = Date.now();
	const { updated, changed, log }: { updated: string; changed: boolean; log: string[] } =
		processSvelteDoc(doc.getText(), doc.fileName, options);
	channel.appendLine(
		`[sveltedoc] ${doc.fileName} ${changed ? '(updated)' : '(no change)'} in ${String(
			Date.now() - start
		)}ms`
	);
	for (const line of log) channel.appendLine(`[sveltedoc] ${line}`);

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
	// Cheap glob: only supports trailing ** and * within path segments
	const rel = vscode.workspace.asRelativePath(uri);
	return patterns.some((p) => new RegExp('^' + globToRegex(p) + '$').test(rel));
}

function globToRegex(glob: string): string {
	// Escape regex special chars except * and /
	const ESCAPE_RE = /[.+^${}()|[\]\\]/g;
	let s = glob.replace(ESCAPE_RE, (ch) => `\\${ch}`);
	// Convert ** to .*, then remaining * to [^/]*
	s = s.replace(/\*\*/g, '.*');
	s = s.replace(/\*/g, '[^/]*');
	return s;
}
