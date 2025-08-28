import { strict as assert } from 'assert';
import { fileMatchesPath } from './match.js';

// Helper to assert match vs not match
function expectMatch(relPath: string, patterns: string[], expected: boolean): void {
	const actual = fileMatchesPath(relPath, patterns);
	assert.equal(
		actual,
		expected,
		`Expected ${relPath} ~ ${JSON.stringify(patterns)} to be ${String(expected)}`
	);
}

// Default patterns to test
const DEFAULT = ['**/components/**'];

// Positive examples (should match)
expectMatch('src/lib/components/MainView.svelte', DEFAULT, true);
expectMatch('src/lib/components/Some/Other/Folders/Other.svelte', DEFAULT, true);
expectMatch(
	'src/Apps/MobileApp/src/lib/components/some other folder/component.svelte',
	DEFAULT,
	true
);
expectMatch('src/components/A.svelte', DEFAULT, true);
expectMatch('src/components/Folder/B.svelte', DEFAULT, true);

// Negative examples (should not match)
expectMatch('src/routes/+page.svelte', DEFAULT, false);
expectMatch('src/lib/RandomSvelteFile.svelte', DEFAULT, false);

console.log('fileMatchesPath tests passed.');
