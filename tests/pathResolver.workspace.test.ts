import * as assert from 'node:assert';
import * as path from 'node:path';
import { PathResolverCache } from '../src/classes/caches/PathResolverCache';
import { PathResolver } from '../src/utils/pathResolver';

// Mock LoggingService for tests (avoid vscode dependency)
class MockLogger {
	public logResolverMessage(): void {
		// No-op for tests
	}
}

describe('PathResolver - Workspace Package Resolution', () => {
	let resolver: PathResolver;
	let cache: PathResolverCache;
	let fixtureRoot: string;
	let budgetAppPage: string;
	let shoppingAppPage: string;
	let workspaceYaml: string;

	beforeEach(() => {
		// Initialize services
		cache = new PathResolverCache();
		const mockLogger = new MockLogger() as any;
		resolver = new PathResolver(cache, mockLogger, false); // Disable detailed logging for tests

		// Set up fixture paths
		fixtureRoot = path.join(__dirname, 'fixtures', 'pnpm-workspace-project');
		budgetAppPage = path.join(
			fixtureRoot,
			'code',
			'budget-app',
			'src',
			'routes',
			'+page.svelte'
		);
		shoppingAppPage = path.join(
			fixtureRoot,
			'code',
			'shopping-app',
			'src',
			'routes',
			'+page.svelte'
		);
		workspaceYaml = path.join(fixtureRoot, 'pnpm-workspace.yaml');
	});

	it('1. Should find workspace root from nested file', () => {
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');

		assert.ok(result, 'Should resolve workspace package');
		assert.ok(result.includes('Button.svelte'), 'Should resolve to Button.svelte');
	});

	it('2. Should parse pnpm-workspace.yaml and load packages', () => {
		// First call triggers workspace parsing
		const result1 = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');
		assert.ok(result1, 'First resolution should succeed');

		// Second call should use cache
		const result2 = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');
		assert.ok(result2, 'Second resolution should succeed');
		assert.strictEqual(result1, result2, 'Both resolutions should return same path');
	});

	it('3. Should resolve root package import via conditional exports (svelte condition)', () => {
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');

		assert.ok(result, 'Should resolve workspace package');
		// Should use "svelte" condition which points to src/lib/index.ts
		assert.ok(result.includes('src'), 'Should resolve to src directory (svelte condition)');
		assert.ok(
			result.includes('Button.svelte'),
			'Should resolve through barrel to Button.svelte'
		);
	});

	it('4. Should resolve subpath import (stores)', () => {
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared/stores');

		assert.ok(result, 'Should resolve stores subpath');
		assert.ok(result.includes('stores'), 'Should resolve to stores directory');
		assert.ok(result.includes('index.ts'), 'Should resolve to index.ts');
	});

	it('5. Should resolve barrel file level 1 (Button component)', () => {
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');

		assert.ok(result, 'Should resolve Button component');
		assert.ok(result.endsWith('Button.svelte'), 'Should resolve to Button.svelte');
		assert.ok(
			result.includes(path.join('components', 'Button.svelte')),
			'Should be in components directory'
		);
	});

	it('6. Should resolve barrel file level 2 (Card component through nested barrels)', () => {
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Card');

		assert.ok(result, 'Should resolve Card component');
		assert.ok(result.endsWith('Card.svelte'), 'Should resolve to Card.svelte');
		assert.ok(
			result.includes(path.join('components', 'Card.svelte')),
			'Should be in components directory'
		);
	});

	it('7. Should handle direct component export path', () => {
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared/components/button');

		assert.ok(result, 'Should resolve direct component path');
		assert.ok(result.endsWith('Button.svelte'), 'Should resolve to Button.svelte');
	});

	it('8. Should return undefined for non-workspace package', () => {
		const result = resolver.resolve(budgetAppPage, '@non-existent/package', 'Component');

		assert.strictEqual(result, undefined, 'Should return undefined for non-workspace package');
	});

	it('9. Should cache workspace package map and reuse it', () => {
		// Clear cache to start fresh
		cache.clear();

		// First resolution from budget-app
		const result1 = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');
		assert.ok(result1, 'First resolution should succeed');

		// Second resolution from different app (shopping-app) should reuse workspace cache
		const result2 = resolver.resolve(shoppingAppPage, '@budget-suite/shared', 'Button');
		assert.ok(result2, 'Second resolution should succeed');
		assert.strictEqual(result1, result2, 'Both should resolve to same Button.svelte');
	});

	it('10. Should invalidate cache when pnpm-workspace.yaml changes', () => {
		// Perform initial resolution to populate cache
		const result1 = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');
		assert.ok(result1, 'Initial resolution should succeed');

		// Invalidate workspace cache
		resolver.invalidateWorkspace(workspaceYaml);

		// Resolution should still work (will re-parse workspace)
		const result2 = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');
		assert.ok(result2, 'Resolution after invalidation should succeed');
		assert.strictEqual(result1, result2, 'Should resolve to same path after re-parsing');
	});

	it('11. Should resolve from different workspace packages', () => {
		// Resolve from budget-app
		const budgetResult = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');
		assert.ok(budgetResult, 'Should resolve from budget-app');

		// Resolve from shopping-app
		const shoppingResult = resolver.resolve(shoppingAppPage, '@budget-suite/shared', 'Button');
		assert.ok(shoppingResult, 'Should resolve from shopping-app');

		// Both should point to same component
		assert.strictEqual(budgetResult, shoppingResult, 'Should resolve to same component file');
	});

	it('12. Should handle scoped package names correctly', () => {
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');

		assert.ok(result, 'Should handle scoped package name @budget-suite/shared');
		assert.ok(result.includes('shared'), 'Path should include shared package directory');
	});

	it('13. Should prefer svelte condition over default in conditional exports', () => {
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');

		assert.ok(result, 'Should resolve with svelte condition');
		// The svelte condition points to src/lib/index.ts, not dist/index.js
		assert.ok(result.includes('src'), 'Should use svelte condition (src) not default (dist)');
		assert.ok(!result.includes('dist'), 'Should not use default condition (dist)');
	});
});

