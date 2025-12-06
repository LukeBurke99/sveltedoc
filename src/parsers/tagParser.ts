import { Position, TextDocument } from '../interfaces/vscode';

/**
 * Options for tag detection behavior.
 */
export type TagDetectionOptions = {
	/** Whether to detect tags when hovering anywhere within opening tag brackets */
	hoverWithinTag: boolean;
	/** Maximum lines to search backwards when hoverWithinTag is enabled */
	maxLines: number;
};

/**
 * Default options for tag detection (legacy behavior).
 */
const DEFAULT_OPTIONS: TagDetectionOptions = {
	hoverWithinTag: false,
	maxLines: 50
};

/**
 * Return the tag name when hovering over the tag identifier, otherwise undefined.
 * @param document The text document
 * @param position The position within the document
 * @param options Optional tag detection options
 * @returns The tag name string or undefined if not on a tag name
 */
export function getTagNameAtPosition(
	document: TextDocument,
	position: Position,
	options: TagDetectionOptions = DEFAULT_OPTIONS
): string | undefined {
	// First, try the original behavior: check if cursor is directly on a tag name
	const directResult = getTagNameDirectly(document, position);
	if (directResult) return directResult;

	// If hoverWithinTag is enabled, try to find tag from within opening tag brackets
	if (options.hoverWithinTag)
		return findTagFromWithinBrackets(document, position, options.maxLines);

	return undefined;
}

/**
 * Original tag detection: returns tag name only when cursor is directly on the tag name.
 */
