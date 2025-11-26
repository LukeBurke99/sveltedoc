import * as vscode from 'vscode';
import { t } from '../utils/localization';

/**
 * Lightweight (Singleton) logging service for SvelteDoc diagnostics.
 * Logs to a dedicated OUTPUT channel in VS Code.
 */
export class LoggingService {
	private static instance: LoggingService | undefined;
	private outputChannel: vscode.OutputChannel;

	private constructor() {
		this.outputChannel = vscode.window.createOutputChannel('SvelteDoc');
	}

	public static getInstance(): LoggingService {
		LoggingService.instance ??= new LoggingService();
		return LoggingService.instance;
	}

	private log(message: string): void {
		const timestamp = new Date().toISOString();
		this.outputChannel.appendLine(`[${timestamp}] ${message}`);
	}

	//#region Public Logging Methods

	/** Log that the extension has started */
	public logStarted(): void {
		this.log(t('extension.log.started'));
	}

	/**
	 * Log that a Svelte file was opened
	 * @param filePath The path of the opened Svelte file
	 */
	public logSvelteFileOpened(filePath: string): void {
		this.log(t('tooltip.log.fileOpened', filePath));
	}

	/**
	 * Log a hover attempt at a specific file and position
	 * @param filePath The file path where the hover was attempted
	 * @param line The line number (0-based)
	 * @param character The character position (0-based)
	 */
	public logHoverAttempt(filePath: string, line: number, character: number): void {
		this.log(t('tooltip.log.hoverAttempt', filePath, line + 1, character + 1));
	}

	/**
	 * Log that a component was detected on hover
	 * @param tagName The tag name of the component
	 * @param componentPath Optional resolved file path of the component
	 */
	public logComponentHover(tagName: string, componentPath?: string): void {
		this.log(
			t('tooltip.log.componentDetected', tagName) +
				' → ' +
				(componentPath ?? t('tooltip.log.unresolvedPath'))
		);
	}

	/**
	 * Log the result of prop extraction
	 * @param tagName The component tag name
	 * @param count Number of props extracted
	 * @param durationMs Time taken for extraction in milliseconds
	 * @param fromCache Whether the result was from cache
	 */
	public logPropsExtracted(
		tagName: string,
		count: number,
		durationMs: number,
		fromCache: boolean
	): void {
		const source = fromCache ? t('tooltip.general.cache') : t('tooltip.general.fresh');
		this.log(t('tooltip.log.extractedProps', count, tagName, source, durationMs));
	}

	/**
	 * Log a failed prop extraction attempt
	 * @param tagName The component tag name
	 * @param reason The reason for failure
	 */
	public logPropsExtractionFailed(tagName: string, reason: string): void {
		this.log(t('tooltip.log.failedToExtractProps', tagName, reason));
	}

	/**
	 * Log that the cache was cleared
	 */
	public logCacheCleared(): void {
		this.log(t('tooltip.log.cacheCleared'));
	}

	/**
	 * Log that settings changed and cache was cleared
	 */
	public logSettingsChanged(): void {
		this.log(t('tooltip.log.settingsChanged'));
	}

	/**
	 * Log a path resolver message (for detailed resolution debugging)
	 * @param message The resolver message to log
	 */
	public logResolverMessage(message: string): void {
		this.log(message);
	}

	/**
	 * Log an error with optional context
	 * @param error The error object
	 * @param context Optional context string
	 */
	public logError(error: Error, context?: string): void {
		const prefix = context ? `[${context}] ` : '';
		this.log(`🛑 ERROR: ${prefix}${error.message}`);
		if (error.stack) this.log(`Stack: ${error.stack}`);
	}

	//#endregion

	/** Show (focus) the output channel */
	public show(): void {
		this.outputChannel.show(true);
	}

	/** Dispose the output channel */
	public dispose(): void {
		this.outputChannel.dispose();
	}
}
