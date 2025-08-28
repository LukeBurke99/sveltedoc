# SvelteDoc

![Logo](images/logo/128.png)

Generate and maintain component documentation blocks for your Svelte 5 components directly in your source files. The docs appear at the top of the file and show up in hovers when you use the component elsewhere.

> Tip: Add a screenshot of a documented component here.

## What it does

- Parses your Svelte component's TypeScript to discover props from `$props()` typed destructuring.
- Finds the props type alias (e.g., `Props`, `ButtonProps`) or falls back to patterns like `*Props`.
- Builds a single `<!-- @component ... -->` block at the top of the file.
- Preserves your description across runs and updates only the props section.
- Supports inherited types via intersections (e.g., `HTMLAttributes<...> & { ... }`).
- Respects a `---` delimiter inside the comment; anything after it is preserved exactly.

## Command

- SvelteDoc: Document Current File
	- Runs on the active editor when it's a `.svelte` file.

## Settings

Settings live under the `sveltedoc` namespace.

- sveltedoc.documentOnSave (boolean, default: true)
	- Run documentation generation whenever a matching `.svelte` file is saved.

- sveltedoc.filesToDocument (string[], default: ["**/components/**"])
	- Glob-like patterns for files/folders where docs should run. Only `.svelte` files are processed.

- sveltedoc.propertyNameMatch (string[], default: ["*Props"])
	- Fallback patterns for the props type alias when it can't be inferred from `$props()`.
	- Works with both `type` and `interface` declarations (e.g., `type ButtonProps = {...}` or `interface ButtonProps { ... }`).

- sveltedoc.addTitleAndDescription (boolean, default: true)
	- Include `## ComponentName` and the free-form description text in the comment.

- sveltedoc.placeTitleBeforeProps (boolean, default: true)
	- Whether to place the title/description before the props section.

## File matching guide (filesToDocument)

The extension runs on save only for files whose path matches your `sveltedoc.filesToDocument` patterns.

- Default: `["**/components/**"]`
- Only `.svelte` files are processed (the pattern filters by path, the extension then ensures the file is a Svelte file).
- Works across nested folders and monorepos. On Windows paths are normalized so forward-slash globs work.

Examples that match:

- `src/lib/components/MainView.svelte`
- `src/lib/components/Some/Other/Folders/Other.svelte`
- `src/Apps/MobileApp/src/lib/components/some other folder/component.svelte`
- `src/components/A.svelte`
- `src/components/Folder/B.svelte`

Examples that do not match:

- `src/routes/+page.svelte`
- `src/lib/RandomSvelteFile.svelte`

Tip: You can add more patterns if you keep components in different places, e.g.

```json
{
	"sveltedoc.filesToDocument": [
		"**/components/**",
		"packages/ui/src/**"
	]
}
```

## Output channel

The extension writes detailed logs to the "SvelteDoc" output channel (View -> Output -> SvelteDoc) so you can see what it detected and changed.

## How it works

1. Reads all `<script lang="ts">` blocks in the component.
2. Detects `$props()` destructuring and captures defaults and `$bindable(...)` usage.
3. Resolves the props type as a type alias or interface and parses object members, optionality, JSDoc summaries, and inherited types.
4. Renders a single `@component` block and inserts it before the first TS `<script>` tag.
5. Preserves your description and any content after a `---` delimiter inside the comment.

## Notes

- If no props are detected, `### Props` is omitted and the block becomes description-only (still useful for hovers).
- Defaults using `$bindable(inner)` are shown as `inner`.
- Angle brackets are escaped in plain text; code spans remain verbatim.

## Troubleshooting

- Nothing happens on save:
	- Ensure the file path matches `sveltedoc.filesToDocument`.
	- Confirm the file has `<script lang="ts">` blocks.
	- Check the SvelteDoc output channel for diagnostics.

## License

See LICENSE.
