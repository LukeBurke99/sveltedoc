/**
 * Prop Parser for Svelte 5 $props() Rune
 *
 * Extracts prop information from Svelte 5 components using the $props() rune.
 * Parses TypeScript type/interface definitions to determine prop types, required status,
 * JSDoc comments, default values, and bindable status.
 *
 * Pipeline:
 * 1. Find $props() destructuring → extract type annotation
 * 2. Parse type annotation → split into individual type names
 * 3. Extract type/interface definitions → build TypeMap
 * 4. Extract destructuring defaults → get default values and bindable markers
 * 5. Merge all sources → produce final PropInfo[]
 */

import { DestructuringScanner } from '../classes/DestructuringScanner';
import { PropertyScanner } from '../classes/PropertyScanner';
import { PropInfo, ScriptBlock, TypeDefinition, TypeMap } from '../types';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Strip all comment types from code for parsing purposes.
 *
 * IMPORTANT: While inside a string literal, comment syntax (// or /*) is treated as plain text.
 */
function stripCommentsForParsing(code: string): string {
	let result = '';
	let i = 0;
	let inString = false;
	let stringChar = '';

	while (i < code.length) {
		const ch = code[i];
		const next = i + 1 < code.length ? code[i + 1] : '';
		const prev = i > 0 ? code[i - 1] : '';

		// Track string literals - comment syntax inside strings is just text
		if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\') {
			if (!inString) {
				inString = true;
				stringChar = ch;
			} else if (ch === stringChar) {
				inString = false;
				stringChar = '';
			}
			result += ch;
			i++;
			continue;
		}

		// Only process comments when NOT inside a string
		if (!inString) {
			// Single-line comment
			if (ch === '/' && next === '/') {
				while (i < code.length && code[i] !== '\n' && code[i] !== '\r') i++;
				continue;
			}

			// Multi-line comment (includes JSDoc)
			if (ch === '/' && next === '*') {
				i += 2;
				while (i < code.length - 1) {
					if (code[i] === '*' && code[i + 1] === '/') {
						i += 2;
						break;
					}
					i++;
				}
				continue;
			}
		}

		result += ch;
		i++;
	}

	return result;
}

/**
 * Check if a specific position in code is inside a comment.
 *
 * IMPORTANT: String literals are tracked because comment syntax inside strings
 * should not trigger comment detection.
 */
function isPositionCommented(code: string, position: number): boolean {
	let i = 0;
	let inString = false;
	let stringChar = '';

	while (i < position && i < code.length) {
		const ch = code[i];
		const next = i + 1 < code.length ? code[i + 1] : '';
		const prev = i > 0 ? code[i - 1] : '';

		// Track string literals
		if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\') {
			if (!inString) {
				inString = true;
				stringChar = ch;
			} else if (ch === stringChar) {
				inString = false;
				stringChar = '';
			}
			i++;
			continue;
		}

		// Only check for comments when NOT inside a string
		if (!inString) {
			if (ch === '/' && next === '/') {
				let j = i;
				while (j < code.length && code[j] !== '\n' && code[j] !== '\r') {
					if (j === position) return true;
					j++;
				}
				i = j;
				continue;
			}

			if (ch === '/' && next === '*') {
				i += 2;
				while (i < code.length - 1) {
					if (i === position) return true;
					if (code[i] === '*' && code[i + 1] === '/') {
						if (position <= i + 1) return true;
						i += 2;
						break;
					}
					i++;
				}
				continue;
			}
		}

		i++;
	}

	return false;
}

/**
 * Parse inheritance clause into individual type names.
 *
 * IMPORTANT: Tracks both string literals AND depth to correctly split only at top level.
 */
function parseParentTypes(clause: string): string[] {
	if (!clause) return [];

	const parts: string[] = [];
	let current = '';
	let depth = 0;
	let inString = false;
	let stringChar = '';

	for (let i = 0; i < clause.length; i++) {
		const ch = clause[i];
		const prev = i > 0 ? clause[i - 1] : '';

		// Track string literals - delimiters inside strings should be ignored
		if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\')
			if (!inString) {
				inString = true;
				stringChar = ch;
			} else if (ch === stringChar) {
				inString = false;
				stringChar = '';
			}

		// Only track depth and split when NOT inside a string
		if (!inString)
			if (ch === '<' || ch === '(' || ch === '[' || ch === '{') {
				depth++;
			} else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') {
				depth--;
			} else if (depth === 0 && (ch === ',' || ch === '&')) {
				const trimmed = current.trim();
				if (trimmed && trimmed !== '{}') parts.push(trimmed);
				current = '';
				continue;
			}

		current += ch;
	}

	const trimmed = current.trim();
	if (trimmed && trimmed !== '{}') parts.push(trimmed);

	return parts;
}

