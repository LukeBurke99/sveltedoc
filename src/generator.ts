import path from 'node:path';
import {
	escapeRegExp,
	scanToTopLevelSemicolon,
	splitOnce,
	splitTopLevel,
	wildcardToRegex
} from './core.js';
import type { BuildOptions, ExtractResult, ProcessOptions, PropDoc } from './types.js';

const START_MARK = '<!-- @component';

/** Process a Svelte component document and produce an updated version with a fresh @component block. */
export function processSvelteDoc(
	source: string,
	filePath: string,
	options: ProcessOptions
): { updated: string; changed: boolean; log: string[] } {
	const log: string[] = [];
	// Skip if there is no <script> tag at all
	if (!/<script\b/i.test(source)) {
		log.push('No <script> tag found — skipping doc block');
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
	if (
		!options.addTitleAndDescription &&
		extract.props.length === 0 &&
		extract.inherits.length === 0
	) {
		log.push('No props/inherits and title/description disabled — skipping doc block');
		return { updated: source, changed: false, log };
	}

	const newComment = buildComment({
		addTitleAndDescription: options.addTitleAndDescription,
		placeTitleBeforeProps: options.placeTitleBeforeProps,
		filePath,
		existingDescription: leadingComment?.description ?? '',
		inherits: extract.inherits,
		props: extract.props
	});

	const updated = insertOrUpdateComment(source, newComment);
	console.log('Updated comment:', updated);
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

/** Extracts TS <script> contents and an existing leading @component comment if present. */
function extractScriptsAndLeadingComment(source: string): {
	scripts: string[];
	leadingComment?: { raw: string; description: string };
} {
	const scripts: string[] = [];
	const scriptRegex = /<script\s+[^>]*lang\s*=\s*["']ts["'][^>]*>([\s\S]*?)<\/script>/gi;
	let m: RegExpExecArray | null;
	while ((m = scriptRegex.exec(source)) !== null) scripts.push(m[1]);

	// Head before first TS script
	const firstScriptIdx = source.search(/<script\s+[^>]*lang\s*=\s*["']ts["'][^>]*>/i);
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

/** Parse concatenated TS code to extract props and inherits. */
function extractDocsFromTS(tsCode: string, patterns: string[]): ExtractResult {
	const result: ExtractResult = {
		inferredTypeName: undefined,
		props: [],
		inherits: [],
		hasRest: false,
		debug: []
	};

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
				const def = defaultRhs.trim();
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

/** Locate the RHS for a named type alias, allowing optional generics. */
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

/** Find an interface declaration and return its members text and extends list. */
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

/** Parse property signatures from an object type literal's members text. */
function parseTypeMembers(
	membersText: string
): { name: string; typeText: string; optional: boolean; description?: string }[] {
	const members: { name: string; typeText: string; optional: boolean; description?: string }[] =
		[];
	const propRe = /(\/\*\*[\s\S]*?\*\/)??\s*([A-Za-z_][\w]*)\s*(\?)?\s*:\s*([^;]+);/g;
	let m: RegExpExecArray | null;
	while ((m = propRe.exec(membersText)) !== null) {
		const jsdoc = m[1] ? m[1] : undefined;
		const name = m[2];
		const optional = Boolean(m[3]);
		const typeText = m[4].trim();
		const description = jsdoc ? extractJsDocSummary(jsdoc) : undefined;
		members.push({ name, typeText, optional, description });
	}
	return members;
}

/** Reduce a JSDoc block to a single-line summary. */
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

/** Collapse whitespace in inline sections (bullets). */
function sanitizeInline(text: string, replaceApos: boolean = true): string {
	const r = text.replace(/\s+/g, ' ');
	return replaceApos ? r.replace(/'/g, '&apos;').trim() : r.trim();
}

/** Escape angle brackets in plain text (not code spans). */
function escapeAngle(text: string): string {
	return text.replace(/</g, '◄').replace(/>/g, '►');
}

/** Wrap text using code or bold markers. */
function wrapCode(text: string, char: string = '`'): string {
	return char + text + char;
}

/** Normalize a default value for display, unwrapping $bindable(inner) and simple strings. */
function normalizeDefaultForDisplay(defaultText: string | undefined): string | undefined {
	if (!defaultText) return undefined;
	const trimmed = defaultText.trim().replace(/;$/, '');
	const bindMatch = /\$bindable\s*\(([\s\S]*)\)\s*/.exec(trimmed);
	const core = bindMatch ? bindMatch[1].trim() : trimmed;
	const str = /^(?:['"`])(.*)(?:['"`])$/.exec(core);
	return str ? str[1] : core;
}

/** Remove (required) hints from inline descriptions to avoid duplication. */
function stripRequiredHint(text: string): string {
	return text.replace(/\(\s*required\s*\)/gi, '').trim();
}

/** Render the @component block according to settings and extracted data. */
function buildComment(input: BuildOptions): string {
	const fileName = path.basename(input.filePath);
	const title = fileName.replace(/\.svelte$/i, '');
	const description = input.addTitleAndDescription
		? escapeAngle(input.existingDescription.trim() || 'no description yet')
		: '';

	const inheritsLine =
		input.inherits.length > 0
			? `#### Inherits: ${input.inherits
					.map((t) => wrapCode(escapeAngle(t.trim())))
					.join(' & ')}`
			: '';

	const propLines = input.props.map((p) => {
		// No spaces between modifier symbols and name, e.g. '!$ color'
		const requiredMark = p.optional ? '' : '!';
		const bindMark = p.bindable ? '$' : '';
		const modifier = `${requiredMark}${bindMark}`;
		const namePart = `${modifier}${modifier ? ' ' : ''}${p.name}`.trim();
		const typePart = wrapCode(escapeAngle(sanitizeInline(p.typeText, false)), '**');
		const defaultVal = normalizeDefaultForDisplay(p.defaultText);
		const defaultPart = defaultVal ? ` = ${wrapCode(escapeAngle(defaultVal))}` : '';
		const desc = p.description ? ` — ${sanitizeInline(stripRequiredHint(p.description))}` : '';
		return `- ${wrapCode(namePart)} ${typePart}${defaultPart}${desc}`;
	});

	const hasAnyProps = input.props.length > 0 || input.inherits.length > 0;
	const lines: string[] = [START_MARK];

	const titleBlock: string[] = [];
	if (input.addTitleAndDescription) {
		titleBlock.push(`## ${title}`);
		titleBlock.push(description || 'no description yet');
	}

	const propsBlock: string[] = [];
	if (hasAnyProps) {
		propsBlock.push('### Props');
		if (inheritsLine) propsBlock.push(inheritsLine);
		propsBlock.push(...propLines);
	}

	if (input.placeTitleBeforeProps) {
		lines.push(...titleBlock);
		if (titleBlock.length > 0 && hasAnyProps) lines.push('');
		lines.push(...propsBlock);
	} else {
		lines.push(...propsBlock);
		if (propsBlock.length > 0 && titleBlock.length > 0) lines.push('');
		lines.push(...titleBlock);
	}

	lines.push('-->');
	return lines.join('\r\n');
}

/** Insert the new @component block, replacing any previous one and placing it before the first TS script. */
function insertOrUpdateComment(source: string, newComment: string): string {
	const headerRe = /<!--\s*@component[\s\S]*?-->\r\n/i;
	const scriptOpen = /<script\s+[^>]*lang\s*=\s*["']ts["'][^>]*>/i;

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

/** Extract preserved description text under the title. If title/description are
 *  before props, keep lines between '## Title' and next '### Props'. If title/description
 *  are after props, keep lines from '## Title' to the closing '-->'. Regardless of
 *  placement, only this description region is preserved; content elsewhere is regenerated. */
function extractDescriptionFromComment(raw: string): string {
	// Ensure we don't carry the comment close marker into the preserved text
	const closeIdx = raw.lastIndexOf('-->');
	const rawCore = closeIdx !== -1 ? raw.slice(0, closeIdx) : raw;
	let idx = rawCore.indexOf('\n## ');
	if (idx === -1) idx = rawCore.indexOf('## ');
	if (idx === -1) return '';
	const headerLineEnd = rawCore.indexOf('\n', idx + 1);
	if (headerLineEnd === -1) return '';
	const afterHeader = rawCore.slice(headerLineEnd + 1);
	const propsIdx = afterHeader.indexOf('\n### Props');
	const section = propsIdx === -1 ? afterHeader : afterHeader.slice(0, propsIdx);
	const cleaned = section.replace(/^\s+|\s+$/g, '').replace(/<!--[\s\S]*?-->/g, '');
	return cleaned.trim();
}
