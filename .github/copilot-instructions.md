# Copilot Project Instructions: SvelteDoc

VS Code extension providing hover tooltips for Svelte component props via regex-based parsing (no compiler dependency).

## CRITICAL: TASKS.md Synchronization

**`TASKS.md` MUST be updated immediately when:**

- Any task is completed (mark `[x]`)
- New features/tasks are discussed or added
- Scope changes occur

**This file (copilot-instructions.md) MUST be updated when:**

- New architecture patterns/files are added
- Core implementation approach changes
- New critical context is needed for AI to code effectively

**Never defer updates.** TASKS.md is the single source of truth for project state; this file is the single source of truth for architecture/patterns.

## Current Implementation Status

**✅ Working:**

- Hover provider for capitalized component tags in `.svelte` files
- Import resolution (supports both default and named imports)
- Prop extraction: `export let`, `$props()`, type/interface with inheritance
- **PropertyScanner**: Character-by-character state machine parser for TypeScript types
    - Handles multi-line properties without semicolons
    - Depth tracking for nested types (objects, arrays, functions)
    - JSDoc comment extraction and association
    - Conditional whitespace normalization based on `normaliseType` and `normaliseComment` settings
- **DestructuringScanner**: Character-by-character parser for $props() destructuring
    - Conditional normalization of default values based on `normaliseDefaultValue` setting
- Script block extraction: Filters out HTML-commented script blocks (handles commented-out file versions)
- **Tooltip formatting**: Three formats (bullet-list, table, code-block) with dynamic selection
    - Shared sorting logic supporting 4 ordering modes (normal, alphabetical, required, type)
    - Configurable via `tooltipFormat` and `tooltipOrder` settings
- TooltipFormatter class handles success/failure cases
- LoggingService with deduplication
- Supports `extends`/`&` inheritance, preserves generics in markdown (backticks)
- **Caching Architecture**: Specialized cache classes coordinated by CacheService facade
    - **PropCache**: Component prop extraction cache with mtime validation and time-based expiration
    - **HoverStateCache**: Tracks hover state to prevent duplicate logging
    - **PathResolverCache**: tsconfig.json parsing cache with automatic invalidation
    - Configurable expiration (default 30 minutes via `cacheExpirationMinutes` setting)
- **Path Alias Resolution**: Full tsconfig.json path mapping support
    - Resolves $lib and custom aliases (@components, @utils, etc.)
    - Extension fallback (.svelte, .ts, .js) and index file resolution
    - File watchers for tsconfig/jsconfig changes with automatic cache invalidation
    - Detailed logging (configurable via `detailedResolverLogging` setting)
- **Workspace Package Resolution**: pnpm workspace support with barrel file resolution
    - Upward search for pnpm-workspace.yaml to detect workspace root
    - Lazy loading: workspace packages parsed on first use, cached with mtime validation
    - Conditional exports support: priority order "svelte" → "default" → first available
    - Barrel file resolution up to 2 levels deep with timing measurements
    - Export patterns: `export { default as X }`, `export { X }`, `export * from`
    - Two-level caching: workspace package map + individual package resolutions
    - File watcher for pnpm-workspace.yaml with automatic cache invalidation
    - Component name flow: extension.ts passes tagName to resolver for barrel lookup
- **Settings**: Centralized configuration with validation (src/utils/settings.ts)
    - All settings use localization (package.nls.json)
    - Normalization: normaliseComment, normaliseType, normaliseDefaultValue
    - Tooltip: tooltipOrder, tooltipFormat
    - Cache: cacheExpirationMinutes
- Commands:
    - Clear Cache: clears all cached component prop data
    - Show Output: focuses the OUTPUT channel for diagnostics
- Unit tests (in tests/) for prop parser (propParser.properties.test.ts and propParser.defaults.test.ts) and script extraction (extractor.scripts.test.ts and extractor.imports.test.ts)

**❌ Not Yet Implemented:**

- Settings for hiding internal props (underscore prefix) or grouping by category

## Project Structure

```
src/              - Source code
  extension.ts    - Main entry point
  types.ts        - All TypeScript types
  classes/        - Class-based modules (scanners, caches, services, formatters)
  parsers/        - Parsing logic (propParser, scriptParser, tagParser)
  utils/          - Utilities (pathResolver, settings, extractor, etc.)
  interfaces/     - VSCode interface stubs
tests/            - Unit tests (at project root)
  fixtures/       - Test fixtures (path-alias-project, pnpm-workspace-project)
```

## Key Architecture

