import * as fs from 'node:fs';
import * as vscode from 'vscode';
import { CacheService } from './classes/CacheService';
import { LoggingService } from './classes/LoggingService';
import { TooltipFormatter } from './classes/TooltipFormatter';
import { parsePropsFromScriptBlocks } from './parsers/propParser';

import { getTagNameAtPosition } from './parsers/tagParser';
import { PropExtractionResult } from './types';
import {
	extractImportsFromScriptBlocks,
	extractScriptBlocksFromSvelte,
	extractScriptBlocksFromText
} from './utils/extractor';
import { PathResolver } from './utils/pathResolver';
import { Settings } from './utils/settings';

export function activate(context: vscode.ExtensionContext): void {
	const logger = LoggingService.getInstance();
	logger.logStarted();

	// Initialize cache with expiration setting
	const cache = new CacheService(Settings.getCacheExpirationMinutes());

	// Initialize path resolver with cache and detailed logging setting
	const pathResolver = new PathResolver(
		cache.getPathResolverCache(),
		logger,
		Settings.getDetailedResolverLogging(),
		Settings.getBarrelFileMaxDepth(),
		Settings.getBarrelFileNames()
	);

	//#region Simple Event Listeners

	// Log when Svelte files are opened
	const openDocListener = vscode.workspace.onDidOpenTextDocument((doc) => {
		if (doc.fileName.endsWith('.svelte')) logger.logSvelteFileOpened(doc.fileName);
	});

	// Register configuration change listener: Clear cache and update resolver when settings change
	const configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
		// Check if any sveltedoc setting changed
		if (e.affectsConfiguration('sveltedoc')) {
			cache.clear();
			pathResolver.setDetailedLogging(Settings.getDetailedResolverLogging());
			pathResolver.setMaxBarrelDepth(Settings.getBarrelFileMaxDepth());
			pathResolver.setBarrelFileNames(Settings.getBarrelFileNames());
			logger.logSettingsChanged();
		}
	});

	// Watch for tsconfig.json changes to invalidate path resolver cache
	const tsconfigWatcher = vscode.workspace.createFileSystemWatcher(
		'**/tsconfig.json',
		false,
		false,
		false
	);
	tsconfigWatcher.onDidChange((uri) => {
		pathResolver.invalidateTsconfig(uri.fsPath);
	});
	tsconfigWatcher.onDidCreate((uri) => {
		pathResolver.invalidateTsconfig(uri.fsPath);
	});
	tsconfigWatcher.onDidDelete((uri) => {
		pathResolver.invalidateTsconfig(uri.fsPath);
	});

	// Also watch jsconfig.json for projects that use it instead
	const jsconfigWatcher = vscode.workspace.createFileSystemWatcher(
		'**/jsconfig.json',
		false,
		false,
		false
	);
	jsconfigWatcher.onDidChange((uri) => {
		pathResolver.invalidateTsconfig(uri.fsPath);
	});
	jsconfigWatcher.onDidCreate((uri) => {
		pathResolver.invalidateTsconfig(uri.fsPath);
	});
	jsconfigWatcher.onDidDelete((uri) => {
		pathResolver.invalidateTsconfig(uri.fsPath);
	});

	// Watch for pnpm-workspace.yaml changes to invalidate workspace package cache
	const workspaceWatcher = vscode.workspace.createFileSystemWatcher(
		'**/pnpm-workspace.yaml',
		false,
		false,
		false
	);
	workspaceWatcher.onDidChange((uri) => {
		pathResolver.invalidateWorkspace(uri.fsPath);
	});
	workspaceWatcher.onDidCreate((uri) => {
		pathResolver.invalidateWorkspace(uri.fsPath);
	});
	workspaceWatcher.onDidDelete((uri) => {
		pathResolver.invalidateWorkspace(uri.fsPath);
	});

	//#endregion

	//#region Commands

	// Register command: Clear Cache
	const clearCacheCommand = vscode.commands.registerCommand('sveltedoc.clearCache', () => {
		cache.clear();
		logger.logCacheCleared();
	});

	// Register command: Show Output
	const showOutputCommand = vscode.commands.registerCommand('sveltedoc.showOutput', () => {
		logger.show();
	});

	//#endregion

	const hoverProvider = vscode.languages.registerHoverProvider(
		{ language: 'svelte', scheme: 'file' },
		{
			provideHover(
				document: vscode.TextDocument,
				position: vscode.Position,
				_token: vscode.CancellationToken
			): vscode.ProviderResult<vscode.Hover> {
				try {
					// mark token as used to avoid unused variable lint complaints
					void _token;
					// Only act in .svelte files
					if (!document.fileName.endsWith('.svelte')) return undefined;
					const startTime = performance.now();

					const tag = getTagNameAtPosition(document, position);
					if (!tag) return undefined;

					// Log hover attempt only if different file+tag combination
					if (!cache.isSameHover(document.fileName, tag))
						logger.logHoverAttempt(
							document.fileName,
							position.line,
							position.character
						);

					const result = getPropsForHoveredComponent(document, tag, cache, pathResolver);
					const durationMs = Math.round(performance.now() - startTime);

					if (result.success && result.props) {
						// Log component hover only if different file+tag+path combination
						if (!cache.isSameComponent(document.fileName, tag, result.componentPath))
							logger.logComponentHover(tag, result.componentPath);
						// Update tracked state
						cache.setHover(document.fileName, tag, result.componentPath);
						// Always log extraction timing with cache source
						logger.logPropsExtracted(
							tag,
							result.props.length,
							durationMs,
							result.fromCache ?? false
						);

						// Get settings for formatting
						const format = Settings.getTooltipFormat();
						const order = Settings.getTooltipOrder();

						// Select formatter based on setting
						const md: vscode.MarkdownString = TooltipFormatter.formatTooltip(
							format,
							order,
							result as Required<PropExtractionResult>
						);
						return new vscode.Hover(md);
					}
					// Log component hover only if different file+tag+path combination
					if (!cache.isSameComponent(document.fileName, tag, result.componentPath)) {
						logger.logComponentHover(tag, result.componentPath);
						logger.logPropsExtractionFailed(
							tag,
							result.failureReason ?? 'Unknown reason'
						);
					}
					// Update tracked state
					cache.setHover(document.fileName, tag, result.componentPath);

					const md = TooltipFormatter.noPropsFound(
						tag,
						result.componentPath,
						result.failureReason
					);
					return new vscode.Hover(md);
				} catch (error) {
					logger.logError(error as Error, 'HoverProvider');
					return undefined;
				}
			}
		}
	);

	context.subscriptions.push(
		openDocListener,
		hoverProvider,
		clearCacheCommand,
		showOutputCommand,
		configChangeListener,
		tsconfigWatcher,
		jsconfigWatcher,
		workspaceWatcher
	);
}

