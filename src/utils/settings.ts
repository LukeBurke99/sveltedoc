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

	/**
	 * Get fallback type mappings for unknown property types.
	 * Validates that all keys and values are non-empty strings.
	 */
	public static getFallbackTypes(): Record<string, string> {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		const value = config.get<Record<string, string>>('fallbackTypes', {
			children: 'Snippet',
			class: 'string'
		});

		// Validate: ensure object with non-empty string keys and values
		if (typeof value !== 'object' || Array.isArray(value))
			return { children: 'Snippet', class: 'string' };

		const validated: Record<string, string> = {};
		for (const [key, val] of Object.entries(value))
			if (
				typeof key === 'string' &&
				key.trim() !== '' &&
				typeof val === 'string' &&
				val.trim() !== ''
			)
				validated[key] = val;

		return validated;
	}

	/**
	 * Get maximum depth for barrel file resolution.
	 * Enforces bounds: minimum 0, maximum 10.
	 */
	public static getBarrelFileMaxDepth(): number {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		const value = config.get<number>('barrelFileMaxDepth', 3);
		// Enforce bounds: 0-10
		return Math.max(0, Math.min(10, value));
	}

	/**
	 * Get list of file names to treat as barrel files.
	 * Validates that all entries are non-empty strings.
	 */
	public static getBarrelFileNames(): string[] {
		const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
		const value = config.get<string[]>('barrelFileNames', ['index', 'main']);

		// Validate: ensure array with non-empty string values
		if (!Array.isArray(value)) return ['index', 'main'];

		const validated = value.filter((name) => typeof name === 'string' && name.trim() !== '');

		// Return default if no valid names
		return validated.length > 0 ? validated : ['index', 'main'];
	}
}
