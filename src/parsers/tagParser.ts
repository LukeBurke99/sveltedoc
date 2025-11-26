import { Position, TextDocument } from '../interfaces/vscode';

/**
 * Return the tag name when hovering over the tag identifier, otherwise undefined.
 * @param document The text document
 * @param position The position within the document
 * @returns The tag name string or undefined if not on a tag name
 */
export function getTagNameAtPosition(
	document: TextDocument,
	position: Position
): string | undefined {
	// Match typical tag names (allowing namespace like Foo.Bar or custom elements with dash)
	const range = document.getWordRangeAtPosition(position, /[A-Za-z][A-Za-z0-9_.-]*/);
	if (!range) return undefined;

	const line = document.lineAt(position.line).text;
	const start = range.start.character;

	// Ensure the word is immediately preceded by "<" or "</" (so it's the tag name, not an attribute)
	const before = line.slice(Math.max(0, start - 2), start);
	if (!(before.endsWith('<') || before.endsWith('</'))) return undefined;

	const word = document.getText(range);

	// Exclude svelte built-ins like <svelte:head> etc
	if (word.startsWith('svelte:')) return undefined;

	// Heuristic: treat capitalized tags as components (vs native HTML tags)
	if (!/^[A-Z]/.test(word)) return undefined;

	return word;
}
