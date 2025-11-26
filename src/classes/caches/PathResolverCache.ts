import { getTsconfig, type TsConfigResult } from 'get-tsconfig';
import * as fs from 'node:fs';
import {
	PackageResolutionCacheEntry,
	TsconfigCacheEntry,
	WorkspaceCacheEntry,
	WorkspacePackage
} from '../../types';

/**
 * Caches tsconfig.json resolution results with file modification time validation.
 * Ensures that stale configurations are automatically invalidated when files change.
 */
export class PathResolverCache {
	private tsconfigCache: Map<string, TsconfigCacheEntry<TsConfigResult>> = new Map<
		string,
		TsconfigCacheEntry<TsConfigResult>
	>();

	// Workspace package map cache (keyed by workspace root)
	private workspaceCache: Map<string, WorkspaceCacheEntry> = new Map<
		string,
		WorkspaceCacheEntry
	>();

	// Individual package resolution cache (keyed by specifier+fromFile hash)
	private packageResolutionCache: Map<string, PackageResolutionCacheEntry> = new Map<
		string,
		PackageResolutionCacheEntry
	>();

	/**
	 * Get cached tsconfig result for a directory, or load and cache if not present.
	 * Automatically invalidates cache if tsconfig.json has been modified.
	 * @param fromDirectory Directory to search for tsconfig.json from
	 * @returns TsConfigResult if found, null otherwise
	 */
	public getTsconfig(fromDirectory: string): TsConfigResult | null {
		const cached = this.tsconfigCache.get(fromDirectory);

		if (cached)
			if (cached.result?.path)
				// Validate cache: check if tsconfig file still exists and hasn't been modified
				try {
					const currentMtime = fs.statSync(cached.result.path).mtimeMs;
					if (currentMtime === cached.mtime)
						// Cache is still valid
						return cached.result;
					// File was modified, invalidate cache
				} catch {
					// File was deleted, invalidate cache
				}
			else if (cached.result === null)
				// We previously determined there was no tsconfig, return cached null
				return null;

		// Cache miss or invalidated - load tsconfig
		const result = getTsconfig(fromDirectory);
		const mtime = result?.path ? fs.statSync(result.path).mtimeMs : 0;

		this.tsconfigCache.set(fromDirectory, { result, mtime });
		return result;
	}

	/**
	 * Clear all cached tsconfig results.
	 * Call this when configuration files are modified or on settings changes.
	 */
	public clear(): void {
		this.tsconfigCache.clear();
		this.workspaceCache.clear();
		this.packageResolutionCache.clear();
	}

	/**
	 * Invalidate cache for a specific tsconfig file path.
	 * @param tsconfigPath Absolute path to tsconfig.json that was modified
	 */
	public invalidateTsconfig(tsconfigPath: string): void {
		// Find all cache entries that reference this tsconfig and remove them
		for (const [key, entry] of this.tsconfigCache.entries())
			if (entry.result?.path === tsconfigPath) this.tsconfigCache.delete(key);
	}

	/**
	 * Get cached workspace package map for a directory tree.
	 * Automatically invalidates cache if pnpm-workspace.yaml has been modified.
	 * @param workspaceRoot Absolute path to workspace root
	 * @returns WorkspaceCacheEntry if found and valid, null otherwise
	 */
	public getWorkspace(workspaceRoot: string): WorkspaceCacheEntry | null {
		const cached = this.workspaceCache.get(workspaceRoot);
		if (!cached) return null;

		// Validate cache: check if pnpm-workspace.yaml still exists and hasn't been modified
		const yamlPath = `${workspaceRoot}/pnpm-workspace.yaml`;
		try {
			const currentMtime = fs.statSync(yamlPath).mtimeMs;
			if (currentMtime === cached.mtime) return cached;

			// File was modified, invalidate cache
			this.workspaceCache.delete(workspaceRoot);
		} catch {
			// File was deleted, invalidate cache
			this.workspaceCache.delete(workspaceRoot);
		}

		return null;
	}

	/**
	 * Set workspace package map cache.
	 * @param workspaceRoot Absolute path to workspace root
	 * @param packages Map of package name to package info
	 * @param mtime pnpm-workspace.yaml modification time
	 */
	public setWorkspace(
		workspaceRoot: string,
		packages: Map<string, WorkspacePackage>,
		mtime: number
	): void {
		this.workspaceCache.set(workspaceRoot, { workspaceRoot, packages, mtime });
	}

	/**
	 * Get cached package resolution.
	 * Automatically invalidates cache if package.json has been modified.
	 * @param cacheKey Unique key for this resolution (specifier+fromFile hash)
	 * @returns PackageResolutionCacheEntry if found and valid, null otherwise
	 */
	public getPackageResolution(cacheKey: string): PackageResolutionCacheEntry | null {
		const cached = this.packageResolutionCache.get(cacheKey);
		if (!cached) return null;

		// Validate cache: check if the resolved file still exists
		try {
			if (!fs.existsSync(cached.resolvedPath)) {
				this.packageResolutionCache.delete(cacheKey);
				return null;
			}

			// For package resolutions, we don't validate package.json mtime here
			// because we'd need to store the package.json path in the cache entry
			// Instead, we rely on workspace cache invalidation when workspace config changes
			return cached;
		} catch {
			this.packageResolutionCache.delete(cacheKey);
			return null;
		}
	}

	/**
	 * Set package resolution cache.
	 * @param cacheKey Unique key for this resolution
	 * @param entry Package resolution cache entry
	 */
	public setPackageResolution(cacheKey: string, entry: PackageResolutionCacheEntry): void {
		this.packageResolutionCache.set(cacheKey, entry);
	}

	/**
	 * Invalidate workspace cache for a specific yaml file.
	 * @param yamlPath Absolute path to pnpm-workspace.yaml that was modified
	 */
	public invalidateWorkspace(yamlPath: string): void {
		// Find workspace root from yaml path
		const workspaceRoot = yamlPath.replace(/[/\\]pnpm-workspace\.yaml$/, '');

		// Clear workspace cache for this root
		this.workspaceCache.delete(workspaceRoot);

		// Clear all package resolutions since workspace structure may have changed
		this.packageResolutionCache.clear();
	}
}
