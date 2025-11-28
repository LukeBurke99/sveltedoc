import * as assert from 'assert';
import * as path from 'path';
import { PathResolverCache } from '../src/classes/caches/PathResolverCache';
import { PathResolver } from '../src/utils/pathResolver';

// Mock LoggingService for tests (avoid vscode dependency)
class MockLogger {
	public logResolverMessage(): void {
		// No-op for tests
	}
}

describe('PathResolver: Path Alias Resolution', () => {
	let resolver: PathResolver;
	let cache: PathResolverCache;
	const fixturePath = path.join(__dirname, 'fixtures', 'path-alias-project');
	const appFile = path.join(fixturePath, 'src', 'App.svelte');

	beforeEach(() => {
		// Create cache and resolver with mock logger and logging disabled
		cache = new PathResolverCache();
		const mockLogger = new MockLogger() as any;
		resolver = new PathResolver(cache, mockLogger, false);
	});

	it('1. Should resolve $lib alias to src/lib', () => {
		const specifier = '$lib/components/Button.svelte';
		const resolved = resolver.resolve(appFile, specifier);

		const expectedPath = path.join(fixturePath, 'src', 'lib', 'components', 'Button.svelte');
		// Normalize paths for comparison (handle forward slash vs backslash)
		assert.strictEqual(path.normalize(resolved ?? ''), path.normalize(expectedPath));
	});

	it('2. Should resolve @components alias to src/lib/components', () => {
		const specifier = '@components/Card.svelte';
		const resolved = resolver.resolve(appFile, specifier);

		const expectedPath = path.join(fixturePath, 'src', 'lib', 'components', 'Card.svelte');
		assert.strictEqual(path.normalize(resolved ?? ''), path.normalize(expectedPath));
	});

	it('3. Should resolve relative paths', () => {
		// Create a test file that references a relative path
		const testFile = path.join(fixturePath, 'src', 'lib', 'components', 'Card.svelte');
		const specifier = './Button.svelte';
		const resolved = resolver.resolve(testFile, specifier);

		const expectedPath = path.join(fixturePath, 'src', 'lib', 'components', 'Button.svelte');
		// Should resolve relative paths now
		assert.strictEqual(path.normalize(resolved ?? ''), path.normalize(expectedPath));
	});

	it('4. Should return undefined for non-matching alias', () => {
		const specifier = '$nonexistent/Button.svelte';
		const resolved = resolver.resolve(appFile, specifier);

		assert.strictEqual(resolved, undefined);
	});

	it('5. Should return undefined if tsconfig.json does not exist', () => {
		const noConfigFile = path.join(__dirname, 'fixtures', 'no-config', 'App.svelte');
		const specifier = '$lib/Button.svelte';
		const resolved = resolver.resolve(noConfigFile, specifier);

		assert.strictEqual(resolved, undefined);
	});

	it('6. Should resolve alias without file extension', () => {
		const specifier = '$lib/components/Button';
		const resolved = resolver.resolve(appFile, specifier);

		const expectedPath = path.join(fixturePath, 'src', 'lib', 'components', 'Button.svelte');
		assert.strictEqual(path.normalize(resolved ?? ''), path.normalize(expectedPath));
	});

	it('7. Should return undefined if file does not exist at resolved path', () => {
		const specifier = '$lib/components/NonExistent.svelte';
		const resolved = resolver.resolve(appFile, specifier);

		assert.strictEqual(resolved, undefined);
	});

	it('8. Cache should be invalidated when clearCache is called', () => {
		// First resolution (caches tsconfig)
		const specifier = '$lib/components/Button.svelte';
		const resolved1 = resolver.resolve(appFile, specifier);
		assert.ok(resolved1);

		// Clear cache via the cache instance
		cache.clear();

		// Second resolution (should re-read tsconfig)
		const resolved2 = resolver.resolve(appFile, specifier);
		assert.strictEqual(resolved1, resolved2);
	});
});
