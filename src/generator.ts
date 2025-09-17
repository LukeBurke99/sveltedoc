import {
	escapeRegExp,
	scanToTopLevelSemicolon,
	splitOnce,
	splitTopLevel,
	wildcardToRegex
} from './core';
import type { BuildOptions, ExtractResult, ProcessOptions, PropDoc } from './types';

const START_MARK = '<!-- @component';

/**
 * Process a Svelte component document and produce an updated version with a fresh @component block.
 *
 * Reads the TypeScript `<script lang="ts">` blocks, extracts `$props()` typing and defaults,
 * resolves the props/inherits lists, and inserts or updates a leading `<!-- @component ... -->` block.
 *
 * @param source - The full `.svelte` file contents.
 * @param options - Processing options controlling description handling and name matching.
 * @returns An object containing the updated source, a changed flag, and a log of steps.
 */
export function processSvelteDoc(
	source: string,
	options: ProcessOptions
): { updated: string; changed: boolean; log: string[] } {
	const log: string[] = [];
	// Skip if there is no <script> tag at all
	if (!/<script\b/i.test(source)) {
		log.push('No <script> tag found - skipping doc block');
		return { updated: source, changed: false, log };
	}
	const {
		scripts,
		leadingComment
	}: {
		scripts: string[];
		leadingComment?: { raw: string; description: string };
	} = extractScriptsAndLeadingComment(source);
	const combinedTS = scripts.join('\n\n');
	const extract = extractDocsFromTS(combinedTS, options.propertyNameMatch);

	// If no props and no inherits, and title/desc disabled, do nothing
	if (!options.addDescription && extract.props.length === 0 && extract.inherits.length === 0) {
		log.push('No props/inherits and title/description disabled - skipping doc block');
		return { updated: source, changed: false, log };
	}

	const newComment = buildComment({
		addDescription: options.addDescription,
		placeDescriptionBeforeProps: options.placeDescriptionBeforeProps,
		existingDescription: leadingComment?.description ?? '',
		inherits: extract.inherits,
		props: extract.props,
		escapeAngleBrackets: options.escapeAngleBrackets
	});

	const updated = insertOrUpdateComment(source, newComment);
	const changed = updated !== source;
	log.push(
		'Props extracted: ' +
			String(extract.props.length) +
			'; Inherits: ' +
			String(extract.inherits.length) +
			'; Changed: ' +
			String(changed)
	);
	log.push(...extract.debug);
	if (extract.props.length === 0 && extract.inherits.length === 0)
		log.push('No props found. Emitting description-only block.');
	return { updated, changed, log };
}

//#region Extraction and parsing

/**
 * Extract TS `<script lang="ts">` contents and an existing leading `@component` comment, if present.
 *
 * @param source - The full `.svelte` source.
 * @returns An object with an array of TypeScript script contents and an optional leading comment block
 *          with its raw text and preserved description.
 */