// =============================================================================
// PIPELINE FUNCTIONS
// =============================================================================

/**
 * STEP 1: Find $props() destructuring and extract type annotation.
 */
function findPropsDestructuring(blocks: ScriptBlock[]): { typeAnnotation: string } | undefined {
	for (const block of blocks) {
		const stripped = stripCommentsForParsing(block.content);
		const propsRegex = /(?:let|const)\s*{/g;
		let match: RegExpExecArray | null;

		while ((match = propsRegex.exec(stripped))) {
			const startPos = match.index + match[0].length - 1;
			let depth = 0;
			let i = startPos;
			let closingBracePos = -1;
			let inStringBrace = false;
			let stringCharBrace = '';

			while (i < stripped.length) {
				const ch = stripped[i];
				const prev = i > 0 ? stripped[i - 1] : '';

				// Track strings
				if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\')
					if (!inStringBrace) {
						inStringBrace = true;
						stringCharBrace = ch;
					} else if (ch === stringCharBrace) {
						inStringBrace = false;
						stringCharBrace = '';
					}

				// Track braces only outside strings
				if (!inStringBrace)
					if (ch === '{') {
						depth++;
					} else if (ch === '}') {
						depth--;
						if (depth === 0) {
							closingBracePos = i;
							break;
						}
					}

				i++;
			}

			if (closingBracePos === -1) continue;

			i = closingBracePos + 1;
			while (i < stripped.length && /\s/.test(stripped[i])) i++;
			if (i >= stripped.length || stripped[i] !== ':') continue;
			i++;

			while (i < stripped.length && /\s/.test(stripped[i])) i++;

			const typeStart = i;
			depth = 0;
			let inString = false;
			let stringChar = '';

			while (i < stripped.length) {
				const ch = stripped[i];
				const prev = i > 0 ? stripped[i - 1] : '';

				if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\')
					if (!inString) {
						inString = true;
						stringChar = ch;
					} else if (ch === stringChar) {
						inString = false;
						stringChar = '';
					}

				if (!inString)
					if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth++;
					else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') depth--;
					else if (ch === '=' && depth === 0) break;

				i++;
			}

			if (i >= stripped.length) continue;

			const typeAnnotation = stripped.slice(typeStart, i).trim();
			if (!typeAnnotation) continue;

			i++;
			while (i < stripped.length && /\s/.test(stripped[i])) i++;

			if (stripped.slice(i, i + 8) === '$props()') return { typeAnnotation };
		}
	}

	return undefined;
}

/**
 * STEP 2: Parse type annotation into individual type names.
 */
function parseTypeAnnotation(annotation: string): string[] {
	const types: string[] = [];
	let current = '';
	let depth = 0;
	let inString = false;
	let stringChar = '';

	for (let i = 0; i < annotation.length; i++) {
		const ch = annotation[i];
		const prev = i > 0 ? annotation[i - 1] : '';

		if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\')
			if (!inString) {
				inString = true;
				stringChar = ch;
			} else if (ch === stringChar) {
				inString = false;
				stringChar = '';
			}

		if (!inString)
			if (ch === '<' || ch === '(' || ch === '[' || ch === '{') {
				depth++;
			} else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') {
				depth--;
			} else if ((ch === '|' || ch === '&') && depth === 0) {
				const trimmed = current.trim();
				if (trimmed) types.push(trimmed);
				current = '';
				continue;
			}

		current += ch;
	}

	const trimmed = current.trim();
	if (trimmed) types.push(trimmed);

	return types;
}

/**
 * STEP 3: Extract all type/interface definitions from script blocks.
 *
 * IMPORTANT: Tracks strings and comments to avoid counting braces inside them.
 */
