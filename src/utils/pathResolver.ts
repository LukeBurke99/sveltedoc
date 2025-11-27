import { createPathsMatcher } from 'get-tsconfig';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { LoggingService } from '../classes/LoggingService';
import { PathResolverCache } from '../classes/caches/PathResolverCache';
import type { BarrelResolutionResult, WorkspacePackage } from '../types';
import { t } from './localization';

/**
 * Resolves import specifiers to absolute file paths using tsconfig.json path mappings.
 * Supports SvelteKit's $lib alias and custom tsconfig paths.
 */
export class PathResolver {
	private cache: PathResolverCache;
	private logger: LoggingService;
	private detailedLogging: boolean;

	public constructor(
		cache: PathResolverCache,
		logger: LoggingService,
		detailedLogging: boolean = true
	) {
		this.cache = cache;
		this.logger = logger;
		this.detailedLogging = detailedLogging;
	}

	/**
	 * Resolve a non-relative import specifier to an absolute file path.
	 * Uses tsconfig.json path mappings to resolve aliases like $lib or @components.
	 * @param specifier The import specifier (e.g., '$lib/Button.svelte')
	 * @param fromFile Absolute path of the file containing the import
	 * @returns Absolute path to the resolved file, or undefined if not found
	 */
	public resolveAlias(specifier: string, fromFile: string): string | undefined {
		if (this.detailedLogging)
			this.logger.logResolverMessage(
				t('resolver.log.attemptingResolve', specifier, path.basename(fromFile))
			);

		// Get tsconfig from cache or load it
		const fromDirectory = path.dirname(fromFile);
		const tsconfig = this.cache.getTsconfig(fromDirectory);

		if (!tsconfig) {
			if (this.detailedLogging)
				this.logger.logResolverMessage(t('resolver.log.tsconfigNotFound'));
			return undefined;
		}

		if (this.detailedLogging)
			this.logger.logResolverMessage(t('resolver.log.tsconfigFound', tsconfig.path));

		// Check if paths are configured
		const paths = tsconfig.config.compilerOptions?.paths;
		if (!paths || Object.keys(paths).length === 0) {
			if (this.detailedLogging)
				this.logger.logResolverMessage(t('resolver.log.noPathsConfigured'));
			return undefined;
		}

		if (this.detailedLogging)
			this.logger.logResolverMessage(
				t('resolver.log.pathsConfigured', JSON.stringify(paths))
			);

		// Create matcher for this tsconfig
		const matcher = createPathsMatcher(tsconfig);
		if (!matcher) {
			if (this.detailedLogging)
				this.logger.logResolverMessage(t('resolver.log.noPatternMatch'));
			return undefined;
		}

		// Try to match the specifier against tsconfig paths
		const matchedPaths = matcher(specifier);
		if (matchedPaths.length === 0) {
			if (this.detailedLogging)
				this.logger.logResolverMessage(t('resolver.log.noPatternMatch'));
			return undefined;
		}

		// Find which pattern was matched for logging
		if (this.detailedLogging) {
			const matchedPattern = this.findMatchedPattern(specifier, paths);
			if (matchedPattern)
				this.logger.logResolverMessage(
					t(
						'resolver.log.matchedPattern',
						matchedPattern.pattern,
						matchedPattern.replacement
					)
				);
		}

		// Try each matched path with various extensions
		return this.tryPathWithExtensions(matchedPaths);
	}

	/**
	 * Resolve a relative import specifier to an absolute file path.
	 * Handles ./ and ../ style imports with extension fallback.
	 * @param fromFile Absolute path of the file containing the import
	 * @param specifier Module specifier string from the import statement
	 * @returns Resolved absolute file path or undefined if not found
	 */
	public resolveRelative(fromFile: string, specifier: string): string | undefined {
		if (!specifier) return undefined;

		if (specifier.startsWith('.')) {
			const base = path.dirname(fromFile);
			const candidate = path.resolve(base, specifier);
			const tryPaths = [
				candidate,
				candidate + '.svelte',
				candidate + '.ts',
				candidate + '.js',
				path.join(candidate, 'index.svelte'),
				path.join(candidate, 'index.ts'),
				path.join(candidate, 'index.js')
			];

			for (const p of tryPaths) if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;

			return undefined;
		}

		// Non-relative specifiers should use resolve() method
		return undefined;
	}

