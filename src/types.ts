/**
 * Component property information extracted from Svelte files.
 * Represents a single prop with its type, requirements, and metadata.
 */
export type PropInfo = {
	name: string;
	type: string;
	required: boolean;
	bindable: boolean;
	defaultValue?: string;
	comment?: string;
};

/**
 * Extracted script block from a Svelte component.
 * Contains the script content and any attributes (lang, module, etc.).
 */
export type ScriptBlock = {
	content: string;
	attributes: Record<string, string | true>;
};

/**
 * Import information extracted from import statements.
 * Stores the module specifier and optionally the original name if aliased.
 */
export type ImportInfo = {
	specifier: string; // Module specifier (e.g., '@budget-suite/shared')
	originalName?: string; // Original export name if aliased (e.g., 'Card' for 'Card as CoreCard')
};

/**
 * Internal cache entry for CacheService.
 * Stores extraction result with metadata for invalidation.
 */
export type PropCacheEntry = {
	result: PropExtractionResult;
	mtime: number; // File modification time in milliseconds
	lastAccessed: number; // Timestamp of last access
};

/**
 * Cache entry for tsconfig.json resolution results.
 */
export type TsconfigCacheEntry<T> = {
	result: T | null;
	mtime: number;
};

/**
 * Internal representation of a single property entry in a type/interface.
 * Used during parsing before conversion to PropInfo.
 */
export type TypeEntry = {
	name: string;
	type: string;
	required: boolean;
	comment?: string;
};

/**
 * Type/interface definition with its properties and inheritance chain.
 * Used internally by propParser to track parsed type structures.
 */
export type TypeDefinition = {
	entries: Partial<Record<string, TypeEntry>>;
	inherits: string[]; // parent types/interfaces being extended or unioned
};

/**
 * Map of type/interface names to their definitions.
 * Internal structure for tracking all parsed types in a script block.
 */
export type TypeMap = Partial<Record<string, TypeDefinition>>;

/**
 * Scanner context states for character-by-character type parsing.
 * Used by PropertyScanner to track current parsing state.
 */
export enum ScannerContext {
	NONE, // Seeking next token at depth 0
	SINGLE_LINE_COMMENT, // Inside // comment
	MULTI_LINE_COMMENT, // Inside /* */ comment (not JSDoc)
	JSDOC_COMMENT, // Inside /** */ comment
	PROPERTY_NAME, // Reading property name
	AFTER_QUESTION, // Read ? after property name
	AFTER_COLON, // Read : after property name
	PROPERTY_TYPE // Reading property type
}

export type PropExtractionResult = {
	success: boolean;
	props?: PropInfo[];
	inherits?: string[]; // Parent types/interfaces being extended or unioned
	componentPath?: string;
	failureReason?: string;
	fromCache?: boolean; // Indicates if result came from cache
};

/**
 * Valid tooltip order options.
 */
export type TooltipOrder = 'normal' | 'alphabetical' | 'required' | 'type';

/**
 * Valid tooltip format options.
 */
export type TooltipFormat = 'bullet-list' | 'table' | 'code-block';

/**
 * Tooltip visibility settings for controlling which components are displayed.
 */
export type FormatSettings = {
	showComments: boolean;
	showTypes: boolean;
	showDefaults: boolean;
	showInheritance: boolean;
};

/**
 * Workspace package information from pnpm-workspace.yaml.
 * Represents a single package in the workspace with its metadata.
 */
export type WorkspacePackage = {
	name: string; // Package name (e.g., @budget-suite/shared)
	directory: string; // Absolute path to package directory
	packageJsonPath: string; // Absolute path to package.json
};

/**
 * Cache entry for workspace package map.
 * Stores parsed workspace packages with mtime validation.
 */
export type WorkspaceCacheEntry = {
	workspaceRoot: string; // Absolute path to workspace root
	packages: Map<string, WorkspacePackage>; // Map of package name to package info
	mtime: number; // pnpm-workspace.yaml modification time in milliseconds
};

/**
 * Cache entry for resolved package paths.
 * Stores individual package resolution results with metadata.
 */
export type PackageResolutionCacheEntry = {
	resolvedPath: string; // Absolute path to resolved file
	packageJsonMtime: number; // package.json modification time for invalidation
	barrelDepth: number; // Number of barrel files traversed (0-2)
	resolvedAt: number; // Timestamp when resolution occurred
};

/**
 * Barrel file resolution result.
 * Contains the resolved path and metadata about the resolution process.
 */
export type BarrelResolutionResult = {
	path: string; // Absolute path to resolved component
	depth: number; // Number of barrel files traversed
	durationMs: number; // Time taken to resolve in milliseconds
};
