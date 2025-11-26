import * as fs from 'node:fs';
import type { PropCacheEntry, PropExtractionResult } from '../../types';

/**
 * In-memory cache for component prop extraction results.
 * Invalidates entries based on file modification time and time-based expiration.
 */
export class PropCache {
	private cache: Map<string, PropCacheEntry> = new Map<string, PropCacheEntry>();
	private expirationMs: number;

	/**
	 * Create a new PropCache with specified expiration time.
	 * @param expirationMinutes Time in minutes after which unused entries expire
	 */
	public constructor(expirationMinutes: number) {
		this.expirationMs = expirationMinutes * 60 * 1000;
	}

	/**
	 * Get cached result for a component file path.
	 * Returns undefined if cache miss or entry is invalid/expired.
	 * Performs opportunistic cleanup of all expired entries on any access.
	 * @param componentPath Absolute file path of the component
	 */
	public get(componentPath: string): PropExtractionResult | undefined {
		// Opportunistic cleanup: remove all expired entries on any cache access
		this.cleanupExpiredEntries();

		const entry = this.cache.get(componentPath);
		if (!entry) return undefined;

		// Check if file has been modified (mtime changed)
		try {
			const stats = fs.statSync(componentPath);
			const currentMtime = stats.mtimeMs;

			if (entry.mtime !== currentMtime) {
				// File changed, invalidate this entry
				this.cache.delete(componentPath);
				return undefined;
			}
		} catch {
			// File doesn't exist or can't be read, invalidate
			this.cache.delete(componentPath);
			return undefined;
		}

		// Update last accessed timestamp
		this.cache.set(componentPath, {
			...entry,
			lastAccessed: Date.now()
		});
		return entry.result;
	}

	/**
	 * Store a prop extraction result in the cache.
	 * @param componentPath Absolute file path of the component
	 * @param result The prop extraction result to cache
	 */
	public set(componentPath: string, result: PropExtractionResult): void {
		try {
			const stats = fs.statSync(componentPath);
			const mtime = stats.mtimeMs;

			this.cache.set(componentPath, {
				result,
				mtime,
				lastAccessed: Date.now()
			});
		} catch {
			// If we can't read file stats, don't cache
			return;
		}
	}

	/**
	 * Remove entries that haven't been accessed within the expiration window.
	 */
	private cleanupExpiredEntries(): void {
		const now = Date.now();
		const keysToDelete: string[] = [];

		for (const [key, entry] of this.cache.entries()) {
			const timeSinceAccess = now - entry.lastAccessed;
			if (timeSinceAccess > this.expirationMs) keysToDelete.push(key);
		}

		for (const key of keysToDelete) this.cache.delete(key);
	}

	/**
	 * Clear all cached entries.
	 */
	public clear(): void {
		this.cache.clear();
	}
}
