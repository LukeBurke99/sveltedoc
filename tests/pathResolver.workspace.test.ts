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

	it('14. Should resolve component from custom barrel file name (core.ts)', () => {
		// Test resolving from 'core.ts' barrel file (not index.ts)
		// Requires barrelFileNames setting to include 'core'
		const resolverWithCore = new PathResolver(cache, new MockLogger() as any, false, 5, [
			'index',
			'main',
			'core'
		]);

		// Alert component is exported from core.ts barrel
		const result = resolverWithCore.resolve(budgetAppPage, '@budget-suite/shared', 'Alert');

		assert.ok(result, 'Should resolve Alert component from core.ts barrel');
		assert.ok(result.endsWith('Alert.svelte'), 'Should resolve to Alert.svelte');
		assert.ok(
			result.includes(path.join('components', 'Alert.svelte')),
			'Should be in components directory'
		);
	});

	it('15. Should resolve component when exported with multiple items (component + type)', () => {
		// Tests pattern: export { default as Accordion, type AccordionContext } from './Accordion.svelte';
		// This pattern exports both a component and a type from the same file
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Accordion');

		assert.ok(result, 'Should resolve Accordion component from multi-export pattern');
		assert.ok(result.endsWith('Accordion.svelte'), 'Should resolve to Accordion.svelte');
		assert.ok(
			result.includes(path.join('components', 'Accordion.svelte')),
			'Should be in components directory'
		);
	});

	it('16. Should resolve component with multiple mixed exports (component + types + functions)', () => {
		// Tests pattern: export { default as X, type Y, type Z, someFunction } from './X.svelte';
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'AccordionMixed');

		assert.ok(result, 'Should resolve component from mixed multi-export pattern');
		assert.ok(result.endsWith('Accordion.svelte'), 'Should resolve to Accordion.svelte');
		assert.ok(
			result.includes(path.join('components', 'Accordion.svelte')),
			'Should be in components directory'
		);
	});

	it('17. Should resolve component with non-standard export order (type first)', () => {
		// Tests pattern: export { type X, default as Component, someFunction } from './Component.svelte';
		// Component is NOT first in the export list
		const result = resolver.resolve(
			budgetAppPage,
			'@budget-suite/shared',
			'AccordionReordered'
		);

		assert.ok(result, 'Should resolve component when not first in export list');
		assert.ok(result.endsWith('Accordion.svelte'), 'Should resolve to Accordion.svelte');
		assert.ok(
			result.includes(path.join('components', 'Accordion.svelte')),
			'Should be in components directory'
		);
	});

	it('18. Should resolve component from multi-line export statement', () => {
		// Tests pattern with newlines:
		// export {
		//     type X,
		//     default as Component,
		//     type Y
		// } from './Component.svelte';
		const result = resolver.resolve(
			budgetAppPage,
			'@budget-suite/shared',
			'AccordionMultiLine'
		);

		assert.ok(result, 'Should resolve component from multi-line export');
		assert.ok(result.endsWith('Accordion.svelte'), 'Should resolve to Accordion.svelte');
		assert.ok(
			result.includes(path.join('components', 'Accordion.svelte')),
			'Should be in components directory'
		);
	});

	it('19. Should resolve named export (no default) from single export', () => {
		// Tests pattern: export { Input } from './Input.svelte';
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Input');

		assert.ok(result, 'Should resolve named export without default');
		assert.ok(result.endsWith('Input.svelte'), 'Should resolve to Input.svelte');
		assert.ok(
			result.includes(path.join('components', 'Input.svelte')),
			'Should be in components directory'
		);
	});

	it('20. Should resolve named export with multiple items', () => {
		// Tests pattern: export { default as Dialog, type ModalContext } from './Dialog.svelte';
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Dialog');

		assert.ok(result, 'Should resolve named export with multiple items');
		assert.ok(result.endsWith('Dialog.svelte'), 'Should resolve to Dialog.svelte');
		assert.ok(
			result.includes(path.join('components', 'Dialog.svelte')),
			'Should be in components directory'
		);
	});

	it('21. Should resolve named export with alias in mixed order', () => {
		// Tests pattern: export { type X, default as DialogReordered, show as showDialog } from './Dialog.svelte';
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'DialogReordered');

		assert.ok(result, 'Should resolve named export with alias');
		assert.ok(result.endsWith('Dialog.svelte'), 'Should resolve to Dialog.svelte');
		assert.ok(
			result.includes(path.join('components', 'Dialog.svelte')),
			'Should be in components directory'
		);
	});

	it('22. Should resolve named export from multi-line statement', () => {
		// Tests pattern:
		// export {
		//     default as DialogMultiLine,
		//     type ModalContext,
		//     hide as hideDialog
		// } from './Dialog.svelte';
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'DialogMultiLine');

		assert.ok(result, 'Should resolve named export from multi-line');
		assert.ok(result.endsWith('Dialog.svelte'), 'Should resolve to Dialog.svelte');
		assert.ok(
			result.includes(path.join('components', 'Dialog.svelte')),
			'Should be in components directory'
		);
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

describe('PathResolver - Workspace with External Package Resolution', () => {
	let resolver: PathResolver;
	let cache: PathResolverCache;
	let fixtureRoot: string;
	let myAppPage: string;
	let workspaceYaml: string;

	beforeEach(() => {
		// Initialize services
		cache = new PathResolverCache();
		const mockLogger = new MockLogger() as any;
		resolver = new PathResolver(cache, mockLogger, false); // Disable detailed logging for tests

		// Set up fixture paths
		fixtureRoot = path.join(__dirname, 'fixtures', 'pnpm-workspace-external-project');
		myAppPage = path.join(fixtureRoot, 'apps', 'my-app', 'src', 'routes', '+page.svelte');
		workspaceYaml = path.join(fixtureRoot, 'pnpm-workspace.yaml');
	});

	// ==================== Internal Package Tests (simple names) ====================

	it('1. Should resolve internal package with simple name (luke-core-library)', () => {
		const result = resolver.resolve(myAppPage, 'luke-core-library', 'InputField');

		assert.ok(result, 'Should resolve simple-named workspace package');
		assert.ok(result.endsWith('InputField.svelte'), 'Should resolve to InputField.svelte');
	});

	it('2. Should resolve AuthGuard component from simple-named package', () => {
		const result = resolver.resolve(myAppPage, 'luke-core-library', 'AuthGuard');

		assert.ok(result, 'Should resolve AuthGuard component');
		assert.ok(result.endsWith('AuthGuard.svelte'), 'Should resolve to AuthGuard.svelte');
		assert.ok(
			result.includes(path.join('components', 'AuthGuard.svelte')),
			'Should be in components directory'
		);
	});

	it('3. Should resolve from subpath export (luke-core-library/components)', () => {
		const result = resolver.resolve(myAppPage, 'luke-core-library/components', 'InputField');

		assert.ok(result, 'Should resolve from subpath export');
		assert.ok(result.endsWith('InputField.svelte'), 'Should resolve to InputField.svelte');
	});

	it('4. Should cache simple-named package and reuse it', () => {
		// First resolution
		const result1 = resolver.resolve(myAppPage, 'luke-core-library', 'InputField');
		assert.ok(result1, 'First resolution should succeed');

		// Second resolution should use cache
		const result2 = resolver.resolve(myAppPage, 'luke-core-library', 'AuthGuard');
		assert.ok(result2, 'Second resolution should succeed');

		// Both should be from same package
		assert.ok(result1.includes('luke-core-library'), 'First should be from luke-core-library');
		assert.ok(result2.includes('luke-core-library'), 'Second should be from luke-core-library');
	});

	// ==================== External Package Tests (../path reference) ====================

	it('5. Should resolve external package referenced via relative path', () => {
		const result = resolver.resolve(
			myAppPage,
			'@budget-suite/shared/components/button',
			'Button'
		);

		assert.ok(result, 'Should resolve external workspace package');
		assert.ok(result.endsWith('Button.svelte'), 'Should resolve to Button.svelte');
	});

	it('6. Should resolve external package to correct physical path', () => {
		const result = resolver.resolve(
			myAppPage,
			'@budget-suite/shared/components/button',
			'Button'
		);

		assert.ok(result, 'Should resolve external package');
		// The resolved path should be in the external fixture (pnpm-workspace-glob-project)
		assert.ok(
			result.includes('pnpm-workspace-glob-project'),
			'Should resolve to path in external project'
		);
		assert.ok(
			result.includes(path.join('packages', 'shared')),
			'Should be in external shared package'
		);
	});

	it('7. Should resolve Card component from external package nested barrel', () => {
		const result = resolver.resolve(myAppPage, '@budget-suite/shared/components/core', 'Card');

		assert.ok(result, 'Should resolve Card from external package');
		assert.ok(result.endsWith('Card.svelte'), 'Should resolve to Card.svelte');
		assert.ok(result.includes('pnpm-workspace-glob-project'), 'Should be in external project');
	});

	it('8. Should handle both internal and external packages in same workspace', () => {
		// Resolve internal package
		const internalResult = resolver.resolve(myAppPage, 'luke-core-library', 'InputField');
		assert.ok(internalResult, 'Should resolve internal package');
		assert.ok(
			internalResult.includes('pnpm-workspace-external-project'),
			'Internal should be in current project'
		);

		// Resolve external package
		const externalResult = resolver.resolve(
			myAppPage,
			'@budget-suite/shared/components/button',
			'Button'
		);
		assert.ok(externalResult, 'Should resolve external package');
		assert.ok(
			externalResult.includes('pnpm-workspace-glob-project'),
			'External should be in external project'
		);
	});

	it('9. Should return undefined for non-existent package', () => {
		const result = resolver.resolve(myAppPage, 'non-existent-package', 'Component');

		assert.strictEqual(result, undefined, 'Should return undefined for non-existent package');
	});

	it('10. Should invalidate cache and still resolve external packages', () => {
		// Initial resolution
		const result1 = resolver.resolve(
			myAppPage,
			'@budget-suite/shared/components/button',
			'Button'
		);
		assert.ok(result1, 'Initial resolution should succeed');

		// Invalidate workspace cache
		resolver.invalidateWorkspace(workspaceYaml);

		// Resolution should still work after invalidation
		const result2 = resolver.resolve(
			myAppPage,
			'@budget-suite/shared/components/button',
			'Button'
		);
		assert.ok(result2, 'Resolution after invalidation should succeed');
		assert.strictEqual(result1, result2, 'Should resolve to same path after re-parsing');
	});

	it('11. Should correctly normalize relative paths for external packages', () => {
		const result = resolver.resolve(
			myAppPage,
			'@budget-suite/shared/components/button',
			'Button'
		);

		assert.ok(result, 'Should resolve external package');
		// Path should be normalized (no .. segments in final path)
		assert.ok(!result.includes('..'), 'Resolved path should be normalized (no ..)');
		// Should be an absolute path
		assert.ok(path.isAbsolute(result), 'Should be an absolute path');
	});
});

describe('PathResolver - Deep Barrel File Resolution', () => {
	let resolver: PathResolver;
	let cache: PathResolverCache;
	let fixtureRoot: string;
	let budgetStatisticPage: string;

	beforeEach(() => {
		// Initialize services
		cache = new PathResolverCache();
		const mockLogger = new MockLogger() as any;
		resolver = new PathResolver(cache, mockLogger, false); // Disable detailed logging for tests

		// Set up fixture paths
		fixtureRoot = path.join(__dirname, 'fixtures', 'pnpm-workspace-project');
		budgetStatisticPage = path.join(
			fixtureRoot,
			'code',
			'budget-app',
			'src',
			'lib',
			'components',
			'specific',
			'BudgetStatistic.svelte'
		);
	});

	it('1. Should resolve Statistic component through multiple barrel levels', () => {
		// Statistic.svelte is at: code/shared/src/lib/components/widgets/Statistic.svelte
		// Resolution path: index.ts -> components/index.ts -> widgets/Statistic.svelte
		const result = resolver.resolve(budgetStatisticPage, '@budget-suite/shared', 'Statistic');

		assert.ok(result, 'Should resolve Statistic component');
		assert.ok(result.endsWith('Statistic.svelte'), 'Should resolve to Statistic.svelte');
		assert.ok(
			result.includes(path.join('components', 'widgets', 'Statistic.svelte')),
			'Should be in components/widgets directory'
		);
	});
});

describe('PathResolver - Barrel Priority Sorting', () => {
	let resolver: PathResolver;
	let cache: PathResolverCache;
	let fixtureRoot: string;
	let budgetAppPage: string;

	beforeEach(() => {
		// Initialize services with custom priority
		cache = new PathResolverCache();
		const mockLogger = new MockLogger() as any;
		// Set priority to components first, then features
		resolver = new PathResolver(
			cache,
			mockLogger,
			false,
			5,
			['index', 'main'],
			['components', 'features']
		);

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
	});

	it('1. Should prioritize components folder over other folders', () => {
		// The huge index.ts has many export * from statements
		// With priority set to ['components'], components paths should be tried first
		// This test verifies that Button (in components) is found without searching actions/features first
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Button');

		assert.ok(result, 'Should resolve Button component');
		assert.ok(result.endsWith('Button.svelte'), 'Should resolve to Button.svelte');
		assert.ok(result.includes('components'), 'Should be in components directory');
	});

	it('2. Should still find components in non-priority folders', () => {
		// Even with priority set, components in other folders should still be found
		// They're just tried after the priority folders
		const result = resolver.resolve(budgetAppPage, '@budget-suite/shared', 'Card');

		assert.ok(result, 'Should resolve Card component');
		assert.ok(result.endsWith('Card.svelte'), 'Should resolve to Card.svelte');
	});

	it('3. Should work with empty priority list (original order)', () => {
		const resolverNoPriority = new PathResolver(
			cache,
			new MockLogger() as any,
			false,
			5,
			['index', 'main'],
			[] // Empty priority list
		);

		const result = resolverNoPriority.resolve(budgetAppPage, '@budget-suite/shared', 'Button');

		assert.ok(result, 'Should still resolve Button without priority');
		assert.ok(result.endsWith('Button.svelte'), 'Should resolve to Button.svelte');
	});

	it('4. Should support path-style priority like ui/components', () => {
		const resolverWithPath = new PathResolver(
			cache,
			new MockLogger() as any,
			false,
			5,
			['index', 'main'],
			['ui/components', 'components'] // Path-style priority
		);

		const result = resolverWithPath.resolve(budgetAppPage, '@budget-suite/shared', 'Button');

		assert.ok(result, 'Should resolve with path-style priority');
		assert.ok(result.endsWith('Button.svelte'), 'Should resolve to Button.svelte');
	});
});
