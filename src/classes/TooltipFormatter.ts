import * as vscode from 'vscode';

import { PropExtractionResult, PropInfo, TooltipFormat, TooltipOrder } from '../types';
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
	 */
	public static displayPropsAsList(
		props: PropInfo[],
		inherits?: string[],
		order: TooltipOrder = 'required'
	): vscode.MarkdownString {
		const md = new vscode.MarkdownString();
		md.isTrusted = true;

		// Show inherited types if any
		if (inherits && inherits.length > 0) {
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
			const typeFormatted = `**${prop.type}**`;
			let line = `- ${emojiPrefix}\`${prop.name}\`: ${typeFormatted}`;

			// Add default value if present
			if (prop.defaultValue) line += ` = \`${prop.defaultValue}\``;

			// Add comment if present
			if (prop.comment) line += `\n  - _${prop.comment}_`;

			md.appendMarkdown(line + '\n');
		}

		return md;
	}

	/**
	 * Displays props in a table format, with badges for required and bindable props.
	 * @param props The list of PropInfo objects
	 * @param inherits Optional list of inherited types/interfaces
	 * @param order The sorting preference
	 */
	public static displayPropsAsTable(
		props: PropInfo[],
		inherits?: string[],
		order: TooltipOrder = 'required'
	): vscode.MarkdownString {
		const md = new vscode.MarkdownString();
		md.isTrusted = true;

		if (inherits && inherits.length > 0) {
			const inheritsList = inherits.map((t) => `\`${t}\``).join(', ');
			md.appendMarkdown(`**Extends:** ${inheritsList}\n\n`);
		}

		// Sort props according to order preference
		const sortedProps = sortProps(props, order);

		// Create table header
		md.appendMarkdown('| Property | Type | Default | Notes |\n');
		md.appendMarkdown('|----------|------|---------|-------|\n');

		for (const prop of sortedProps) {
			const badges: string[] = [];
			if (prop.required) badges.push('⚠️ Required');
			if (prop.bindable) badges.push('🔗 Bindable');

			const name = `\`${prop.name}\``;
			const type = `\`${prop.type}\``;
			const defaultVal = prop.defaultValue ? `\`${prop.defaultValue}\`` : '—';
			const notes = [...badges, prop.comment].filter(Boolean).join('<br>');

			md.appendMarkdown(`| ${name} | ${type} | ${defaultVal} | ${notes} |\n`);
		}

		return md;
	}

	/**
	 * Displays props in a TypeScript-like declaration format.
	 * @param props The list of PropInfo objects
	 * @param inherits Optional list of inherited types/interfaces
	 * @param order The sorting preference
	 */
	public static displayPropsAsTypescript(
		props: PropInfo[],
		inherits?: string[],
		order: TooltipOrder = 'required'
	): vscode.MarkdownString {
		const md = new vscode.MarkdownString();
		md.isTrusted = true;

		if (inherits && inherits.length > 0) {
			const inheritsList = inherits.map((t) => `\`${t}\``).join(', ');
			md.appendMarkdown(`**Extends:** ${inheritsList}\n\n`);
		}

		// Sort props according to order preference
		const sortedProps = sortProps(props, order);

		let details = '```typescript\n';
		for (const prop of sortedProps) {
			if (prop.comment) details += `/** ${prop.comment} */\n`;
			details += `let ${prop.name}${prop.required ? '' : '?'}: ${prop.type}`;
			if (prop.defaultValue) details += ` = ${prop.defaultValue}`;
			details += ';\n';
		}
		details += '```\n';
		md.appendMarkdown(details);

		return md;
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
	 * @returns A MarkdownString for the tooltip
	 */
	public static formatTooltip(
		format: TooltipFormat,
		order: TooltipOrder,
		result: Required<PropExtractionResult>
	): vscode.MarkdownString {
		switch (format) {
			case 'bullet-list':
				return TooltipFormatter.displayPropsAsList(result.props, result.inherits, order);
			case 'table':
				return TooltipFormatter.displayPropsAsTable(result.props, result.inherits, order);
			case 'code-block':
			default:
				return TooltipFormatter.displayPropsAsTypescript(
					result.props,
					result.inherits,
					order
				);
		}
	}
}
