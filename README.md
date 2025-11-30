# SvelteDoc

> **Intelligent hover tooltips for your Svelte 5 components** — See component props, types, and JSDoc comments without leaving your workflow.

## What it does

Hover over any Svelte component tag to instantly see:
- **Props** extracted from `$props()` type annotations
- **Type information** including complex TypeScript types and generics
- **JSDoc comments** explaining each prop
- **Default values** and `$bindable()` indicators
- **Inherited types** from extended interfaces

No need to jump between files or generate documentation blocks — SvelteDoc brings the information to you.

![Example of documented component](images/documentation.png)

> **Suggestions are welcome!** Please create an issue on the GitHub repo and your suggestion will be taken into consideration!

---

## Table of Contents
* [Quick Start](#quick-start)
* [Features](#features)
* [Best Practices](#best-practices)
  * [Important Practices](#important-practices)
  * [Path Resolution](#path-resolution)
  * [Workspace Packages](#workspace-packages)
* [Configuration](#configuration)
* [Commands](#commands)
* [Troubleshooting](#troubleshooting)
* [References](#references)

---

## Quick Start

**1. Create a component with typed props:**

```svelte
<!-- Button.svelte -->
<script lang="ts">
	interface Props {
		/** Button text to display */
		label: string;

		/** Visual style variant */
		variant?: 'primary' | 'secondary';

		/** Click handler */
		onClick?: (event: MouseEvent) => void;
	}

	const { label, variant = 'primary', onClick }: Props = $props();
</script>

<button class={variant} onclick={onClick}>
	{label}
</button>
```

**2. Import and use the component:**

```svelte
<!-- App.svelte -->
<script lang="ts">
	import Button from './Button.svelte';
</script>

<!-- Hover over "Button" to see prop documentation -->
<Button label="Click me" variant="secondary" />
```

**3. See the magic!** Hover over `<Button` and see a tooltip with:
- `label: string` — Button text to display ⚠️ (required)
- `variant?: 'primary' | 'secondary'` — Visual style variant (default: `'primary'`)
- `onClick?: (event: MouseEvent) => void` — Click handler

---

## Features

- **🎯 Intelligent Prop Extraction** — Parses multi-line properties, nested types, TypeScript utilities, and JSDoc comments automatically.
- **⚡ Smart Import Resolution** — Resolves relative imports, tsconfig aliases, and workspace packages seamlessly.
- **📊 Customizable Tooltips** — Choose between bullet list, table, or code block formats with four sorting options.
- **⚡ Performance Optimized** — In-memory caching with automatic invalidation keeps tooltips fast and accurate.

---

## Best Practices

### Important Practices

It is highly recommended to follow best practices (for Svelte 5) to ensure SvelteDoc works optimally. The following list is essential:
- Components must be capitalized (e.g., `<Button>`, `<Card>`) to be recognized.
- Always use **typed** `$props()` destructuring in your components.
> Read the following sections on path resolution and workspace packages to ensure imports are resolved correctly.

### Path Resolution

SvelteDoc resolves imports intelligently. Here's how to configure your project for best results:

#### 1. Relative Paths
Works out of the box:
```typescript
import Button from './Button.svelte';
import Card from '../components/Card.svelte';
```

#### 2. tsconfig.json Path Aliases
Define aliases in your `tsconfig.json` or `jsconfig.json`:

```json
{
	"compilerOptions": {
		"paths": {
			"$lib/*": ["./src/lib/*"],
			"@components/*": ["./src/components/*"],
			"@utils/*": ["./src/utils/*"]
		}
	}
}
```

Then use them in imports:
```typescript
import Button from '$lib/components/Button.svelte';
import Card from '@components/Card.svelte';
```
> SvelteDoc will automatically find your aliases and resolve it to the actual file path, checking barrel files as needed. Path aliases that are defined in multiple tsconfig files (like extending a base config for SvelteKit) are also supported.

#### 3. Local Libraries
Currently works with PNPM workspaces (see next section). Enusre you have a `pnpm-workspace.yaml` file at your monorepo root and the library package is referenced in your `package.json` file. Then just import as normal:
```typescript
import { Button } from '@myorg/mylib';
```
> SvelteDoc will resolve the library's package, check the `exports` field in `package.json`, and follow barrel files to find the component.

### Workspace Packages

For monorepos using **pnpm workspaces**, SvelteDoc provides advanced barrel file resolution.

#### Setting up a Shared Package

**1. Create workspace structure:**
```
project-root/
├── pnpm-workspace.yaml
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts          # Barrel file
│   │       └── components/
│   │           ├── index.ts      # Nested barrel
│   │           ├── Button.svelte
│   │           └── Card.svelte
│   └── app/
│       ├── package.json
│       └── src/
│           └── App.svelte
```

**2. Configure `pnpm-workspace.yaml`:**
```yaml
packages:
  - 'packages/*'
```

**3. Set up `package.json` with exports:**
```json
{
	"name": "@myorg/shared",
	"exports": {
		".": {
			"svelte": "./src/index.ts",
			"default": "./src/index.ts"
		},
		"./components": {
			"svelte": "./src/components/index.ts",
			"default": "./src/components/index.ts"
		}
	}
}
```

**4. Create barrel files:**

`packages/shared/src/index.ts`:
```typescript
// Re-export from nested barrels
export * from './components/index.ts';
```

`packages/shared/src/components/index.ts`:
```typescript
// Named default re-exports (recommended)
export { default as Button } from './Button.svelte';
export { default as Card } from './Card.svelte';

// Or named re-exports
export { Button } from './Button.svelte';
export { Card } from './Card.svelte';
```

> **Tip:** Use custom barrel file names like `core.ts` or `main.ts` instead of `index.ts` to organize exports. Configure recognized barrel file names via the `barrelFileNames` setting (default: `["index", "main"]`).

**5. Use in consuming packages:**
```svelte
<script lang="ts">
	// SvelteDoc will resolve through barrels automatically
	import { Button, Card } from '@myorg/shared';
</script>

<!-- Hover works! -->
<Button label="Click me" />
<Card title="My Card" />
```

> **Note:** SvelteDoc automatically resolves barrel files (re-exports) with configurable depth (default 3 levels, adjustable via `barrelFileMaxDepth` setting) and customizable barrel file names (default `["index", "main"]`, adjustable via `barrelFileNames` setting). Results are cached for performance.

---

## Configuration

All settings are under the `sveltedoc` namespace:

- **`cacheExpirationMinutes`** (number, default: `30`) — Minutes of inactivity before clearing cached props. ⚠️ Higher values may increase memory usage.

- **`normaliseComment`** (boolean, default: `false`) — Remove extra whitespace from JSDoc comments for compact display.

- **`normaliseType`** (boolean, default: `true`) — Remove extra whitespace from type definitions for compact display.

- **`normaliseDefaultValue`** (boolean, default: `true`) — Remove extra whitespace from default values for compact display.

- **`tooltipOrder`** (string, default: `'required'`) — Property display order: `normal`, `alphabetical`, `required`, or `type`.

- **`tooltipFormat`** (string, default: `'code-block'`) — Tooltip format: `bullet-list`, `table`, or `code-block`.

- **`detailedResolverLogging`** (boolean, default: `true`) — Enable detailed logging for import resolution debugging. Check Output panel (View → Output → SvelteDoc).

- **`fallbackTypes`** (object, default: `{ "children": "Snippet", "class": "string" }`) — Map of property names to types used when a prop has an 'unknown' type. Useful for common props like 'children' or 'class' that are often destructured without type annotations.

- **`barrelFileMaxDepth`** (number, default: `3`) — Maximum depth for resolving barrel files (index re-exports) in workspace packages. Range: 0-10. ⚠️ Warning: Higher values may slow down component resolution. Set to 0 to disable barrel file resolution.

- **`barrelFileNames`** (array, default: `["index", "main"]`) — List of file names (without extension) to recognize as barrel files. Files matching these names will be checked for re-export patterns when resolving workspace package imports. Use `["*"]` to check any `.ts`/`.js` file for re-exports. ⚠️ Warning: Using wildcard `*` may impact performance on large projects.

---

## Commands

Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

### `SvelteDoc: Clear Cache`
Clears all cached component prop data. Useful if you see stale information after updating component types.

### `SvelteDoc: Show Output`
Opens the SvelteDoc output panel showing detailed logs of hover attempts, component resolution, and prop extraction.

---

## Troubleshooting

### "No import found for component"
**Problem:** Tooltip shows error when hovering over component tag.

**Solutions:**
- Verify the component is imported in your `<script>` block
- Check import statement syntax (both default and named imports work)
- Ensure component name matches the imported name exactly (case-sensitive)

**Example:**
```svelte
<script lang="ts">
	// ✅ Works
	import Button from './Button.svelte';
	import { Card } from './Card.svelte';

	// ❌ Won't work — no import
	// <Alert /> won't show tooltip
</script>

<Button label="Test" />
<Card title="Works" />
```

### "No $props() found"
**Problem:** Tooltip shows "No props found" even though component has props.

**Solutions:**
- Add `$props()` destructuring to your component
- Ensure `$props()` has a type annotation (`: Props` or `: { ... }`)
- Check that the type is defined in the same file or imported

**Example:**
```svelte
<!-- ❌ Won't work — no type annotation -->
<script lang="ts">
	const { label } = $props();
</script>

<!-- ✅ Works — has type annotation -->
<script lang="ts">
	interface Props {
		label: string;
	}

	const { label }: Props = $props();
</script>
```

### "Could not resolve component path"
**Problem:** Import path cannot be resolved (tsconfig alias or workspace package).

**Solutions:**
- Verify `tsconfig.json` or `jsconfig.json` has correct `paths` configuration
- For workspace packages, ensure `pnpm-workspace.yaml` exists and references the package
- Check `package.json` has properly configured `exports` field
- Enable `detailedResolverLogging` setting and check Output panel for details

**Check Output Panel:**
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run "SvelteDoc: Show Output"
3. Look for resolver logs showing which paths were tried

### Stale or Incorrect Information
**Problem:** Tooltip shows outdated props after changing component definition.

**Solutions:**
- Run command: "SvelteDoc: Clear Cache"
- Check if file was saved (cache validates via modification time)
- Adjust `cacheExpirationMinutes` setting for faster expiration

---

## References

- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/$props)
- [Svelte Type Safety Guide](https://svelte.dev/docs/svelte/$props#Type-safety)
- [TypeScript Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)

---

## License

See [LICENSE](LICENSE).
