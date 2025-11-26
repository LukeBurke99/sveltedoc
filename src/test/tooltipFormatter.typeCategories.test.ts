import * as assert from 'assert';
import { categorizeType, getPrimitiveOrder } from '../utils/propSorting';

/**
 * Test type categorization logic used in 'type' ordering mode.
 * Tests the categorizeType and getPrimitiveOrder functions.
 */
describe('PropSorting - Type Categorization', () => {
	// Category constants (matching propSorting.ts internal values)
	const PRIMITIVE = 0;
	const CUSTOM = 1;
	const ARRAY = 2;
	const OBJECT = 3;
	const FUNCTION = 4;

	describe('1. Primitive Type Detection', () => {
		it('should recognize all primitive types', () => {
			assert.strictEqual(categorizeType('string'), PRIMITIVE);
			assert.strictEqual(categorizeType('number'), PRIMITIVE);
			assert.strictEqual(categorizeType('boolean'), PRIMITIVE);
			assert.strictEqual(categorizeType('null'), PRIMITIVE);
			assert.strictEqual(categorizeType('undefined'), PRIMITIVE);
			assert.strictEqual(categorizeType('symbol'), PRIMITIVE);
			assert.strictEqual(categorizeType('bigint'), PRIMITIVE);
		});

		it('should be case-insensitive for primitive detection', () => {
			assert.strictEqual(categorizeType('string'), PRIMITIVE);
			assert.strictEqual(categorizeType('STRING'), PRIMITIVE);
			assert.strictEqual(categorizeType('String'), PRIMITIVE);
			assert.strictEqual(categorizeType('  string  '), PRIMITIVE);
		});

		it('should return correct primitive order', () => {
			// Expected order: string, number, boolean, null, undefined, symbol, bigint
			assert.strictEqual(getPrimitiveOrder('string'), 0);
			assert.strictEqual(getPrimitiveOrder('number'), 1);
			assert.strictEqual(getPrimitiveOrder('boolean'), 2);
			assert.strictEqual(getPrimitiveOrder('null'), 3);
			assert.strictEqual(getPrimitiveOrder('undefined'), 4);
			assert.strictEqual(getPrimitiveOrder('symbol'), 5);
			assert.strictEqual(getPrimitiveOrder('bigint'), 6);
		});

		it('should return -1 for non-primitive types', () => {
			assert.strictEqual(getPrimitiveOrder('MyType'), -1);
			assert.strictEqual(getPrimitiveOrder('string[]'), -1);
			assert.strictEqual(getPrimitiveOrder('() => void'), -1);
		});
	});

	describe('2. Function Type Detection', () => {
		it('should detect arrow function types', () => {
			assert.strictEqual(categorizeType('() => void'), FUNCTION);
			assert.strictEqual(categorizeType('(x: number) => string'), FUNCTION);
			assert.strictEqual(categorizeType('(a: string, b: number) => boolean'), FUNCTION);
		});

		it('should detect function types starting with parentheses', () => {
			assert.strictEqual(categorizeType('(x: number) => void'), FUNCTION);
			assert.strictEqual(categorizeType('  (x: string) => boolean'), FUNCTION);
		});

		it('should handle complex function signatures', () => {
			assert.strictEqual(
				categorizeType('<T>(value: T, context: { field: string }) => Promise<T>'),
				FUNCTION
			);
		});
	});

	describe('3. Array Type Detection', () => {
		it('should detect bracket-notation arrays', () => {
			assert.strictEqual(categorizeType('string[]'), ARRAY);
			assert.strictEqual(categorizeType('number[][]'), ARRAY);
			assert.strictEqual(categorizeType('[string, number]'), ARRAY);
		});

		it('should detect Array<T> generic notation', () => {
			assert.strictEqual(categorizeType('Array<string>'), ARRAY);
			assert.strictEqual(categorizeType('Array<number>'), ARRAY);
			assert.strictEqual(categorizeType('Array<{ id: number; name: string }>'), ARRAY);
		});

		it('should treat tuples as arrays', () => {
			assert.strictEqual(categorizeType('[string, number]'), ARRAY);
			assert.strictEqual(categorizeType('[boolean, string, number]'), ARRAY);
		});
	});

	describe('4. Object/Complex Type Detection', () => {
		it('should detect object literal types', () => {
			assert.strictEqual(categorizeType('{ a: number }'), OBJECT);
			assert.strictEqual(categorizeType('{ x: string; y: number }'), OBJECT);
		});

		it('should treat union types as complex objects', () => {
			assert.strictEqual(categorizeType('string | number'), OBJECT);
			assert.strictEqual(categorizeType('boolean | null | undefined'), OBJECT);
		});

		it('should treat generic types as complex objects', () => {
			assert.strictEqual(categorizeType('Promise<string>'), OBJECT);
			assert.strictEqual(categorizeType('Record<string, any>'), OBJECT);
		});

		it('should distinguish Promise from Array', () => {
			assert.strictEqual(categorizeType('Array<number>'), ARRAY);
			assert.strictEqual(categorizeType('Promise<number>'), OBJECT);
		});
	});

	describe('5. Custom Type Detection', () => {
		it('should place simple custom types in CUSTOM category', () => {
			assert.strictEqual(categorizeType('MyType'), CUSTOM);
			assert.strictEqual(categorizeType('UserData'), CUSTOM);
			assert.strictEqual(categorizeType('IInterface'), CUSTOM);
			assert.strictEqual(categorizeType('TGeneric'), CUSTOM);
		});

		it('should distinguish custom types from primitives', () => {
			assert.strictEqual(categorizeType('string'), PRIMITIVE);
			assert.strictEqual(categorizeType('MyString'), CUSTOM);
			assert.strictEqual(categorizeType('NumberType'), CUSTOM);
		});
	});

	describe('6. Category Ordering', () => {
		it('should categorize mixed types correctly', () => {
			const types = [
				{ type: '() => void', expected: FUNCTION },
				{ type: '{ x: number }', expected: OBJECT },
				{ type: 'string[]', expected: ARRAY },
				{ type: 'MyType', expected: CUSTOM },
				{ type: 'number', expected: PRIMITIVE }
			];

			for (const { type, expected } of types)
				assert.strictEqual(categorizeType(type), expected, `Failed for type: ${type}`);
		});
	});
});
