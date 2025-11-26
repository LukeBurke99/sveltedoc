import * as vscode from 'vscode';
import { TooltipFormat, TooltipOrder } from '../types';

/**
 * Centralized settings access with validation and defaults.
 */
export class Settings {
	private static readonly CONFIG_SECTION: string = 'sveltedoc';

	/**
	 * Get the cache expiration time in minutes.
	 */
	public static getCacheExpirationMinutes(): number {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		const value = config.get<number>('cacheExpirationMinutes', 30);
		return Math.max(1, value); // Enforce minimum of 1
	}

	/**
	 * Get whether to normalize JSDoc comments (remove duplicate whitespace/newlines).
	 */
	public static getNormaliseComment(): boolean {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<boolean>('normaliseComment', false);
	}

	/**
	 * Get whether to normalize type definitions (remove duplicate whitespace/newlines).
	 */
	public static getNormaliseType(): boolean {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<boolean>('normaliseType', true);
	}

	/**
	 * Get whether to normalize default values (remove duplicate whitespace/newlines).
	 */
	public static getNormaliseDefaultValue(): boolean {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<boolean>('normaliseDefaultValue', true);
	}

	/**
	 * Get the tooltip ordering preference with validation.
	 */
	public static getTooltipOrder(): TooltipOrder {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		const value = config.get<string>('tooltipOrder', 'required');
		const validOrders: TooltipOrder[] = ['normal', 'alphabetical', 'required', 'type'];

		if (validOrders.includes(value as TooltipOrder)) return value as TooltipOrder;

		// Invalid value, return default
		return 'required';
	}

	/**
	 * Get the tooltip format preference with validation.
	 */
	public static getTooltipFormat(): TooltipFormat {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		const value = config.get<string>('tooltipFormat', 'code-block');
		const validFormats: TooltipFormat[] = ['bullet-list', 'table', 'code-block'];

		if (validFormats.includes(value as TooltipFormat)) return value as TooltipFormat;

		// Invalid value, return default
		return 'code-block';
	}

	/**
	 * Get whether to enable detailed resolver logging (for debugging path resolution).
	 */
	public static getDetailedResolverLogging(): boolean {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		return config.get<boolean>('detailedResolverLogging', true);
	}
}
