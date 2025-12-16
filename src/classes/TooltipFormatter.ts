import * as vscode from 'vscode';

import {
	FormatSettings,
	PropExtractionResult,
	PropInfo,
	TooltipFormat,
	TooltipOrder
} from '../types';
import { t } from '../utils/localization';
import { sortProps } from '../utils/propSorting';

/**
 * Formats component information into a VS Code Hover tooltip.
 */
export class TooltipFormatter {
	//#region Display methods

	/**
	 * Displays props in a simple bullet list format, with comments being indented below each prop.
	 * @param props The list of PropInfo objects
	 * @param inherits Optional list of inherited types/interfaces
	 * @param order The sorting preference
	 * @param settings Visibility settings for tooltip formatting
	 */
	private static displayPropsAsList(
		props: PropInfo[],
		inherits: string[] | undefined,
		order: TooltipOrder,
		settings: FormatSettings
	): vscode.MarkdownString {
		const md = new vscode.MarkdownString();
		md.isTrusted = true;

		// Show inherited types if any and setting enabled
		if (settings.showInheritance && inherits && inherits.length > 0) {
			const inheritsList = inherits.map((t) => `\`${t}\``).join(', ');
			md.appendMarkdown(`**Extends:** ${inheritsList}\n\n`);
		}

		// Sort props according to order preference
		const sortedProps = sortProps(props, order);

		// Format each prop as a bullet point
		for (const prop of sortedProps) {
			const emojis: string[] = [];
			if (prop.required) emojis.push('⚠️');
			if (prop.bindable) emojis.push('🔗');

			const emojiPrefix = emojis.length > 0 ? emojis.join(' ') + ' ' : '';
			const typeFormatted = settings.showTypes ? `**${prop.type}**` : '';
			let line = `- ${emojiPrefix}\`${prop.name}\``;

			// Add type if enabled
			if (settings.showTypes && typeFormatted) line += `: ${typeFormatted}`;

			// Add default value if present and enabled
			if (settings.showDefaults && prop.defaultValue) line += ` = \`${prop.defaultValue}\``;

			// Add comment if present and enabled
			if (settings.showComments && prop.comment) line += `\n  - _${prop.comment}_`;

			md.appendMarkdown(line + '\n');
		}

		return md;
	}

	/**
	 * Displays props in a table format, with badges for required and bindable props.
	 * @param props The list of PropInfo objects
	 * @param inherits Optional list of inherited types/interfaces
	 * @param order The sorting preference
	 * @param settings Visibility settings for tooltip formatting
	 */
	private static displayPropsAsTable(
		props: PropInfo[],
		inherits: string[] | undefined,
		order: TooltipOrder,
		settings: FormatSettings
	): vscode.MarkdownString {
		const md = new vscode.MarkdownString();
		md.isTrusted = true;

		if (settings.showInheritance && inherits && inherits.length > 0) {
			const inheritsList = inherits.map((t) => `\`${t}\``).join(', ');
			md.appendMarkdown(`**Extends:** ${inheritsList}\n\n`);
		}

		// Sort props according to order preference
		const sortedProps = sortProps(props, order);

		// Build table header dynamically based on enabled columns
		const headers: string[] = ['Property'];
		if (settings.showTypes) headers.push('Type');
		if (settings.showDefaults) headers.push('Default');
		if (settings.showComments) headers.push('Notes');

		// If only Property column, show minimal table
		if (headers.length === 1) {
			md.appendMarkdown('| Property |\n');
			md.appendMarkdown('|----------|\n');
		} else {
			md.appendMarkdown(`| ${headers.join(' | ')} |\n`);
			md.appendMarkdown(`|${headers.map(() => '-------').join('|')}|\n`);
		}

		for (const prop of sortedProps) {
			const badges: string[] = [];
			if (prop.required) badges.push('⚠️ Required');
			if (prop.bindable) badges.push('🔗 Bindable');

			const cells: string[] = [`\`${prop.name}\``];
			if (settings.showTypes) cells.push(`\`${prop.type}\``);
			if (settings.showDefaults)
				cells.push(prop.defaultValue ? `\`${prop.defaultValue}\`` : '—');

			// Build notes column: badges + comment
			if (settings.showComments) {
				const notesParts: string[] = [...badges];
				if (prop.comment) notesParts.push(prop.comment);
				const notes = notesParts.join('<br>');
				cells.push(notes || '—');
			}

			md.appendMarkdown(`| ${cells.join(' | ')} |\n`);
		}

		return md;
	}