describe('PathResolver - Workspace GLOB Package Resolution', () => {
	let resolver: PathResolver;
	let cache: PathResolverCache;
	let fixtureRoot: string;
	let budgetAppPage: string;
	let shoppingAppPage: string;

	beforeEach(() => {
		// Initialize services
		cache = new PathResolverCache();
		const mockLogger = new MockLogger() as any;
		resolver = new PathResolver(cache, mockLogger, false); // Disable detailed logging for tests

		// Set up fixture paths
		fixtureRoot = path.join(__dirname, 'fixtures', 'pnpm-workspace-glob-project');
		budgetAppPage = path.join(
			fixtureRoot,
			'apps',
			'budget-app',
			'src',
			'routes',
			'+page.svelte'
		);
		shoppingAppPage = path.join(
			fixtureRoot,
			'apps',
			'shopping-app',
			'src',
			'routes',
			'+page.svelte'
		);
		// workspaceYaml = path.join(fixtureRoot, 'pnpm-workspace.yaml');
	});

	it('1. Should find workspace root from nested file when using GLOB pattern', () => {
		const result = resolver.resolve(
			budgetAppPage,
			'@budget-suite/shared/components/button',
			'Button'
		);
		const result2 = resolver.resolve(
			budgetAppPage,
			'@budget-suite/shared/components/core',
			'Card'
		);

		assert.ok(result, 'Should resolve workspace package');
		assert.ok(result.includes('Button.svelte'), 'Should resolve to Button.svelte');
		assert.ok(result2, 'Should resolve second workspace package');
		assert.ok(result2.includes('Card.svelte'), 'Should resolve to Card.svelte');
	});

	it('2. Should still resolve a named export when using workspaces and GLOB patterns', () => {
		const result = resolver.resolve(
			shoppingAppPage,
			'@budget-suite/shared/components/button',
			'SharedButton'
		);

		assert.ok(result, 'Should resolve workspace package');
		assert.ok(result.includes('Button.svelte'), 'Should resolve to Button.svelte');
	});

	it('3. Should not resolve when incorrect import used with workspaces and GLOB patterns', () => {
		const result = resolver.resolve(shoppingAppPage, '@budget-suite/shared', 'SharedButton');
		const result2 = resolver.resolve(
			shoppingAppPage,
			'@budget-suite/shared/components/core',
			'Cards'
		);

		assert.ok(!result, 'Should NOT resolve');
		assert.ok(result2, 'Should resolve to index file but not the component');
		assert.ok(result2.includes('index.ts'), 'Should resolve to index.ts only');
	});
});
