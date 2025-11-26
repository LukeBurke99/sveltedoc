import type { PropExtractionResult } from '../types';
import { HoverStateCache } from './caches/HoverStateCache';
import { PathResolverCache } from './caches/PathResolverCache';
import { PropCache } from './caches/PropCache';

/**
 * Facade for all caching services in the extension.
 * Delegates to specialized cache classes for component props, hover state, and path resolution.
 */
export class CacheService {
	private propCache: PropCache;
	private hoverStateCache: HoverStateCache;
	private pathResolverCache: PathResolverCache;

	/**
	 * Create a new CacheService with specialized caches.
	 * @param expirationMinutes Time in minutes after which unused prop cache entries expire
	 */
	public constructor(expirationMinutes: number) {
		this.propCache = new PropCache(expirationMinutes);
		this.hoverStateCache = new HoverStateCache();
		this.pathResolverCache = new PathResolverCache();
	}

	//#region Component Property Cache Delegation

	/**
	 * Get cached result for a component file path.
	 * @param componentPath Absolute file path of the component
	 */
	public get(componentPath: string): PropExtractionResult | undefined {
		return this.propCache.get(componentPath);
	}

	/**
	 * Store a prop extraction result in the cache.
	 * @param componentPath Absolute file path of the component
	 * @param result The prop extraction result to cache
	 */
	public set(componentPath: string, result: PropExtractionResult): void {
		this.propCache.set(componentPath, result);
	}

	//#endregion

	//#region Hover State Cache Delegation

	/**
	 * Check if the current hover is for the same file and tag as the last hover.
	 * @param file The current file path
	 * @param tag The current tag name
	 */
	public isSameHover(file: string, tag: string): boolean {
		return this.hoverStateCache.isSameHover(file, tag);
	}

	/**
	 * Check if the current hover is for the same component (file, tag, and path) as the last hover.
	 * @param file The current file path
	 * @param tag The current tag name
	 * @param componentPath The resolved component file path, if any
	 */
	public isSameComponent(file: string, tag: string, componentPath: string | undefined): boolean {
		return this.hoverStateCache.isSameComponent(file, tag, componentPath);
	}

	/**
	 * Update the hover state to track the current hover location.
	 * @param file The current file path
	 * @param tag The current tag name
	 * @param componentPath The resolved component file path, if any
	 */
	public setHover(file: string, tag: string, componentPath: string | undefined): void {
		this.hoverStateCache.setHover(file, tag, componentPath);
	}

	//#endregion

	//#region Path Resolver Cache Access

	/**
	 * Get the PathResolverCache instance for dependency injection.
	 */
	public getPathResolverCache(): PathResolverCache {
		return this.pathResolverCache;
	}

	//#endregion

	/**
	 * Clear all caches (props, hover state, and path resolver).
	 */
	public clear(): void {
		this.propCache.clear();
		this.hoverStateCache.clear();
		this.pathResolverCache.clear();
	}
}