	/**
	 * Displays props in a TypeScript-like declaration format.
	 * @param props The list of PropInfo objects
	 * @param inherits Optional list of inherited types/interfaces
	 * @param order The sorting preference
	 * @param settings Visibility settings for tooltip formatting
	 */
	private static displayPropsAsTypescript(
		props: PropInfo[],
		inherits: string[] | undefined,
		order: TooltipOrder,
		settings: FormatSettings
	): vscode.MarkdownString {
		const md = new vscode.MarkdownString();
		md.isTrusted = true;

		if (settings.showInheritance && inherits && inherits.length > 0) {
			const inheritsList = inherits.map((t) => `\`${t}\``).join(', ');
			md.appendMarkdown(`**Extends:** ${inheritsList}\n\n`);
		}

		// Sort props according to order preference
		const sortedProps = sortProps(props, order);

		let details = '```typescript\n';
		for (const prop of sortedProps) {
			if (settings.showComments && prop.comment)
				details += `/** ${prop.required ? `⚠️ ${t('tooltip.general.required')}:` : ''} ${prop.comment} */\n`;
			else if (settings.showComments && !prop.comment && prop.required)
				details += `/** ⚠️ ${t('tooltip.general.required')} */\n`;

			details += `let ${prop.name}`;

			// Show type with optional marker if enabled
			if (settings.showTypes) details += `${prop.required ? '' : '?'}: ${prop.type}`;

			// Add default value if enabled and present
			if (settings.showDefaults && prop.defaultValue)
				details += TooltipFormatter.showBindable(prop.defaultValue, prop.bindable);

			// When types and comments are hidden, add '// required' comment if prop is required
			details +=
				!settings.showTypes && prop.required && !settings.showComments
					? '; // required'
					: ';';
			details += '\n';
		}
		details += '```\n';
		md.appendMarkdown(details);

		return md;
	}

	private static showBindable(defaultValue: string, bindable: boolean): string {
		let str = ' = ';
		if (bindable) str += '$bindable(';
		str += defaultValue;
		if (bindable) str += ')';
		return str;
	}

	//#endregion

	/**
	 * Create a tooltip for a component that was detected but had no props or couldn't be resolved.
	 * @param tagName The component tag name
	 * @param componentPath The resolved component file path, if any
	 * @param failureReason The reason for failure, if any
	 */
	public static noPropsFound(
		tagName: string,
		componentPath?: string,
		failureReason?: string
	): vscode.MarkdownString {
		const md = new vscode.MarkdownString();
		md.isTrusted = true;
		let tooltipText = t('tooltip.success.componentDetected', tagName) + '\n\n';
		tooltipText +=
			t('tooltip.success.propsPath', componentPath ?? t('tooltip.error.notResolved')) +
			'\n\n---\n\n';

		// Check if this is the special "No $props() found" case
		if (failureReason === 'No $props() found') {
			tooltipText += '### ' + t('tooltip.error.noPropsFound') + '\n\n';
			tooltipText += t('tooltip.example.propsDestructuring');
		} else {
			tooltipText += t('tooltip.error.noPropsFoundOrNotResolved');
		}

		md.appendMarkdown(tooltipText);

		return md;
	}

	/**
	 * Format the tooltip based on user settings.
	 * @param format The tooltip format setting
	 * @param order The tooltip order setting
	 * @param result The prop extraction result
	 * @param settings Visibility settings for tooltip formatting
	 * @returns A MarkdownString for the tooltip
	 */
	public static formatTooltip(
		format: TooltipFormat,
		order: TooltipOrder,
		result: Required<PropExtractionResult>,
		settings: FormatSettings
	): vscode.MarkdownString {
		switch (format) {
			case 'bullet-list':
				return TooltipFormatter.displayPropsAsList(
					result.props,
					result.inherits,
					order,
					settings
				);
			case 'table':
				return TooltipFormatter.displayPropsAsTable(
					result.props,
					result.inherits,
					order,
					settings
				);
			case 'code-block':
			default:
				return TooltipFormatter.displayPropsAsTypescript(
					result.props,
					result.inherits,
					order,
					settings
				);
		}
	}
}