function getTagNameDirectly(document: TextDocument, position: Position): string | undefined {
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

/**
 * Find tag name when cursor is anywhere within an opening tag's brackets.
 * Scans backwards to find `<ComponentName` and forwards to verify we're before the closing `>`.
 */
function findTagFromWithinBrackets(
	document: TextDocument,
	position: Position,
	maxLines: number
): string | undefined {
	// Step 1: Scan backwards to find the opening `<ComponentName`
	const backwardResult = scanBackwardForOpeningTag(document, position, maxLines);
	if (!backwardResult) return undefined;

	// Step 2: Verify we're still within the opening tag (before the closing `>`)
	if (!isBeforeClosingBracket(document, position, backwardResult.tagEndPosition))
		return undefined;

	return backwardResult.tagName;
}

type BackwardScanResult = {
	tagName: string;
	/** Position immediately after the tag name */
	tagEndPosition: Position;
};

/**
 * Scan backwards from cursor position to find an opening `<ComponentName`.
 * Tracks bracket/string depth to skip nested content.
 * Returns undefined if we find a closing `>` at depth 0 before finding a tag.
 */
function scanBackwardForOpeningTag(
	document: TextDocument,
	position: Position,
	maxLines: number
): BackwardScanResult | undefined {
	let currentLine = position.line;
	const cursorChar = position.character;
	const minLine = Math.max(0, position.line - maxLines);

	// Determine initial state by scanning forward from line start to cursor position
	const lineText = document.lineAt(position.line).text;
	const initialState = determineInitialState(lineText, cursorChar);

	// Depth tracking for nested brackets
	let braceDepth = initialState.braceDepth;
	let parenDepth = initialState.parenDepth;
	let bracketDepth = initialState.bracketDepth;
	let inString = initialState.inString;

	while (currentLine >= minLine) {
		const currentLineText = document.lineAt(currentLine).text;

		// Start from cursor position on first line, otherwise from end of line
		const startChar =
			currentLine === position.line ? cursorChar - 1 : currentLineText.length - 1;

		for (let i = startChar; i >= 0; i--) {
			const char = currentLineText[i];

			// Handle string literals (scanning backwards)
			if (char === '"' || char === "'" || char === '`') {
				// Count preceding backslashes to check for escaping
				let backslashCount = 0;
				let j = i - 1;
				while (j >= 0 && currentLineText[j] === '\\') {
					backslashCount++;
					j--;
				}
				const isEscaped = backslashCount % 2 === 1;

				if (!isEscaped)
					// Toggle string state
					inString = inString === char ? null : (inString ?? char);
				continue;
			}

			// Skip everything while inside a string
			if (inString) continue;

			// Track bracket depth (scanning backwards, so closing brackets increase depth)
			if (char === '}') {
				braceDepth++;
				continue;
			}
			if (char === '{') {
				braceDepth--;
				continue;
			}
			if (char === ')') {
				parenDepth++;
				continue;
			}
			if (char === '(') {
				parenDepth--;
				continue;
			}
			if (char === ']') {
				bracketDepth++;
				continue;
			}
			if (char === '[') {
				bracketDepth--;
				continue;
			}

			// Only check for `<` and `>` at depth 0
			const atDepthZero = braceDepth === 0 && parenDepth === 0 && bracketDepth === 0;

			if (atDepthZero) {
				// Found closing `>` at depth 0 - we're not inside an opening tag
				if (char === '>') return undefined;

				// Found opening `<` - check if followed by a capitalized component name
				if (char === '<') {
					// Check if this is a closing tag `</`
					if (i + 1 < currentLineText.length && currentLineText[i + 1] === '/')
						return undefined;

					// Extract the tag name after `<`
					const afterBracket = currentLineText.slice(i + 1);
					const match = /^([A-Z][A-Za-z0-9_.-]*)/.exec(afterBracket);

					if (match) {
						const tagName = match[1];
						// Exclude svelte built-ins
						if (tagName.startsWith('svelte:')) return undefined;

						return {
							tagName,
							tagEndPosition: { line: currentLine, character: i + 1 + tagName.length }
						};
					}

					// Found `<` but not followed by a component name
					return undefined;
				}
			}
		}

		// When moving to previous line, reset state by checking end of that line
		currentLine--;
		if (currentLine >= minLine) {
			const prevLineText = document.lineAt(currentLine).text;
			const prevState = determineInitialState(prevLineText, prevLineText.length);
			inString = prevState.inString;
			// Add current depths to what we find on the previous line
			// (they accumulate as we go backwards)
			braceDepth += prevState.braceDepth;
			parenDepth += prevState.parenDepth;
			bracketDepth += prevState.bracketDepth;
		}
	}

	// Reached max lines without finding opening tag
	return undefined;
}

type InitialState = {
	inString: string | null;
	braceDepth: number;
	parenDepth: number;
	bracketDepth: number;
};

/**
 * Determine the string and bracket state at a position by scanning forward from line start.
 * Returns the quote character if inside a string, and net bracket depths.
 */
function determineInitialState(lineText: string, upToChar: number): InitialState {
	let inString: string | null = null;
	let braceDepth = 0;
	let parenDepth = 0;
	let bracketDepth = 0;

	for (let i = 0; i < upToChar && i < lineText.length; i++) {
		const char = lineText[i];

		// Handle string quotes
		if (char === '"' || char === "'" || char === '`') {
			// Count preceding backslashes to check for escaping
			let backslashCount = 0;
			let j = i - 1;
			while (j >= 0 && lineText[j] === '\\') {
				backslashCount++;
				j--;
			}
			const isEscaped = backslashCount % 2 === 1;

			if (!isEscaped) inString = inString === char ? null : (inString ?? char);
			continue;
		}

		// Only track brackets when not in a string
		if (inString) continue;

		if (char === '{') braceDepth++;
		else if (char === '}') braceDepth--;
		else if (char === '(') parenDepth++;
		else if (char === ')') parenDepth--;
		else if (char === '[') bracketDepth++;
		else if (char === ']') bracketDepth--;
	}

	return { inString, braceDepth, parenDepth, bracketDepth };
}

/**
 * Verify that the cursor position is before the closing `>` of the opening tag.
 * Scans forward from just after the tag name, tracking brackets and strings.
 */
function isBeforeClosingBracket(
	document: TextDocument,
	cursorPosition: Position,
	tagEndPosition: Position
): boolean {
	let currentLine = tagEndPosition.line;
	const currentChar = tagEndPosition.character;

	// Depth tracking for nested brackets
	let braceDepth = 0; // {}
	let parenDepth = 0; // ()
	let bracketDepth = 0; // []

	// String tracking
	let inString: string | null = null;

	// We need to scan from tagEndPosition forward until we find the closing `>`
	// and check if cursorPosition is before that point

	// Safety limit to prevent infinite loops
	const maxForwardLines = 200;
	const maxLine = Math.min(
		document.lineAt(0).text.length > 0 ? currentLine + maxForwardLines : currentLine,
		Number.MAX_SAFE_INTEGER
	);

	while (currentLine <= maxLine) {
		let lineText: string;
		try {
			lineText = document.lineAt(currentLine).text;
		} catch {
			// Reached end of document
			return false;
		}

		const startChar = currentLine === tagEndPosition.line ? currentChar : 0;

		for (let i = startChar; i < lineText.length; i++) {
			const char = lineText[i];

			// Handle string literals (forward scanning)
			if (char === '"' || char === "'" || char === '`') {
				// Count preceding backslashes to check for escaping
				let backslashCount = 0;
				let j = i - 1;
				while (j >= 0 && lineText[j] === '\\') {
					backslashCount++;
					j--;
				}
				const isEscaped = backslashCount % 2 === 1;

				if (!isEscaped)
					// Toggle string state
					inString = inString === char ? null : (inString ?? char);
				continue;
			}

			// Skip everything while inside a string
			if (inString) continue;

			// Track bracket depth
			if (char === '{') {
				braceDepth++;
				continue;
			}
			if (char === '}') {
				braceDepth--;
				continue;
			}
			if (char === '(') {
				parenDepth++;
				continue;
			}
			if (char === ')') {
				parenDepth--;
				continue;
			}
			if (char === '[') {
				bracketDepth++;
				continue;
			}
			if (char === ']') {
				bracketDepth--;
				continue;
			}

			// Only check for `>` at depth 0
			const atDepthZero = braceDepth === 0 && parenDepth === 0 && bracketDepth === 0;

			if (atDepthZero && char === '>') {
				// Found the closing `>`. Check if cursor is before this position.
				const closingPosition = { line: currentLine, character: i };
				return isPositionBefore(cursorPosition, closingPosition);
			}

			// If we hit another `<` at depth 0, something is wrong
			if (atDepthZero && char === '<') return false;
		}

		currentLine++;
	}

	// Didn't find closing `>` within limit
	return false;
}

/**
 * Check if position A is before position B.
 */
function isPositionBefore(a: Position, b: Position): boolean {
	if (a.line < b.line) return true;
	if (a.line > b.line) return false;
	return a.character < b.character;
}