function extractScriptsAndLeadingComment(source: string): {
	scripts: string[];
	leadingComment?: { raw: string; description: string };
} {
	const scripts: string[] = [];
	// Match any <script ...>...</script>, allowing quoted attributes that may contain '>'
	const scriptRegex = /<script\b(?:[^>"']|"[^"]*"|'[^']*')*>([\s\S]*?)<\/script>/gi;
	let m: RegExpExecArray | null;
	while ((m = scriptRegex.exec(source)) !== null) scripts.push(m[1]);

	// Head before first script of any kind
	const firstScriptIdx = source.search(/<script\b(?:[^>"']|"[^"]*"|'[^']*')*>/i);
	const head = firstScriptIdx === -1 ? source : source.slice(0, firstScriptIdx);
	let leadingComment: { raw: string; description: string } | undefined;
	const compMatch = /<!--\s*@component[\s\S]*?-->\s*$/i.exec(head.trimStart());
	if (compMatch) {
		const raw = compMatch[0];
		const description = extractDescriptionFromComment(raw);
		leadingComment = { raw, description };
	}
	return { scripts, leadingComment };
}

/**
 * Parse concatenated TypeScript code to extract prop documentation and inherited types.
 *
 * Searches for typed `$props` destructuring to infer the props type and defaults, then resolves the
 * found type alias or interface, collects members with optionality, descriptions, defaults, and
 * whether they are bindable via `$bindable()`.
 *
 * @param tsCode - The combined TS code string from all `<script lang="ts">` blocks.
 * @param patterns - Fallback name patterns for props types if direct inference fails.
 * @returns An ExtractResult including props, inherits, inferred type name, and debug info.
 */
function extractDocsFromTS(tsCode: string, patterns: string[]): ExtractResult {
	const result: ExtractResult = {
		inferredTypeName: undefined,
		props: [],
		inherits: [],
		hasRest: false,
		debug: []
	};

	// Helper function to remove comments from code snippets
	function removeCommentsFromCode(s: string): string {
		let out = '';
		let inString: '"' | "'" | '`' | null = null;
		let inLine = false;
		let inBlock = false;
		for (let j = 0; j < s.length; j++) {
			const ch = s[j];
			const next = j + 1 < s.length ? s[j + 1] : '';
			const prev = j > 0 ? s[j - 1] : '';
			if (inLine) {
				if (ch === '\n') {
					inLine = false;
					out += ch;
				}
				continue;
			}
			if (inBlock) {
				if (ch === '*' && next === '/') {
					inBlock = false;
					j++; // consume '/'
				}
				continue;
			}
			if (inString) {
				out += ch;
				if (ch === inString && prev !== '\\') inString = null;
				continue;
			}
			if (ch === '"' || ch === "'" || ch === '`') {
				inString = ch as any;
				out += ch;
				continue;
			}
			if (ch === '/' && next === '/') {
				inLine = true;
				j++; // skip second '/'
				continue;
			}
			if (ch === '/' && next === '*') {
				inBlock = true;
				j++; // skip '*'
				continue;
			}
			out += ch;
		}
		return out;
	}

	// Find typed destructuring of $props
	const destructMatch =
		/(?:const|let|var)\s*{([\s\S]*?)}\s*:\s*([A-Za-z_]\w*)\s*(?:<[^>]*?>)?\s*=\s*\$props\s*\(/m.exec(
			tsCode
		);
	const defaults = new Map<string, string>();
	const bindables = new Set<string>();
	let hasRest = false;
	let typeName: string | undefined;
	if (destructMatch) {
		const body = destructMatch[1];
		typeName = destructMatch[2];
		result.inferredTypeName = typeName;
		result.debug.push(`Found $props destructuring; type: ${typeName}`);
		const parts = splitTopLevel(body, ',');
		for (const raw of parts) {
			const item = raw.trim();
			if (!item) continue;
			if (item.startsWith('...')) {
				hasRest = true;
				continue;
			}
			const [left, defaultRhs] = splitOnce(item, '=');
			const [maybeName] = splitOnce(left.trim(), ':');
			const name = maybeName.trim();
			if (defaultRhs !== undefined) {
				const def = removeCommentsFromCode(defaultRhs.trim());
				defaults.set(name, def);
				if (/\$bindable\s*\(/.test(def)) bindables.add(name);
			}
		}
	} else {
		result.debug.push('No typed $props destructuring matched.');
	}
	result.hasRest = hasRest;

	// Resolve type or interface block
	let typeBlock = typeName ? findTypeAliasBlock(tsCode, typeName) : undefined;
	let iface: { membersText: string; extends: string[] } | undefined;
	if (!typeBlock && typeName) iface = findInterfaceBlock(tsCode, typeName);
	if (!typeBlock && !iface) {
		const regexes = patterns.map((p) => wildcardToRegex(p));
		// Try type aliases by name pattern
		const typeDeclRe = new RegExp(
			String.raw`(?:export\s+)?type\s+([A-Za-z_]\w*(?:<[^>]*?>)?)\s*=`,
			'g'
		);
		let m: RegExpExecArray | null;
		while ((m = typeDeclRe.exec(tsCode)) !== null) {
			const fullName = m[1];
			const baseName = fullName.replace(/<[^>]*>\s*$/, '');
			if (regexes.some((r) => r.test(baseName))) {
				typeBlock = findTypeAliasBlock(tsCode, baseName);
				result.inferredTypeName = baseName;
				result.debug.push(`Using fallback type alias: ${baseName}`);
				break;
			}
		}
		// If no type alias matched, try interface declarations by name pattern
		if (!typeBlock) {
			const ifaceDeclRe = new RegExp(
				String.raw`(?:export\s+)?interface\s+([A-Za-z_]\w*(?:<[^>]*?>)?)\b`,
				'g'
			);
			while (!iface && (m = ifaceDeclRe.exec(tsCode)) !== null) {
				const fullName = m[1];
				const baseName = fullName.replace(/<[^>]*>\s*$/, '');
				if (regexes.some((r) => r.test(baseName))) {
					iface = findInterfaceBlock(tsCode, baseName);
					if (iface) {
						result.inferredTypeName = baseName;
						result.debug.push(`Using fallback interface: ${baseName}`);
					}
				}
			}
		}
	}
	if (!typeBlock && !iface && typeName)
		result.debug.push(`Type/interface not found for: ${typeName}`);

	const props: PropDoc[] = [];
	const inherits: string[] = [];
	if (typeBlock) {
		const parts = splitIntersection(typeBlock);
		for (const part of parts) {
			const trimmed = part.trim();
			if (trimmed.startsWith('{')) {
				const membersText = trimmed.slice(1, trimmed.lastIndexOf('}'));
				const members = parseTypeMembers(membersText);
				for (const mem of members) {
					const defaultText = defaults.get(mem.name);
					const bindable = bindables.has(mem.name);
					props.push({
						name: mem.name,
						typeText: mem.typeText,
						optional: mem.optional,
						defaultText,
						bindable,
						description: mem.description
					});
				}
			} else {
				inherits.push(trimmed);
			}
		}
	} else if (iface) {
		const members = parseTypeMembers(iface.membersText);
		for (const mem of members) {
			const defaultText = defaults.get(mem.name);
			const bindable = bindables.has(mem.name);
			props.push({
				name: mem.name,
				typeText: mem.typeText,
				optional: mem.optional,
				defaultText,
				bindable,
				description: mem.description
			});
		}
		inherits.push(...iface.extends.map((s) => s.trim()).filter(Boolean));
	}

	if (props.length === 0 && defaults.size > 0)
		for (const [name, def] of defaults) {
			const bindable = /\$bindable\s*\(/.test(def);
			props.push({ name, typeText: 'unknown', optional: false, defaultText: def, bindable });
		}

	props.sort((a, b) => {
		if (a.optional !== b.optional) return a.optional ? 1 : -1;
		return a.name.localeCompare(b.name);
	});
	result.props = props;
	result.inherits = Array.from(new Set(inherits));
	result.debug.push('Final props count: ' + String(props.length));
	return result;
}

/**
 * Locate the right-hand side expression for a named type alias, allowing optional generics.
 *
 * @param tsCode - Source TypeScript code.
 * @param typeName - The alias name to find.
 * @returns The trimmed RHS text of the type alias, or undefined if not found.
 */
function findTypeAliasBlock(tsCode: string, typeName: string): string | undefined {
	let re = new RegExp(
		String.raw`\bexport\s+type\s+${escapeRegExp(typeName)}\b\s*(?:<[^>]*?>)?\s*=`,
		'm'
	);
	let m = re.exec(tsCode);
	if (!m) {
		re = new RegExp(String.raw`\btype\s+${escapeRegExp(typeName)}\b\s*(?:<[^>]*?>)?\s*=`, 'm');
		m = re.exec(tsCode);
	}
	if (!m) return undefined;
	const start = m.index + m[0].length;
	const end = scanToTopLevelSemicolon(tsCode, start);
	if (end === -1) return undefined;
	return tsCode.slice(start, end).trim();
}

/**
 * Find an interface declaration and return its members text and extends list.
 *
 * @param tsCode - Source TypeScript code.
 * @param typeName - The interface name to find.
 * @returns The interface body members text and a list of extended interface/type names, or undefined.
 */
function findInterfaceBlock(
	tsCode: string,
	typeName: string
): { membersText: string; extends: string[] } | undefined {
	// Match: export interface Name (<generics>)? (extends A, B)? { ... }
	const re = new RegExp(
		String.raw`\b(?:export\s+)?interface\s+${escapeRegExp(typeName)}\b\s*(?:<[^>]*?>)?\s*(?:extends\s+([^\{]+))?\s*\{`,
		'm'
	);
	const m = re.exec(tsCode);
	if (!m) return undefined;
	const extendsRaw = m[1];
	// Find the body block braces starting at the first '{' after the match
	const openIdx = tsCode.indexOf('{', m.index + m[0].length - 1);
	if (openIdx === -1) return undefined;
	let depth = 0;
	let i = openIdx;
	for (; i < tsCode.length; i++) {
		const ch = tsCode[i];
		if (ch === '{') {
			depth++;
		} else if (ch === '}') {
			depth--;
			if (depth === 0) break;
		}
	}
	if (i >= tsCode.length) return undefined;
	const body = tsCode.slice(openIdx + 1, i);
	const extendsList = extendsRaw
		? splitTopLevel(extendsRaw, ',')
				.map((s) => s.trim())
				.filter(Boolean)
		: [];
	return { membersText: body, extends: extendsList };
}

/**
 * Parse property signatures from an object type literal's members text.
 *
 * Extracts name, optionality, type text, and JSDoc summary for each property.
 *
 * @param membersText - The text inside a type literal or interface body.
 * @returns A list of parsed member descriptors.
 */
function parseTypeMembers(
	membersText: string
): { name: string; typeText: string; optional: boolean; description?: string }[] {
	const out: { name: string; typeText: string; optional: boolean; description?: string }[] = [];

	// Remove // and /* */ comments from a type snippet, preserving string contents
	function removeTypeComments(s: string): string {
		let out = '';
		let inString: '"' | "'" | '`' | null = null;
		let inLine = false;
		let inBlock = false;
		for (let j = 0; j < s.length; j++) {
			const ch = s[j];
			const next = j + 1 < s.length ? s[j + 1] : '';
			const prev = j > 0 ? s[j - 1] : '';
			if (inLine) {
				if (ch === '\n') {
					inLine = false;
					out += ch;
				}
				continue;
			}
			if (inBlock) {
				if (ch === '*' && next === '/') {
					inBlock = false;
					j++; // consume '/'
				}
				continue;
			}
			if (inString) {
				out += ch;
				if (ch === inString && prev !== '\\') inString = null;
				continue;
			}
			if (ch === '"' || ch === "'" || ch === '`') {
				inString = ch as any;
				out += ch;
				continue;
			}
			if (ch === '/' && next === '/') {
				inLine = true;
				j++; // skip second '/'
				continue;
			}
			if (ch === '/' && next === '*') {
				inBlock = true;
				j++; // skip '*'
				continue;
			}
			out += ch;
		}
		return out;
	}

	// We implement a small scanner that walks the text, capturing optional JSDoc,
	// then an identifier, optional '?', ':', and then a type segment that can include
	// nested {}, (), [], <> and strings, ending at the next top-level ';'.
	let i = 0;
	const n = membersText.length;
	function skipWs(): void {
		while (i < n && /\s/.test(membersText[i])) i++;
	}
	function readJsDoc(): string | undefined {
		skipWs();
		if (membersText.startsWith('/**', i)) {
			const start = i;
			i += 3;
			while (i < n && !membersText.startsWith('*/', i)) i++;
			if (i < n) i += 2; // consume */
			return membersText.slice(start, i);
		}
		return undefined;
	}
	while (i < n) {
		const jsdoc = readJsDoc();
		skipWs();
		// Read identifier
		const idStart = i;
		while (i < n && /[A-Za-z0-9_]/.test(membersText[i])) i++;
		if (i === idStart) {
			// Not an identifier; advance one char to avoid infinite loop
			i++;
			continue;
		}
		const name = membersText.slice(idStart, i);
		skipWs();
		let optional = false;
		if (membersText[i] === '?') {
			optional = true;
			i++;
			skipWs();
		}
		if (membersText[i] !== ':') {
			// Not a prop signature; skip to next semicolon
			while (i < n && membersText[i] !== ';') i++;
			if (i < n) i++;
			continue;
		}
		i++; // skip ':'
		skipWs();
		// Read type until next top-level ';'
		let depthParens = 0,
			depthBraces = 0,
			depthBrackets = 0,
			depthAngles = 0;
		let inString: '"' | "'" | '`' | null = null;
		const startType = i;
		let captured = false;
		for (; i < n; i++) {
			const ch = membersText[i];
			const next = i + 1 < n ? membersText[i + 1] : '';
			const prev = i > 0 ? membersText[i - 1] : '';
			if (inString) {
				if (ch === inString && prev !== '\\') inString = null;
				continue;
			}
			if (ch === '"' || ch === "'" || ch === '`') {
				inString = ch as any;
				continue;
			}
			if (ch === '/' && next === '/') {
				// line comment inside type; consume to newline
				i += 2;
				while (i < n && membersText[i] !== '\n') i++;
				continue;
			}
			if (ch === '/' && next === '*') {
				// block comment inside type
				i += 2;
				while (i + 1 < n && !(membersText[i] === '*' && membersText[i + 1] === '/')) i++;
				if (i + 1 < n) i += 2;
				continue;
			}
			switch (ch) {
				case '(':
					depthParens++;
					break;
				case ')':
					depthParens = Math.max(0, depthParens - 1);
					break;
				case '{':
					depthBraces++;
					break;
				case '}':
					depthBraces = Math.max(0, depthBraces - 1);
					break;
				case '[':
					depthBrackets++;
					break;
				case ']':
					depthBrackets = Math.max(0, depthBrackets - 1);
					break;
				case '<':
					depthAngles++;
					break;
				case '>':
					depthAngles = Math.max(0, depthAngles - 1);
					break;
				case ';':
					if (
						depthParens === 0 &&
						depthBraces === 0 &&
						depthBrackets === 0 &&
						depthAngles === 0
					) {
						const typeText = removeTypeComments(membersText.slice(startType, i)).trim();
						const description = jsdoc ? extractJsDocSummary(jsdoc) : undefined;
						out.push({ name, typeText, optional, description });
						i++; // consume ';'
						captured = true;
					}
					break;
				default:
					break;
			}
			if (captured) break; // break out of for-loop when we've captured the type
		}
		// If we reached the end without a terminating semicolon, capture till end
		if (!captured && i >= n) {
			const typeText = removeTypeComments(membersText.slice(startType))
				.trim()
				.replace(/;$/, '');
			const description = jsdoc ? extractJsDocSummary(jsdoc) : undefined;
			out.push({ name, typeText, optional, description });
		}
	}
	return out;
}

/**
 * Reduce a JSDoc block to a single-line summary.
 *
 * @param jsdoc - The full `/** ... *\/` text.
 * @returns A single-line summary if any content exists; otherwise undefined.
 */
function extractJsDocSummary(jsdoc: string): string | undefined {
	const inner = jsdoc.replace(/^\s*\/\*\*\s*/, '').replace(/\s*\*\/\s*$/, '');
	const lines = inner
		.split(/\r?\n/)
		.map((l) => l.replace(/^\s*\*\s?/, '').trim())
		.filter((l) => l.length > 0);
	return lines.join(' ');
}

function splitIntersection(typeRhs: string): string[] {
	return splitTopLevel(typeRhs, '&');
}

/**
 * Collapse repeated whitespace in inline sections (e.g., bullet items) and optionally
 * replace apostrophes with HTML entities to avoid interference with editors.
 *
 * @param text - The input text to sanitize.
 * @param replaceApos - Whether to replace apostrophes with `&apos;` (default true).
 * @returns The sanitized single-spaced text.
 */
function sanitizeInline(text: string, replaceApos: boolean = true): string {
	const r = text.replace(/\s+/g, ' ');
	return replaceApos ? r.replace(/'/g, '&apos;').trim() : r.trim();
}

/**
 * Escape angle brackets in plain text (not code spans) using visible placeholder characters.
 *
 * @param text - The input text that may contain `<` or `>` characters.
 * @param shouldEscape - Whether to actually perform the escaping.
 * @returns The text with `<` replaced by `◄` and `>` replaced by `►` if shouldEscape is true, otherwise unchanged.
 */
function escapeAngle(text: string, shouldEscape: boolean): string {
	return shouldEscape ? text.replace(/</g, '◄').replace(/>/g, '►') : text;
}

/**
 * Wrap text using code or bold markers.
 *
 * @param text - The text to wrap.
 * @param char - The delimiter character to use, e.g., '`' for code or '**' for bold.
 * @returns The wrapped text.
 */
function wrapCode(text: string, char: string = '`'): string {
	return char + text + char;
}

/**
 * Normalize a default value for display, unwrapping `$bindable(inner)` and removing simple string quotes.
 *
 * @param defaultText - The raw default value text from the source.
 * @returns A cleaned string suitable for display, or undefined if no default.
 */
function normalizeDefaultForDisplay(defaultText: string | undefined): string | undefined {
	if (!defaultText) return undefined;
	const trimmed = defaultText.trim().replace(/;$/, '');
	const bindMatch = /\$bindable\s*\(([\s\S]*)\)\s*/.exec(trimmed);
	const core = bindMatch ? bindMatch[1].trim() : trimmed;
	const str = /^(?:['"`])(.*)(?:['"`])$/.exec(core);
	if (str) return str[1];
	// Collapse newlines/indentation and excess spaces for readable inline display
	return core
		.replace(/\r?\n\s*/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Remove occurrences of the “(required)” hint from inline descriptions to avoid duplication.
 *
 * @param text - The description text possibly containing required hints.
 * @returns The text without required-hint markers.
 */
function stripRequiredHint(text: string): string {
	return text.replace(/\(\s*required\s*\)/gi, '').trim();
}

//#endregion

//#region Rendering

/**
 * Render the `@component` comment block according to settings and extracted data.
 *
 * @param input - Build options including description handling, inherits, and props list.
 * @returns The full multi-line HTML comment string to insert.
 */
function buildComment(input: BuildOptions): string {
	const description = input.addDescription
		? escapeAngle(
				input.existingDescription.trim() || 'no description yet',
				input.escapeAngleBrackets
			)
		: '';

	const inheritsLine =
		input.inherits.length > 0
			? `#### Inherits: ${input.inherits
					.map((t) => wrapCode(escapeAngle(t.trim(), input.escapeAngleBrackets)))
					.join(' & ')}`
			: '';

	const propLines = input.props.map((p) => {
		// No spaces between modifier symbols and name, e.g. '!$ color'
		const requiredMark = p.optional ? '' : '!';
		const bindMark = p.bindable ? '$' : '';
		const modifier = `${requiredMark}${bindMark}`;
		const namePart = `${modifier}${modifier ? ' ' : ''}${p.name}`.trim();
		const typePart = wrapCode(
			escapeAngle(sanitizeInline(p.typeText, false), input.escapeAngleBrackets),
			'**'
		);
		const defaultVal = normalizeDefaultForDisplay(p.defaultText);
		const defaultPart = defaultVal
			? ` = ${wrapCode(escapeAngle(defaultVal, input.escapeAngleBrackets))}`
			: '';
		const desc = p.description
			? ` - ${escapeAngle(sanitizeInline(stripRequiredHint(p.description), false), input.escapeAngleBrackets)}`
			: '';
		return `- ${wrapCode(namePart)} ${typePart}${defaultPart}${desc}`;
	});

	const hasAnyProps = input.props.length > 0 || input.inherits.length > 0;
	const lines: string[] = [START_MARK];

	const descBlock: string[] = [];
	if (input.addDescription) descBlock.push(description || 'no description yet');

	const propsBlock: string[] = [];
	if (hasAnyProps) {
		propsBlock.push('### Props');
		if (inheritsLine) propsBlock.push(inheritsLine);
		propsBlock.push(...propLines);
	}

	if (input.placeDescriptionBeforeProps) {
		lines.push(...descBlock);
		if (descBlock.length > 0 && hasAnyProps) lines.push('');
		lines.push(...propsBlock);
	} else {
		lines.push(...propsBlock);
		if (propsBlock.length > 0 && descBlock.length > 0) lines.push('');
		lines.push(...descBlock);
	}

	lines.push('-->');
	return lines.join('\r\n');
}

/**
 * Insert the new `@component` block, replacing any previous one and placing it before the first TS script.
 *
 * @param source - The original `.svelte` file contents.
 * @param newComment - The freshly rendered `@component` block.
 * @returns The updated source with the comment inserted at the desired location.
 */
function insertOrUpdateComment(source: string, newComment: string): string {
	const headerRe = /<!--\s*@component[\s\S]*?-->\r?\n/i;
	// Match any <script ...> opening tag robustly
	const scriptOpen = /<script\b(?:[^>"']|"[^"]*"|'[^']*')*>/i;

	// Remove any existing @component header by slicing exactly its range
	let body = source;
	const existing = headerRe.exec(body);
	if (existing) {
		const st = body.slice(0, existing.index);
		const en = body.slice(existing.index + existing[0].length);
		body = st + en;
	}

	const openMatch = scriptOpen.exec(body);
	if (openMatch) {
		const idx = openMatch.index;
		return body.slice(0, idx) + newComment + '\r\n' + body.slice(idx);
	}
	return newComment + '\r\n' + body;
}

/**
 * Extract preserved free-form description from an existing `@component` block.
 *
 * If the description is before props, lines before '### Props' are returned. If the description
 * is after props, lines after the prop bullets (accounting for an optional inherits line) up to
 * the closing marker are returned. Only this description region is preserved.
 *
 * @param raw - The raw HTML comment text that begins with `<!-- @component`.
 * @returns The preserved description text (possibly empty) without the closing marker.
 */
function extractDescriptionFromComment(raw: string): string {
	// Ensure we don't carry the comment close marker into the preserved text
	const closeIdx = raw.lastIndexOf('-->');
	const core = (closeIdx !== -1 ? raw.slice(0, closeIdx) : raw).replace(/\r\n/g, '\n');
	const startIdx = core.indexOf(START_MARK);
	const afterStart = startIdx !== -1 ? core.slice(startIdx + START_MARK.length) : core;
	const text = afterStart.replace(/^\n/, '');

	const propsHeader = '\n### Props';
	let propsIdx = text.indexOf(propsHeader);
	if (propsIdx === -1 && text.startsWith('### Props')) propsIdx = 0;
	if (propsIdx === -1)
		// No props header at all; entire body is description
		return text.replace(/<!--[\s\S]*?-->/g, '').trim();

	const before = text.slice(0, propsIdx).trim();
	if (before.length > 0)
		// Description-before-props case
		return before.replace(/<!--[\s\S]*?-->/g, '').trim();

	// Description-after-props case: parse lines after the props header
	const headerLen = propsIdx === 0 ? '### Props'.length : propsHeader.length;
	const after = text.slice(propsIdx + headerLen).split('\n');
	let i = 0;
	// Skip optional whitespace line(s)
	while (i < after.length && after[i].trim() === '') i++;
	// Optional inherits line
	if (i < after.length && /^####\s+Inherits\b/.test(after[i])) i++;
	// Skip prop bullet lines starting with '- '
	while (i < after.length && /^-\s/.test(after[i])) i++;
	// Skip a single blank line after bullets
	if (i < after.length && after[i].trim() === '') i++;
	const desc = after.slice(i).join('\n');
	return desc.replace(/<!--[\s\S]*?-->/g, '').trim();
}

//#endregion
