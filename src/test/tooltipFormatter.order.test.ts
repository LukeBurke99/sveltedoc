import * as assert from 'assert';
import { PropInfo } from '../types';
import { sortProps } from '../utils/propSorting';

/**
 * Test tooltip ordering modes: normal, alphabetical, required, type
 */
describe('PropSorting - Ordering Modes', () => {
	// Sample props in a specific declaration order for testing
	const sampleProps: PropInfo[] = [
		{ name: 'zebra', type: 'string', required: false, bindable: false },
		{ name: 'alpha', type: 'number', required: true, bindable: false },
		{ name: 'beta', type: 'boolean', required: false, bindable: false },
		{ name: 'gamma', type: 'string', required: true, bindable: false },
		{ name: 'delta', type: '() => void', required: false, bindable: false }
	];

	describe('1. Normal Order (Declaration Order)', () => {
		it('should preserve the original declaration order', () => {
			const sorted = sortProps(sampleProps, 'normal');

			// Verify they appear in declaration order
			assert.strictEqual(sorted[0].name, 'zebra');
			assert.strictEqual(sorted[1].name, 'alpha');
			assert.strictEqual(sorted[2].name, 'beta');
			assert.strictEqual(sorted[3].name, 'gamma');
			assert.strictEqual(sorted[4].name, 'delta');
		});
	});

	describe('2. Alphabetical Order', () => {
		it('should sort props alphabetically by name', () => {
			const sorted = sortProps(sampleProps, 'alphabetical');

			// Verify alphabetical order: alpha, beta, delta, gamma, zebra
			assert.strictEqual(sorted[0].name, 'alpha');
			assert.strictEqual(sorted[1].name, 'beta');
			assert.strictEqual(sorted[2].name, 'delta');
			assert.strictEqual(sorted[3].name, 'gamma');
			assert.strictEqual(sorted[4].name, 'zebra');
		});
	});

	describe('3. Required First Order', () => {
		it('should show required props first, then optional (alphabetically within groups)', () => {
			const sorted = sortProps(sampleProps, 'required');

			// Required props: alpha (number), gamma (string)
			// Optional props: beta (boolean), delta (function), zebra (string)

			// First two should be required (alphabetically: alpha, gamma)
			assert.strictEqual(sorted[0].name, 'alpha');
			assert.strictEqual(sorted[0].required, true);
			assert.strictEqual(sorted[1].name, 'gamma');
			assert.strictEqual(sorted[1].required, true);

			// Next three should be optional (alphabetically: beta, delta, zebra)
			assert.strictEqual(sorted[2].name, 'beta');
			assert.strictEqual(sorted[2].required, false);
			assert.strictEqual(sorted[3].name, 'delta');
			assert.strictEqual(sorted[3].required, false);
			assert.strictEqual(sorted[4].name, 'zebra');
			assert.strictEqual(sorted[4].required, false);
		});
	});

	describe('4. Type-Based Order', () => {
		it('should group by type category: primitives → custom → arrays → objects → functions', () => {
			const typedProps: PropInfo[] = [
				{ name: 'func', type: '() => void', required: false, bindable: false },
				{ name: 'str', type: 'string', required: false, bindable: false },
				{ name: 'obj', type: '{ a: number }', required: false, bindable: false },
				{ name: 'num', type: 'number', required: false, bindable: false },
				{ name: 'arr', type: 'string[]', required: false, bindable: false },
				{ name: 'bool', type: 'boolean', required: false, bindable: false },
				{ name: 'custom', type: 'MyType', required: false, bindable: false }
			];

			const sorted = sortProps(typedProps, 'type');

			// Expected order: primitives (str, num, bool), custom (MyType), array, object, function
			assert.strictEqual(sorted[0].name, 'str'); // string primitive
			assert.strictEqual(sorted[1].name, 'num'); // number primitive
			assert.strictEqual(sorted[2].name, 'bool'); // boolean primitive
			assert.strictEqual(sorted[3].name, 'custom'); // custom type
			assert.strictEqual(sorted[4].name, 'arr'); // array
			assert.strictEqual(sorted[5].name, 'obj'); // object
			assert.strictEqual(sorted[6].name, 'func'); // function
		});

		it('should handle union types as complex objects', () => {
			const unionProps: PropInfo[] = [
				{ name: 'simple', type: 'string', required: false, bindable: false },
				{ name: 'union', type: 'string | number', required: false, bindable: false },
				{ name: 'func', type: '() => void', required: false, bindable: false }
			];

			const sorted = sortProps(unionProps, 'type');

			// Primitives (string) → Objects (union) → Functions
			assert.strictEqual(sorted[0].name, 'simple');
			assert.strictEqual(sorted[1].name, 'union');
			assert.strictEqual(sorted[2].name, 'func');
		});

		it('should handle generics as complex objects', () => {
			const genericProps: PropInfo[] = [
				{ name: 'num', type: 'number', required: false, bindable: false },
				{ name: 'promise', type: 'Promise<string>', required: false, bindable: false },
				{ name: 'arr', type: 'Array<number>', required: false, bindable: false }
			];

			const sorted = sortProps(genericProps, 'type');

			// Primitives (number) → Arrays (Array<>) → Objects (Promise<>)
			assert.strictEqual(sorted[0].name, 'num');
			assert.strictEqual(sorted[1].name, 'arr');
			assert.strictEqual(sorted[2].name, 'promise');
		});

		it('should handle tuples as arrays', () => {
			const tupleProps: PropInfo[] = [
				{ name: 'str', type: 'string', required: false, bindable: false },
				{ name: 'tuple', type: '[string, number]', required: false, bindable: false },
				{ name: 'func', type: '() => void', required: false, bindable: false }
			];

			const sorted = sortProps(tupleProps, 'type');

			// Primitives → Arrays (tuples) → Functions
			assert.strictEqual(sorted[0].name, 'str');
			assert.strictEqual(sorted[1].name, 'tuple');
			assert.strictEqual(sorted[2].name, 'func');
		});

		it('should sort primitives in specified order', () => {
			const primitiveProps: PropInfo[] = [
				{ name: 'sym', type: 'symbol', required: false, bindable: false },
				{ name: 'bool', type: 'boolean', required: false, bindable: false },
				{ name: 'num', type: 'number', required: false, bindable: false },
				{ name: 'str', type: 'string', required: false, bindable: false },
				{ name: 'nil', type: 'null', required: false, bindable: false },
				{ name: 'undef', type: 'undefined', required: false, bindable: false }
			];

			const sorted = sortProps(primitiveProps, 'type');

			// Expected order: string, number, boolean, null, undefined, symbol
			assert.strictEqual(sorted[0].name, 'str');
			assert.strictEqual(sorted[1].name, 'num');
			assert.strictEqual(sorted[2].name, 'bool');
			assert.strictEqual(sorted[3].name, 'nil');
			assert.strictEqual(sorted[4].name, 'undef');
			assert.strictEqual(sorted[5].name, 'sym');
		});

		it('should handle function types with various syntaxes', () => {
			const funcProps: PropInfo[] = [
				{ name: 'str', type: 'string', required: false, bindable: false },
				{ name: 'arrow', type: '(x: number) => void', required: false, bindable: false },
				{ name: 'func', type: 'Function', required: false, bindable: false }
			];

			const sorted = sortProps(funcProps, 'type');

			// Primitives should come before all functions
			assert.strictEqual(sorted[0].name, 'str');
			// Functions can be in any order (both are functions)
			assert.ok(sorted[1].name === 'arrow' || sorted[1].name === 'func');
			assert.ok(sorted[2].name === 'arrow' || sorted[2].name === 'func');
		});
	});

	describe('5. Edge Cases', () => {
		it('should handle empty props array', () => {
			const sorted = sortProps([], 'normal');
			assert.strictEqual(sorted.length, 0);
		});

		it('should handle single prop', () => {
			const singleProp: PropInfo[] = [
				{ name: 'solo', type: 'string', required: true, bindable: false }
			];
			const sorted = sortProps(singleProp, 'alphabetical');
			assert.strictEqual(sorted.length, 1);
			assert.strictEqual(sorted[0].name, 'solo');
		});

		it('should not mutate original props array', () => {
			const original = [...sampleProps];
			sortProps(sampleProps, 'alphabetical');

			// Verify original array unchanged
			assert.deepStrictEqual(sampleProps, original);
		});
	});
});