export function deactivate(): void {
	LoggingService.getInstance().dispose();
}

/**
 * Extract props for the component hovered over in the given document at the specified tag.
 * @param document The VSCode text document
 * @param tagName The component tag name at the hover location
 * @param cache Optional CacheService instance for caching results
 * @param pathResolver Optional PathResolver instance for resolving import paths
 * @returns The prop extraction result
 */
export function getPropsForHoveredComponent(
	document: vscode.TextDocument,
	tagName: string,
	cache?: CacheService,
	pathResolver?: PathResolver
): PropExtractionResult {
	// 1) Extract imports from current document text
	const docText = document.getText();
	const pageBlocks = extractScriptBlocksFromText(docText);
	const importMap = extractImportsFromScriptBlocks(pageBlocks);
	const spec = importMap.get(tagName);
	if (!spec)
		return { success: false, failureReason: 'No import found for component', fromCache: false };

	// 2) Resolve to absolute file path (with path alias and workspace package support)
	const compPath = pathResolver?.resolve(document.fileName, spec, tagName);
	if (!compPath)
		return {
			success: false,
			componentPath: spec,
			failureReason: 'Could not resolve import path',
			fromCache: false
		};

	// 3) Check cache if available
	if (cache) {
		const cached = cache.get(compPath);
		if (cached)
			// Return cached result with fromCache flag
			return { ...cached, fromCache: true };
	}

	// 4) Read component file and extract script blocks
	if (!fs.existsSync(compPath))
		return {
			success: false,
			componentPath: compPath,
			failureReason: 'Component file does not exist',
			fromCache: false
		};

	const blocks = extractScriptBlocksFromSvelte(compPath);

	// 5) Get normalization settings
	const normaliseComment = Settings.getNormaliseComment();
	const normaliseType = Settings.getNormaliseType();
	const normaliseDefaultValue = Settings.getNormaliseDefaultValue();
	const fallbackTypes = Settings.getFallbackTypes();

	// 6) Parse props using heuristic runes-mode parser
	const result = parsePropsFromScriptBlocks(
		blocks,
		normaliseComment,
		normaliseType,
		normaliseDefaultValue,
		fallbackTypes
	);
	if (!result.props.length) {
		const failureResult: PropExtractionResult = {
			success: false,
			componentPath: compPath,
			failureReason: 'No $props() found',
			fromCache: false
		};
		return failureResult;
	}

	const successResult: PropExtractionResult = {
		success: true,
		props: result.props,
		inherits: result.inherits,
		componentPath: compPath,
		fromCache: false
	};

	// 7) Store in cache if available (only cache successful extractions)
	if (cache) cache.set(compPath, successResult);

	return successResult;
}