function extractTypeMaps(
	blocks: ScriptBlock[],
	normaliseComment: boolean,
	normaliseType: boolean
): TypeMap {
	const typeMap: TypeMap = {};
	for (const b of blocks) {
		const content = b.content;
		const re = /(interface|type)\s+([A-Za-z0-9_]+)\s*/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(content))) {
			if (isPositionCommented(content, m.index)) continue;

			const kind = m[1];
			const typeName = m[2];
			let i = m.index + m[0].length;

			let extendsClause: string | undefined;
			let assignmentPart: string | undefined;

			while (i < content.length && content[i] !== '{') {
				if (content[i] === '\n' || content[i] === '\r') {
					i++;
					continue;
				}
				if (kind === 'interface' && content.slice(i, i + 7) === 'extends') {
					i += 7;
					while (i < content.length && /\s/.test(content[i])) i++;
					const extendsStart = i;
					while (i < content.length && content[i] !== '{') i++;
					extendsClause = content.slice(extendsStart, i).trim();
					break;
				}
				if (kind === 'type' && content[i] === '=') {
					i++;
					while (i < content.length && /\s/.test(content[i])) i++;
					const assignStart = i;
					while (i < content.length && content[i] !== '{') i++;
					assignmentPart = content.slice(assignStart, i).trim();
					break;
				}
				i++;
			}

			if (i >= content.length || content[i] !== '{') continue;

			const openBracePos = i;
			let depth = 0;
			let closingBracePos = -1;
			let inString = false;
			let stringChar = '';
			let inLineComment = false;
			let inBlockComment = false;

			while (i < content.length) {
				const ch = content[i];
				const prev = i > 0 ? content[i - 1] : '';
				const next = i + 1 < content.length ? content[i + 1] : '';

				if (!inString && !inBlockComment && ch === '/' && next === '/') {
					inLineComment = true;
					i += 2;
					continue;
				}

				if (inLineComment) {
					if (ch === '\n' || ch === '\r') inLineComment = false;
					i++;
					continue;
				}

				if (!inString && ch === '/' && next === '*') {
					inBlockComment = true;
					i += 2;
					continue;
				}

				if (inBlockComment) {
					if (ch === '*' && next === '/') {
						inBlockComment = false;
						i += 2;
						continue;
					}
					i++;
					continue;
				}

				if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\')
					if (!inString) {
						inString = true;
						stringChar = ch;
					} else if (ch === stringChar) {
						inString = false;
						stringChar = '';
					}

				if (!inString)
					if (ch === '{') {
						depth++;
					} else if (ch === '}') {
						depth--;
						if (depth === 0) {
							closingBracePos = i;
							break;
						}
					}

				i++;
			}

			if (closingBracePos === -1) continue;

			const body = content.slice(openBracePos + 1, closingBracePos);

			const inherits: string[] = [];

			if (kind === 'interface' && extendsClause)
				inherits.push(...parseParentTypes(extendsClause));
			else if (kind === 'type' && assignmentPart)
				inherits.push(...parseParentTypes(assignmentPart));

			const scanner = new PropertyScanner(body, normaliseComment, normaliseType);
			const entries = scanner.parse();

			typeMap[typeName] = { entries, inherits };
		}
	}
	return typeMap;
}

/**
 * STEP 4: Extract destructuring defaults and bindable markers from $props().
 *
 * Uses DestructuringScanner to handle complex default values with nested braces,
 * such as arrow functions: (event) => { console.log(event); }
 */
