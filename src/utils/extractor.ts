import * as fs from 'node:fs';
import { parseAttributes } from '../parsers/scriptParser';
import type { ScriptBlock } from '../types';

/**
 * Extract all <script> blocks from a .svelte file. Lightweight regex approach.
 * Returns both instance and module context scripts.
 * @param filePath Path to the .svelte file
 * @returns Array of extracted ScriptBlock objects
 */
export function extractScriptBlocksFromSvelte(filePath: string): ScriptBlock[] {
	const text = fs.readFileSync(filePath, 'utf8');
	return extractScriptBlocksFromText(text);
}

/**
 * Extract all <script> blocks from given text. Lightweight regex approach.
 * Returns both instance and module context scripts.
 * @param text Text content to scan for script blocks
 * @returns Array of extracted ScriptBlock objects
 */
export function extractScriptBlocksFromText(text: string): ScriptBlock[] {
	// Remove HTML comments first to avoid extracting commented-out script blocks
	const withoutComments = text.replace(/<!--[\s\S]*?-->/g, '');

	const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
	const blocks: ScriptBlock[] = [];
	let match: RegExpExecArray | null;
	while ((match = re.exec(withoutComments))) {
		const attrs = parseAttributes(match[1] || '');
		const content = match[2] || '';
		blocks.push({ content, attributes: attrs });
	}
	return blocks;
}

/**
 * Collects all local import names and their specifiers from given script blocks.
 * Supports both default imports and named imports.
 * @param blocks Array of script blocks to scan for imports
 * @returns Map of local import names to their specifiers
 * @example
 * // Default import: import Button from './Button.svelte'
 * // Named import: import { PageStore } from './store'
 * // Named import with alias: import { Component as Comp } from './Component'
 */
export function extractImportsFromScriptBlocks(
	blocks: ReturnType<typeof extractScriptBlocksFromText>
): Map<string, string> {
	const map = new Map<string, string>();
	for (const b of blocks) {
		let m: RegExpExecArray | null;

		// Match default-only imports: import Name from 'spec'
		// Uses negative lookahead to exclude mixed imports (those with comma)
		const defaultRe = /import\s+([A-Za-z_][A-Za-z0-9_]*)(?!\s*,)\s+from\s+['"]([^'"]+)['"];?/g;
		while ((m = defaultRe.exec(b.content))) map.set(m[1], m[2]);

		// Match all imports with braces: { ... }
		// Handles: import { named } from 'spec'
		//          import { name as alias } from 'spec'
		//          import Default, { named } from 'spec'  (mixed)
		const bracesRe =
			/import\s+(?:([A-Za-z_][A-Za-z0-9_]*)\s*,\s*)?\{\s*([^}]+)\}\s*from\s+['"]([^'"]+)['"];?/g;
		while ((m = bracesRe.exec(b.content))) {
			const defaultName = m[1]; // Captured if mixed import
			const namedPart = m[2];
			const spec = m[3];

			// Add default import if present (mixed import case)
			if (defaultName) map.set(defaultName, spec);

			// Parse and add named imports
			const parts = namedPart.split(',');
			for (const part of parts) {
				const trimmed = part.trim();
				if (!trimmed || trimmed.startsWith('type ')) continue;

				// Handle 'Name as Alias' -> use Alias
				const asMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(
					trimmed
				);
				if (asMatch) {
					map.set(asMatch[2], spec);
				} else {
					const nameMatch = /^([A-Za-z_][A-Za-z0-9_]*)$/.exec(trimmed);
					if (nameMatch) map.set(nameMatch[1], spec);
				}
			}
		}
	}
	return map;
}
