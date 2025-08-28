import path from 'node:path';
import {
	escapeRegExp,
	scanToTopLevelSemicolon,
	splitOnce,
	splitTopLevel,
	wildcardToRegex
} from './core';
import type { BuildOptions, ExtractResult, ProcessOptions, PropDoc } from './types';

const START_MARK = '<!-- @component';

/** Process a Svelte component document and produce an updated version with a fresh @component block. */
export function processSvelteDoc(
	source: string,
	filePath: string,
	options: ProcessOptions
): { updated: string; changed: boolean; log: string[] } {
	const log: string[] = [];
	const {
		scripts,
		leadingComment,
		preservedTail
	}: {
		scripts: string[];
		leadingComment?: { raw: string; description: string };
		preservedTail?: string;
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
		props: extract.props,
		preservedTail
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

/** Extracts TS <script> contents and an existing leading @component comment if present. */
function extractScriptsAndLeadingComment(source: string): {
	scripts: string[];
	leadingComment?: { raw: string; description: string };
	preservedTail?: string;
} {
	const scripts: string[] = [];
	const scriptRegex = /<script\s+[^>]*lang\s*=\s*["']ts["'][^>]*>([\s\S]*?)<\/script>/gi;
	let m: RegExpExecArray | null;
	while ((m = scriptRegex.exec(source)) !== null) scripts.push(m[1]);

	// Head before first TS script
	const firstScriptIdx = source.search(/<script\s+[^>]*lang\s*=\s*["']ts["'][^>]*>/i);
	const head = firstScriptIdx === -1 ? source : source.slice(0, firstScriptIdx);
	let leadingComment: { raw: string; description: string } | undefined;
	let preservedTail: string | undefined;
	const compMatch = /<!--\s*@component[\s\S]*?-->\s*$/i.exec(head.trimStart());
	if (compMatch) {
		const raw = compMatch[0];
		const description = extractDescriptionFromComment(raw);
		leadingComment = { raw, description };
		preservedTail = extractTailAfterDashLine(raw);
	}
	return { scripts, leadingComment, preservedTail };
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

	// Resolve type alias block
	let typeBlock = typeName ? findTypeAliasBlock(tsCode, typeName) : undefined;
	if (!typeBlock) {
		const regexes = patterns.map((p) => wildcardToRegex(p));
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
	}
	if (!typeBlock && typeName) result.debug.push(`Type alias not found for: ${typeName}`);

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
function sanitizeInline(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/** Escape angle brackets in plain text (not code spans). */
function escapeAngle(text: string): string {
	return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
			? `#### Inherits: ${input.inherits.map((t) => wrapCode(t.trim())).join(' & ')}`
			: '';

	const propLines = input.props.map((p) => {
		const requiredMark = p.optional ? '' : '! ';
		const bindMark = p.bindable ? '$ ' : '';
		const namePart = `${requiredMark}${bindMark}${p.name}`.trimStart();
		const typePart = wrapCode(sanitizeInline(p.typeText), '**');
		const defaultVal = normalizeDefaultForDisplay(p.defaultText);
		const defaultPart = defaultVal ? ` = ${wrapCode(defaultVal)}` : '';
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

	// Append preserved tail, if any, after a --- delimiter
	if (input.preservedTail && input.preservedTail.trim().length > 0) {
		if (lines[lines.length - 1] !== '---') lines.push('---');
		lines.push(input.preservedTail.trim());
	}

	lines.push('-->');
	return lines.join('\n');
}

/** Insert the new @component block, replacing any previous one and placing it before the first TS script. */
function insertOrUpdateComment(source: string, newComment: string): string {
	const headerRe = /<!--\s*@component[\s\S]*?-->/i;
	const scriptOpen = /<script\s+[^>]*lang\s*=\s*["']ts["'][^>]*>/i;
	const lm = /^(\uFEFF)?\s*/.exec(source);
	const leadingWs = lm ? lm[0] : '';

	// Remove any existing @component header
	const body = source.replace(headerRe, '').trimStart();

	const firstScriptIdx = body.search(scriptOpen);
	if (firstScriptIdx !== -1) {
		const before = body.slice(0, firstScriptIdx);
		const after = body.slice(firstScriptIdx);
		return `${leadingWs}${before}${newComment}\n${after}`;
	}
	return `${leadingWs}${newComment}\n${body}`;
}

/** Extract preserved description between ## Title and ### Props (or ---). */
function extractDescriptionFromComment(raw: string): string {
	let idx = raw.indexOf('\n## ');
	if (idx === -1) idx = raw.indexOf('## ');
	if (idx === -1) return '';
	const headerLineEnd = raw.indexOf('\n', idx + 1);
	if (headerLineEnd === -1) return '';
	const afterHeader = raw.slice(headerLineEnd + 1);
	const propsIdx = afterHeader.indexOf('\n### Props');
	const propsOrEndIdx = propsIdx === -1 ? afterHeader.indexOf('\n---') : propsIdx;
	const section = propsOrEndIdx === -1 ? afterHeader : afterHeader.slice(0, propsOrEndIdx);
	const cleaned = section.replace(/^\s+|\s+$/g, '').replace(/<!--[\s\S]*?-->/g, '');
	return cleaned.trim();
}

/** Extract any preserved tail content following a --- line inside the comment. */
function extractTailAfterDashLine(raw: string): string | undefined {
	const idx = raw.indexOf('\n---');
	if (idx === -1) return undefined;
	const after = raw.slice(idx + 4);
	const closeIdx = after.lastIndexOf('-->');
	const core = closeIdx === -1 ? after : after.slice(0, closeIdx);
	return core.replace(/^\s+|\s+$/g, '');
}