- **extension.ts**: HoverProvider entry, tag detection (`getTagNameAtPosition`), cache initialization, PathResolver setup with file watchers, dynamic formatter selection, `getPropsForHoveredComponent()` function (import resolution orchestration via PathResolver, cache integration, settings propagation to parsers)
- **classes/**: All class-based modules
    - **BaseScanner.ts**: Abstract base class for character-by-character scanning
        - Provides shared navigation: `current()`, `peek()`, `previous()`, `advance()`
        - String literal handling: `handleStringLiteral()` with escape tracking
        - Depth tracking infrastructure
        - Extended by PropertyScanner and DestructuringScanner
    - **PropertyScanner.ts**: Type/interface property parser extending BaseScanner
        - 8 context states with strict isolation rules
        - **CRITICAL**: Context-aware character processing ensures quotes/braces in comments/strings don't trigger parsing
        - Handles multi-line properties, nested types, JSDoc comments
        - Conditional normalization for types and comments (respects settings)
    - **DestructuringScanner.ts**: $props() destructuring parser extending BaseScanner
        - Handles complex default values with nested braces: `(event) => { console.log(event); }`
        - Property alias support: `{ count: internal }` → exposes `count` only
        - Spread pattern handling: ignores `...rest`
        - Conditional normalization for default values (respects settings)
        - Separate depth tracking for `()`, `[]`, `{}`
    - **CacheService.ts**: Facade coordinating all specialized cache classes
        - Delegates to PropCache, HoverStateCache
        - Unified clear() for all caches
    - **caches/PropCache.ts**: Component prop extraction cache with mtime validation and time-based expiration
    - **caches/HoverStateCache.ts**: Hover location tracking for duplicate log prevention
    - **caches/PathResolverCache.ts**: Multi-level cache for path resolution
        - tsconfig.json parsing cache with mtime validation
        - Workspace package map cache (workspaceCache)
        - Individual package resolution cache (packageResolutionCache)
        - invalidateWorkspace() clears workspace and package caches
        - getWorkspace/setWorkspace for workspace package maps
        - getPackageResolution/setPackageResolution for individual resolutions
    - **TooltipFormatter.ts**: Markdown generation with three format options
        - Shared sorting logic (sortProps) supporting 4 modes
        - displayPropsAsList, displayPropsAsTable, displayPropsAsTypescript
    - **LoggingService.ts**: OUTPUT channel logging (includes cache hit/miss indicators and resolver messages)
- **parsers/**: Parsing logic (no index.ts abstraction)
    - **propParser.ts**: Consolidated prop parser with 5-step pipeline
        - Five extraction steps: findPropsDestructuring, parseTypeAnnotation, extractTypeMaps, extractDestructurings, mergeTypeAndDestructuring
        - Accepts normalization settings and passes to scanners
        - Helper functions: stripCommentsForParsing, isPositionCommented, parseParentTypes, splitTopLevel
        - All inline documentation preserved from original multi-file refactor
    - **scriptParser.ts**: Script tag attribute parsing
        - parseAttributes(): Converts raw attribute string to key-value map
    - **tagParser.ts**: Tag name detection for hover provider
        - getTagNameAtPosition(): Detects capitalized component tags at cursor position
- **utils/**: Utility functions and services
    - **pathResolver.ts**: Unified path resolution using get-tsconfig and yaml
        - resolve(fromFile, specifier, componentName?): Main entry point with optional component name for barrels
        - resolveRelative(fromFile, specifier): Handles ./ and ../ imports
        - resolveAlias(specifier, fromFile): Tsconfig path alias resolution ($lib, @components, etc.)
        - resolveWorkspacePackage(specifier, fromFile, componentName?): Workspace package resolution
        - findWorkspaceRoot(fromDirectory): Upward search for pnpm-workspace.yaml
        - parseWorkspacePackages(workspaceRoot): Parse yaml and read package.json files
        - resolveExportsField(packageJsonPath, subpath): Simple + conditional exports (svelte→default→first)
        - resolveBarrelFile(indexPath, componentName, depth, maxDepth): Recursive barrel resolution
        - parseBarrelExports(content, componentName): Regex matching for export patterns
        - tryPathWithExtensions(matchedPaths): Extension/index fallback (.svelte, .ts, .js)
        - invalidateWorkspace(yamlPath): Public method for workspace cache invalidation
        - Uses PathResolverCache for performance
        - Detailed logging support (configurable)
    - **extractor.ts**: Script block extraction and import parsing
        - extractScriptBlocksFromSvelte(filePath): Reads .svelte file and extracts <script> blocks
        - extractScriptBlocksFromText(text): Extracts <script> blocks from text (strips HTML comments)
        - extractImportsFromScriptBlocks(blocks): Parses import statements (default, named, aliases)
    - **settings.ts**: Centralized configuration access with validation
    - **localization.ts**: i18n support
    - **propSorting.ts**: Prop sorting logic with type categorization
- **types.ts**: All TypeScript types/interfaces (documented with purpose)
    - Public types: `PropInfo`, `ScriptBlock`, `CacheEntry`, `PropExtractionResult`, `TooltipOrder`, `TooltipFormat`
    - Workspace types: `WorkspacePackage`, `WorkspaceCacheEntry`, `PackageResolutionCacheEntry`, `BarrelResolutionResult`
    - Internal types: `TypeEntry`, `TypeDefinition`, `TypeMap`, `ScannerContext`

## Coding Rules

- TypeScript strict mode; public modifiers required
- **ALL types must be in `types.ts`** with JSDoc describing their purpose
- Prefer regex over AST parsing (lightweight)
- Single-line if/else when no braces needed (linter enforced)
- **Development**: `pnpm run compile` for TypeScript compilation (fast iteration)
- **Production**: `pnpm run build` or `pnpm run build:prod` for bundled builds
- Keep Markdown output compact (hover size limits)

## Build System

- **Development**: TypeScript compiler (`tsc`) for fast iteration and debugging
    - `pnpm run compile` - compile TypeScript to JavaScript (not bundled)
    - Tests always use TypeScript compiler (via ts-node/mocha)
- **Production**: esbuild bundler for optimized marketplace releases
    - `pnpm run build` - bundle with source maps (development build)
    - `pnpm run build:prod` - bundle with minification (production release)
    - `pnpm run analyze` - view bundle size breakdown
    - **Benefits**: 80-90% size reduction, tree-shaking, single output file
    - **Configuration**: `esbuild.mjs` (documented with extensive comments)
- **Packaging**:
    - All production builds use `--no-dependencies` flag (dependencies are bundled)
    - No `shamefully-hoist` needed in .npmrc (pnpm works natively with bundled builds)
    - VSIX includes only bundled `out/extension.js` + metadata files
    - Size: ~11 files, ~667KB (vs 30+ files, 700KB+ unbundled)

## Tooltip Format (Current)

```markdown
**Extends:** `ParentType<Generic>`

- ⚠️ 🔗 `propName`: **Type** = `default`
    - _JSDoc comment_
- `optionalProp`: **string**
```

**Sort order:** Required first, then optional (alphabetical within groups)

## Quick Reference

- **PropParser Architecture (src/parsers/propParser.ts):**
    - **Main export:** `parsePropsFromScriptBlocks()` - orchestrates 5-step pipeline
    - **PropertyScanner** (in classes/PropertyScanner.ts): State machine parser with 8 contexts
        - **CRITICAL**: Context-aware character processing - quotes/braces in comments/strings are ignored
        - String literal mode: ALL chars accumulated until matching closing quote
        - Comment modes: ALL chars ignored (or accumulated for JSDoc) until termination sequence
        - Depth tracking for nested structures: `{}`, `[]`, `()` (not `<>`)
    - **Five extraction steps:**
        1. findPropsDestructuring - locate $props() and extract type annotation
        2. parseTypeAnnotation - split annotation into type names
        3. extractTypeMaps - extract type/interface definitions using PropertyScanner
        4. extractDestructurings - extract defaults and bindable markers using DestructuringScanner
        5. mergeTypeAndDestructuring - combine into final PropInfo[]
    - **Helper functions:** stripCommentsForParsing, isPositionCommented, parseParentTypes
- **Types:**
    - **Public types (in `types.ts`):**
        - `PropInfo`: Individual component prop (name, type, required, bindable, defaultValue, comment)
        - `ScriptBlock`: Extracted script content from .svelte files
        - `CacheEntry`: Internal cache storage (result, mtime, lastAccessed)
    - **Scanner types:**
        - `DestructuredItem` (in DestructuringScanner.ts): Parsed destructuring item (name, defaultValue)
    - **Internal types (in `types.ts`):**
        - `TypeEntry`: Single property in a type (name, type, required, comment)
        - `TypeDefinition`: Type/interface with entries and inheritance chain
        - `TypeMap`: Map of type names to definitions
        - `ScannerContext`: Enum for PropertyScanner state machine contexts
- **Extraction result:** `PropExtractionResult` (success, props, inherits, componentPath, failureReason, fromCache)
- **Inheritance parsing:** Handles `extends`, `&`, generics with nesting (`<>`, quotes, pipes)
- **Cache Architecture:**
    - `CacheService` - Facade delegating to specialized caches
    - `PropCache` - Component extraction results (mtime + time-based expiration)
    - `HoverStateCache` - Hover location tracking
    - `PathResolverCache` - Three-level cache: tsconfig, workspace packages, package resolutions
- **Path Resolution:** `PathResolver` with `get-tsconfig` for alias resolution, `yaml` for workspace packages, file watchers for config changes
- **Workspace Package Resolution:**
    - Workspace detection: Upward search for pnpm-workspace.yaml (cached per directory tree)
    - Package parsing: Reads yaml config and each package's package.json (lazy loaded)
    - Exports resolution: Simple strings and conditional exports with priority (svelte→default→first)
    - Barrel resolution: Follows re-exports up to 2 levels with timing tracking
    - Export patterns: `export { default as X } from`, `export { X } from`, `export * from`
    - Cache integration: Two-level caching with mtime validation and automatic invalidation

## Assistant Workflow

1. Read TASKS.md before starting work
2. Make focused, incremental changes
3. Compile + check errors after each edit
4. **Update TASKS.md before ending turn**

- Fail gracefully: if import resolution fails, show fallback note.

## If Blocked

State blockers clearly; suggest next actionable step or dependency.