function extractDestructurings(
	blocks: ScriptBlock[],
	normaliseDefaultValue: boolean
): Partial<Record<string, { defaultValue?: string; bindable: boolean }>> {
	const map: Partial<Record<string, { defaultValue?: string; bindable: boolean }>> = {};

	for (const b of blocks) {
		const content = stripCommentsForParsing(b.content);

		// Find all $props() destructuring patterns
		// Use depth-aware matching instead of [^}]+ regex
		let pos = 0;
		while (pos < content.length) {
			// Look for: (let|const) {
			const match = /(?:let|const)\s*\{/.exec(content.slice(pos));
			if (!match) break;

			const startPos = pos + match.index + match[0].length;
			pos = startPos;

			// Find the closing } at depth 0
			let depth = 1;
			let endPos = startPos;
			let inString = false;
			let stringChar = '';

			while (endPos < content.length && depth > 0) {
				const ch = content[endPos];
				const prev = endPos > 0 ? content[endPos - 1] : '';

				// Track strings
				if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\')
					if (!inString) {
						inString = true;
						stringChar = ch;
					} else if (ch === stringChar) {
						inString = false;
						stringChar = '';
					}

				// Track braces only outside strings
				if (!inString)
					if (ch === '{') depth++;
					else if (ch === '}') depth--;

				endPos++;
			}

			if (depth !== 0)
				// Unmatched braces, skip
				continue;

			// Extract destructuring content (between { and })
			const destructuringContent = content.slice(startPos, endPos - 1);

			// Check if this is followed by : ... = $props()
			let checkPos = endPos;
			while (checkPos < content.length && /\s/.test(content[checkPos])) checkPos++;

			if (content[checkPos] !== ':')
				// Not a typed destructuring
				continue;

			// Skip type annotation to find = $props()
			const propsMatch = /=\s*\$props\s*\(\s*\)/.exec(content.slice(checkPos));
			if (!propsMatch)
				// Not a $props() destructuring
				continue;

			// Parse the destructuring content with the scanner
			const scanner = new DestructuringScanner(destructuringContent, normaliseDefaultValue);
			const items = scanner.scan();

			for (const item of items) {
				let bindable = false;
				let defaultValue = item.defaultValue;

				if (defaultValue?.startsWith('$bindable(')) {
					bindable = true;
					const argMatch = /\$bindable\((.*)\)/.exec(defaultValue);
					if (argMatch) defaultValue = argMatch[1].trim();
				}

				map[item.name] = { defaultValue, bindable };
			}

			pos = checkPos + propsMatch.index + propsMatch[0].length;
		}
	}

	return map;
}

/**
 * STEP 5: Merge type definitions and destructuring into final PropInfo[].
 */
function mergeTypeAndDestructuring(
	typeMap: TypeMap,
	destMap: Partial<Record<string, { defaultValue?: string; bindable: boolean }>>,
	typeNamesToUse: string[]
): { props: PropInfo[]; inherits: string[] } {
	const localTypes: TypeDefinition[] = [];
	const externalTypes: string[] = [];

	for (const typeName of typeNamesToUse) {
		const baseTypeName = typeName.split('<')[0].trim();
		const typeDef = typeMap[baseTypeName];

		if (typeDef) localTypes.push(typeDef);
		else externalTypes.push(typeName);
	}

	const allInherits = new Set<string>(externalTypes);
	for (const typeDef of localTypes)
		for (const parent of typeDef.inherits) allInherits.add(parent);

	const allTypeEntries = new Map<
		string,
		{ name: string; type: string; required: boolean; comment?: string }
	>();
	for (const typeDef of localTypes)
		for (const [name, entry] of Object.entries(typeDef.entries))
			if (entry) allTypeEntries.set(name, entry);

	const allNames = new Set([...allTypeEntries.keys(), ...Object.keys(destMap)]);
	const result: PropInfo[] = [];

	for (const name of allNames) {
		const t = allTypeEntries.get(name);
		const d = destMap[name];
		const base: PropInfo = {
			name,
			type: 'unknown',
			required: false,
			bindable: false
		};
		if (t) {
			base.type = t.type;
			base.required = t.required;
			if (t.comment) base.comment = t.comment;
		}
		if (d) {
			base.bindable = d.bindable;
			if (d.defaultValue) base.defaultValue = d.defaultValue;
		}
		result.push(base);
	}

	return {
		props: result, // Preserve declaration order; sorting happens in TooltipFormatter
		inherits: Array.from(allInherits)
	};
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Parse props from Svelte 5 script blocks using the $props() rune.
 */
export function parsePropsFromScriptBlocks(
	blocks: ScriptBlock[],
	normaliseComment: boolean = false,
	normaliseType: boolean = true,
	normaliseDefaultValue: boolean = true
): {
	props: PropInfo[];
	inherits: string[];
} {
	const propsInfo = findPropsDestructuring(blocks);

	if (!propsInfo) return { props: [], inherits: [] };

	const typeNames = parseTypeAnnotation(propsInfo.typeAnnotation);
	const typeMaps = extractTypeMaps(blocks, normaliseComment, normaliseType);
	const destructurings = extractDestructurings(blocks, normaliseDefaultValue);

	return mergeTypeAndDestructuring(typeMaps, destructurings, typeNames);
}
