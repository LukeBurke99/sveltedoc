/**
 * esbuild Configuration for VS Code Extension Bundling
 *
 * This script bundles the extension for production deployment to the marketplace.
 * It replaces the TypeScript compiler (tsc) for production builds only.
 *
 * WHAT DOES THIS DO?
 * ------------------
 * 1. Bundles all source files (src/**\/*.ts) into a single output file (out/extension.js)
 * 2. Includes only the code actually used from dependencies (tree-shaking)
 * 3. Removes unused exports, dead code, and development-only code
 * 4. Generates source maps for debugging production issues
 *
 * BENEFITS:
 * ---------
 * - Reduces extension from ~211 files to just 1 file
 * - 80-90% smaller download size for users
 * - Faster extension activation (VS Code loads 1 file instead of 211)
 * - No need for shamefully-hoist in .npmrc (dependencies are bundled)
 * - Tree-shaking removes unused code from packages (e.g., only includes the
 *   functions you actually use from get-tsconfig instead of the whole package)
 *
 * WHEN IS THIS USED?
 * ------------------
 * - Production builds: pnpm run build
 * - Creating VSIX: pnpm run package (via prepackage hook)
 * - CI/CD releases: GitHub Actions workflows
 *
 * NOT used during development - use `pnpm run compile` for dev (faster iteration)
 *
 * CONFIGURATION EXPLAINED:
 * ------------------------
 * - entryPoints: Starting point of the extension (extension.ts)
 * - bundle: Combine all imports into single file
 * - outfile: Where to write the bundled output
 * - external: Don't bundle VS Code API (provided by VS Code runtime)
 * - format: CommonJS module format (required for Node.js/VS Code)
 * - platform: Target Node.js runtime
 * - sourcemap: Generate .js.map files for debugging
 * - minify: false = readable code for debugging (true = smaller but unreadable)
 * - metafile: Generate bundle analysis data (used by analyze script)
 */

import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
	const ctx = await esbuild.context({
		// Entry point - where bundling starts
		entryPoints: ['src/extension.ts'],

		// Bundle all dependencies into a single file
		bundle: true,

		// Output configuration
		outfile: 'out/extension.js',

		// External dependencies (not bundled)
		// vscode API is provided by VS Code runtime, don't bundle it
		external: ['vscode'],

		// Output format and platform
		format: 'cjs', // CommonJS (required for Node.js extensions)
		platform: 'node', // Target Node.js runtime (not browser)

		// Source maps for debugging
		// Maps minified/bundled code back to original TypeScript
		sourcemap: true,

		// Minification (disabled for easier debugging)
		// Enable with --production flag for smallest size
		minify: production,

		// Generate metafile for bundle analysis
		// Used by `pnpm run analyze` to show what's in the bundle
		metafile: true,

		// Log level
		logLevel: 'info'
	});

	if (watch) {
		// Watch mode for development (optional)
		await ctx.watch();
		console.log('👀 Watching for changes...');
	} else {
		// One-time build
		await ctx.rebuild();
		console.log('✅ Build complete!');

		// Show bundle analysis summary
		const result = await ctx.rebuild();
		if (result.metafile) {
			const analysis = await esbuild.analyzeMetafile(result.metafile, {
				verbose: false
			});
			console.log('\n📦 Bundle Analysis:');
			console.log(analysis);
		}

		await ctx.dispose();
	}
}

main().catch((error) => {
	console.error('❌ Build failed:', error);
	process.exit(1);
});