	/**
	 * Resolve any import specifier (relative, alias, or workspace package) to an absolute file path.
	 * This is the main entry point that handles all import resolution strategies.
	 * @param fromFile Absolute path of the file containing the import
	 * @param specifier Module specifier string from the import statement
	 * @param componentName Optional component name for barrel file resolution
	 * @returns Resolved absolute file path or undefined if not found
	 */
	public resolve(
		fromFile: string,
		specifier: string,
		componentName?: string
	): string | undefined {
		if (!specifier) return undefined;

		// 1. Try relative path resolution first (fast path)
		if (specifier.startsWith('.')) return this.resolveRelative(fromFile, specifier);

		// 2. Try path alias resolution
		const aliasResolved = this.resolveAlias(specifier, fromFile);
		if (aliasResolved) return aliasResolved;

		// 3. Try workspace package resolution (Phase 1B)
		const workspaceResolved = this.resolveWorkspacePackage(specifier, fromFile, componentName);
		if (workspaceResolved) return workspaceResolved;

		// 4. Could not resolve
		return undefined;
	}

	/**
	 * Try a list of base paths with various extensions and index files.
	 * @param matchedPaths Base paths to try
	 * @returns First matching file path or undefined
	 */
	private tryPathWithExtensions(matchedPaths: string[]): string | undefined {
		const extensions = ['', '.svelte', '.ts', '.js'];

		for (const basePath of matchedPaths) {
			if (this.detailedLogging)
				this.logger.logResolverMessage(t('resolver.log.resolvedTo', basePath));

			// Try with each extension
			for (const ext of extensions) {
				const fullPath = basePath + ext;

				try {
					if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
						if (this.detailedLogging)
							this.logger.logResolverMessage(t('resolver.log.foundFile', fullPath));
						return fullPath;
					}
				} catch {
					// File doesn't exist or can't be accessed, continue trying
				}
			}

			// Try as directory with index files
			const indexPaths = [
				path.join(basePath, 'index.svelte'),
				path.join(basePath, 'index.ts'),
				path.join(basePath, 'index.js')
			];

			for (const indexPath of indexPaths)
				try {
					if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
						if (this.detailedLogging)
							this.logger.logResolverMessage(t('resolver.log.foundFile', indexPath));
						return indexPath;
					}
				} catch {
					// File doesn't exist or can't be accessed, continue trying
				}
		}

		if (this.detailedLogging) {
			this.logger.logResolverMessage(
				t('resolver.log.triedExtensions', extensions.join(', '))
			);
			this.logger.logResolverMessage(t('resolver.log.noFileFound'));
		}

		return undefined;
	}

	/**
	 * Find which tsconfig path pattern was matched by the specifier.
	 * Used for detailed logging only.
	 * @param specifier The import specifier
	 * @param paths The paths object from tsconfig
	 * @returns Pattern and replacement info, or undefined if no match
	 */
	private findMatchedPattern(
		specifier: string,
		paths: Record<string, string[]>
	): { pattern: string; replacement: string } | undefined {
		for (const [pattern, replacements] of Object.entries(paths)) {
			// Convert tsconfig pattern to regex
			const regexPattern = pattern.replace(/\*/g, '(.*)');
			const regex = new RegExp(`^${regexPattern}$`);

			if (regex.test(specifier) && replacements.length > 0)
				return { pattern, replacement: replacements[0] };
		}
		return undefined;
	}

	/**
	 * Find workspace root by searching upward for pnpm-workspace.yaml.
	 * Caches the result per directory tree.
	 * @param fromDirectory Directory to start searching from
	 * @returns Workspace root path or null if not in workspace
	 */
	private findWorkspaceRoot(fromDirectory: string): string | null {
		let currentDir = fromDirectory;
		const root = path.parse(currentDir).root;

		while (currentDir !== root) {
			const yamlPath = path.join(currentDir, 'pnpm-workspace.yaml');
			if (fs.existsSync(yamlPath)) {
				if (this.detailedLogging)
					this.logger.logResolverMessage(
						t('resolver.log.workspaceRootFound', currentDir)
					);
				return currentDir;
			}
			currentDir = path.dirname(currentDir);
		}

		return null;
	}

	/**
	 * Parse pnpm-workspace.yaml and build package map.
	 * Reads each package's package.json to get its name.
	 * @param workspaceRoot Absolute path to workspace root
	 * @returns Map of package name to WorkspacePackage, or null on error
	 */
	private parseWorkspacePackages(workspaceRoot: string): Map<string, WorkspacePackage> | null {
		try {
			const yamlPath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
			const yamlContent = fs.readFileSync(yamlPath, 'utf8');
			const config = parseYaml(yamlContent) as { packages?: string[] };

			if (!config.packages || config.packages.length === 0) return null;

			const packages = new Map<string, WorkspacePackage>();

			// Parse each package pattern and read package.json
			for (const pattern of config.packages) {
				// For now, assume simple glob patterns like "code/shared"
				// Remove glob wildcards for simple case
				const packagePath = path.join(workspaceRoot, pattern.replace(/[*]/g, ''));

				const packageJsonPath = path.join(packagePath, 'package.json');
				if (!fs.existsSync(packageJsonPath)) continue;

				try {
					const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
					if (packageJson.name)
						packages.set(packageJson.name, {
							name: packageJson.name,
							directory: packagePath,
							packageJsonPath
						});
				} catch {
					// Skip packages with invalid package.json
					continue;
				}
			}

			if (this.detailedLogging)
				this.logger.logResolverMessage(
					t('resolver.log.workspacePackagesLoaded', packages.size.toString())
				);

			return packages;
		} catch {
			return null;
		}
	}

	/**
	 * Resolve package.json exports field.
	 * Supports both simple string exports and conditional exports.
	 * Priority: "svelte" -> "default" -> first available key.
	 * @param packageJsonPath Absolute path to package.json
	 * @param subpath Subpath being imported (e.g., "" for root, "stores" for @pkg/stores)
	 * @returns Resolved relative path from package root, or null if not found
	 */
	private resolveExportsField(packageJsonPath: string, subpath: string): string | null {
		try {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			const exports = packageJson.exports;

			if (!exports) {
				if (this.detailedLogging)
					this.logger.logResolverMessage(
						t('resolver.log.exportsFieldMissing', packageJsonPath)
					);
				return null;
			}

			// Build export key: "./<subpath>" or just "."
			const exportKey = subpath ? `./${subpath}` : '.';
			const exportValue = exports[exportKey];

			if (!exportValue) return null;

			// Handle simple string export
			if (typeof exportValue === 'string') {
				if (this.detailedLogging)
					this.logger.logResolverMessage(
						t('resolver.log.exportsFieldResolved', exportKey, exportValue)
					);
				return exportValue;
			}

			// Handle conditional exports object
			if (typeof exportValue === 'object' && !Array.isArray(exportValue)) {
				// Priority: svelte -> default -> first available
				const resolvedPath =
					exportValue.svelte ?? exportValue.default ?? Object.values(exportValue)[0];

				if (resolvedPath && typeof resolvedPath === 'string') {
					if (this.detailedLogging) {
						const usedKey = exportValue.svelte
							? 'svelte'
							: exportValue.default
								? 'default'
								: Object.keys(exportValue)[0];
						this.logger.logResolverMessage(
							t('resolver.log.conditionalExportUsed', usedKey, resolvedPath)
						);
					}
					return resolvedPath;
				}
			}

			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Parse export statements from barrel file content to find component re-export.
	 * Supports patterns: export { default as X }, export { X }, export * from
	 * @param content File content to parse
	 * @param componentName Component name to find
	 * @returns Relative path to component, or array of wildcard paths to try, or null if not found
	 */
	private parseBarrelExports(content: string, componentName: string): string | string[] | null {
		// Pattern 1: export { default as ComponentName } from './path'
		const pattern1 = new RegExp(
			`export\\s+\\{\\s*default\\s+as\\s+${componentName}\\s*\\}\\s+from\\s+['"]([^'"]+)['"]`,
			'g'
		);
		let match = pattern1.exec(content);
		if (match) return match[1];

		// Pattern 2: export { ComponentName } from './path'
		const pattern2 = new RegExp(
			`export\\s+\\{\\s*${componentName}\\s*\\}\\s+from\\s+['"]([^'"]+)['"]`,
			'g'
		);
		match = pattern2.exec(content);
		if (match) return match[1];

		// Pattern 4: export * from './path' - return all wildcard exports to try
		// These are ambiguous, so we need to try each one until we find the component
		const pattern4 = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
		const wildcardMatches: string[] = [];
		while ((match = pattern4.exec(content)) !== null) wildcardMatches.push(match[1]);

		// If we found wildcard exports, return all of them to be tried in order
		if (wildcardMatches.length > 0) return wildcardMatches;

		return null;
	}

	/**
	 * Resolve barrel file re-exports to find component source.
	 * Recursively follows re-exports up to maxDepth levels.
	 * @param indexPath Absolute path to index.ts/js file
	 * @param componentName Component name to find (e.g., "Button")
	 * @param currentDepth Current recursion depth
	 * @param maxDepth Maximum recursion depth (default: 2)
	 * @returns Resolution result with path, depth, and timing, or null if not found
	 */
	private resolveBarrelFile(
		indexPath: string,
		componentName: string,
		currentDepth: number = 0,
		maxDepth: number = 2
	): BarrelResolutionResult | null {
		const startTime = performance.now();

		if (currentDepth >= maxDepth) {
			if (this.detailedLogging)
				this.logger.logResolverMessage(
					t('resolver.log.barrelMaxDepthReached', maxDepth.toString())
				);
			return null;
		}

		if (this.detailedLogging)
			this.logger.logResolverMessage(t('resolver.log.barrelFileDetected', indexPath));

		try {
			const content = fs.readFileSync(indexPath, 'utf8');
			const parseResult = this.parseBarrelExports(content, componentName);

			if (!parseResult) return null;

			// Handle array of wildcard paths (export * from './path')
			if (Array.isArray(parseResult)) {
				if (this.detailedLogging)
					this.logger.logResolverMessage(
						t(
							'resolver.log.barrelWildcardExports',
							parseResult.length.toString(),
							componentName
						)
					);

				// Try each wildcard path until we find the component
				const indexDir = path.dirname(indexPath);
				for (const relativePath of parseResult) {
					let resolvedPath = path.resolve(indexDir, relativePath);

					// Try with extension fallback if path doesn't have extension
					if (!path.extname(resolvedPath)) {
						const withExtensions = this.tryPathWithExtensions([resolvedPath]);
						if (withExtensions) resolvedPath = withExtensions;
						else continue; // Path doesn't exist, try next one
					}

					// Check if resolved path exists
					if (!fs.existsSync(resolvedPath)) continue;

					// Check if this is another index file (nested barrel)
					const fileName = path.basename(resolvedPath, path.extname(resolvedPath));
					if (fileName === 'index') {
						// Recurse into nested barrel
						const nestedResult = this.resolveBarrelFile(
							resolvedPath,
							componentName,
							currentDepth + 1,
							maxDepth
						);
						if (nestedResult)
							return nestedResult; // Found it!
						else continue; // Not in this barrel, try next one
					}

					// Found the component file
					const durationMs = Math.round(performance.now() - startTime);
					return {
						path: resolvedPath,
						depth: currentDepth + 1,
						durationMs
					};
				}

				// None of the wildcard paths contained the component
				return null;
			}

			// Handle single path (export { X } from './path' or export { default as X } from './path')
			const relativePath = parseResult;

			if (this.detailedLogging)
				this.logger.logResolverMessage(
					t('resolver.log.barrelExportFound', componentName, relativePath)
				);

			// Resolve relative path from index file location
			const indexDir = path.dirname(indexPath);
			let resolvedPath = path.resolve(indexDir, relativePath);

			// Try with extension fallback if path doesn't have extension
			if (!path.extname(resolvedPath)) {
				const withExtensions = this.tryPathWithExtensions([resolvedPath]);
				if (withExtensions) resolvedPath = withExtensions;
			}

			// Check if resolved path exists
			if (!fs.existsSync(resolvedPath)) return null;

			// Check if this is another index file (nested barrel)
			const fileName = path.basename(resolvedPath, path.extname(resolvedPath));
			if (fileName === 'index')
				// Recurse into nested barrel
				return this.resolveBarrelFile(
					resolvedPath,
					componentName,
					currentDepth + 1,
					maxDepth
				);

			// Found the component file
			const durationMs = Math.round(performance.now() - startTime);
			return {
				path: resolvedPath,
				depth: currentDepth + 1,
				durationMs
			};
		} catch {
			return null;
		}
	}

	/**
	 * Resolve workspace package import.
	 * Finds workspace root, matches package, resolves exports field, and handles barrel files.
	 * @param specifier Import specifier (e.g., @budget-suite/shared/stores)
	 * @param fromFile File containing the import
	 * @param componentName Component name to find in barrel files
	 * @returns Resolved absolute path or undefined if not found
	 */
	private resolveWorkspacePackage(
		specifier: string,
		fromFile: string,
		componentName?: string
	): string | undefined {
		const totalStartTime = performance.now();

		// 1. Find workspace root
		const fromDirectory = path.dirname(fromFile);
		const workspaceRoot = this.findWorkspaceRoot(fromDirectory);
		if (!workspaceRoot) return undefined;

		// 2. Get or parse workspace packages
		let workspaceEntry = this.cache.getWorkspace(workspaceRoot);
		if (!workspaceEntry) {
			const packages = this.parseWorkspacePackages(workspaceRoot);
			if (!packages) return undefined;

			const yamlPath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
			const mtime = fs.statSync(yamlPath).mtimeMs;
			this.cache.setWorkspace(workspaceRoot, packages, mtime);
			workspaceEntry = { workspaceRoot, packages, mtime };
		}

		// 3. Match specifier to package (handle subpaths)
		// Extract package name and subpath from specifier
		// e.g., "@budget-suite/shared/stores" -> package: "@budget-suite/shared", subpath: "stores"
		let packageName: string;
		let subpath = '';

		if (specifier.startsWith('@')) {
			// Scoped package: @scope/name or @scope/name/subpath
			const parts = specifier.split('/');
			if (parts.length >= 2) {
				packageName = `${parts[0]}/${parts[1]}`;
				subpath = parts.slice(2).join('/');
			} else {
				return undefined;
			}
		} else {
			// Unscoped package: name or name/subpath
			const parts = specifier.split('/');
			packageName = parts[0];
			subpath = parts.slice(1).join('/');
		}

		const pkg = workspaceEntry.packages.get(packageName);
		if (!pkg) {
			if (this.detailedLogging)
				this.logger.logResolverMessage(
					t('resolver.log.workspacePackageNotFound', specifier)
				);
			return undefined;
		}

		if (this.detailedLogging)
			this.logger.logResolverMessage(
				t('resolver.log.workspacePackageMatched', packageName, pkg.directory)
			);

		// 4. Resolve exports field
		const exportPath = this.resolveExportsField(pkg.packageJsonPath, subpath);
		if (!exportPath) return undefined;

		// Resolve export path relative to package directory
		let resolvedPath = path.resolve(pkg.directory, exportPath);

		// Try with extension fallback if needed
		if (!fs.existsSync(resolvedPath)) {
			const withExtensions = this.tryPathWithExtensions([resolvedPath]);
			if (withExtensions) resolvedPath = withExtensions;
			else return undefined;
		}

		// 5. Check if result is a barrel file and component name is provided
		let barrelDepth = 0;
		if (componentName) {
			const fileName = path.basename(resolvedPath, path.extname(resolvedPath));
			if (fileName === 'index') {
				const barrelResult = this.resolveBarrelFile(resolvedPath, componentName);
				if (barrelResult) {
					resolvedPath = barrelResult.path;
					barrelDepth = barrelResult.depth;

					if (this.detailedLogging) {
						const totalDuration = Math.round(performance.now() - totalStartTime);
						this.logger.logResolverMessage(
							t(
								'resolver.log.barrelResolutionComplete',
								barrelDepth.toString(),
								totalDuration.toString(),
								resolvedPath
							)
						);
					}
				}
			}
		}

		// 6. Cache the result
		const cacheKey = `${specifier}|${fromFile}|${componentName ?? ''}`;
		this.cache.setPackageResolution(cacheKey, {
			resolvedPath,
			packageJsonMtime: fs.statSync(pkg.packageJsonPath).mtimeMs,
			barrelDepth,
			resolvedAt: Date.now()
		});

		return resolvedPath;
	}

	/**
	 * Update the detailed logging setting.
	 * @param enabled Whether to enable detailed logging
	 */
	public setDetailedLogging(enabled: boolean): void {
		this.detailedLogging = enabled;
	}

	/**
	 * Invalidate cache for a specific tsconfig file.
	 * @param tsconfigPath Absolute path to the modified tsconfig.json
	 */
	public invalidateTsconfig(tsconfigPath: string): void {
		this.cache.invalidateTsconfig(tsconfigPath);
		if (this.detailedLogging)
			this.logger.logResolverMessage(t('resolver.log.configFileChanged', tsconfigPath));
	}

	/**
	 * Invalidate workspace package cache when pnpm-workspace.yaml changes.
	 * @param yamlPath Absolute path to the modified pnpm-workspace.yaml
	 */
	public invalidateWorkspace(yamlPath: string): void {
		this.cache.invalidateWorkspace(yamlPath);
		if (this.detailedLogging)
			this.logger.logResolverMessage(t('resolver.log.configFileChanged', yamlPath));
	}
}
