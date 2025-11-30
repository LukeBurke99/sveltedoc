import * as assert from 'assert';
import { parsePropsFromScriptBlocks } from '../src/parsers/propParser';
import { ScriptBlock } from '../src/types';

// Test normalization settings - set to true for consistent test behavior
const TEST_NORMALISE_COMMENT = true;
const TEST_NORMALISE_TYPE = true;
const TEST_NORMALISE_DEFAULT_VALUE = true;

/**
 * Run the same tests for Types and Interfaces and expect identical results.
 */
describe('Prop Parser (Extracting the correct Types/Interfaces)', () => {
	it('1. Simple definition', () => {
		const blocks: ScriptBlock[] = [
			{
				content: 'type Props = { active: boolean; }',
				attributes: {}
			},
			{
				content: 'interface Props { active: boolean; }',
				attributes: {}
			}
		];
		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'active');
			assert.strictEqual(result.props[0].type, 'boolean');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.inherits.length, 0);
		});
	});

	it('2. Single intersection/extend', () => {
		const blocks: ScriptBlock[] = [
			{
				content: 'type Props = ParentProps & { active: boolean; }',
				attributes: {}
			},
			{
				content: 'interface Props extends ParentProps { active: boolean; }',
				attributes: {}
			}
		];
		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'active');
			assert.strictEqual(result.props[0].type, 'boolean');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.inherits.length, 1);
			assert.strictEqual(result.inherits[0], 'ParentProps');
		});
	});

	it('3. Multiple intersections/extends', () => {
		const blocks: ScriptBlock[] = [
			{
				content: 'type Props = Parent1 & Parent2 & { value: string; }',
				attributes: {}
			},
			{
				content: 'interface Props extends Parent1, Parent2 { value: string; }',
				attributes: {}
			}
		];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'value');
			assert.strictEqual(result.props[0].type, 'string');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.inherits.length, 2);
			assert.strictEqual(result.inherits[0], 'Parent1');
			assert.strictEqual(result.inherits[1], 'Parent2');
		});
	});

	it('4. Single intersection/extend and generics', () => {
		const blocks: ScriptBlock[] = [
			{
				content: 'type Props = ParentProps<SomeType> & { id: number; }',
				attributes: {}
			},
			{
				content: 'interface Props extends ParentProps<SomeType> { id: number; }',
				attributes: {}
			}
		];
		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'id');
			assert.strictEqual(result.props[0].type, 'number');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.inherits.length, 1);
			assert.strictEqual(result.inherits[0], 'ParentProps<SomeType>');
		});
	});

	it('5. Multiple intersections/extends and generics', () => {
		const blocks: ScriptBlock[] = [
			{
				content:
					'type Props = ParentProps<SomeType> & Pick<AnotherType, "prop1" | "prop2"> & { id: number; } ',
				attributes: {}
			},
			{
				content:
					'interface Props extends ParentProps<SomeType>, Pick<AnotherType, "prop1" | "prop2"> { id: number; }',
				attributes: {}
			}
		];
		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'id');
			assert.strictEqual(result.props[0].type, 'number');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.inherits.length, 2);
			assert.strictEqual(result.inherits[0], 'ParentProps<SomeType>');
			assert.strictEqual(result.inherits[1], 'Pick<AnotherType, "prop1" | "prop2">');
		});
	});

	it('6. Simple with multiple properties', () => {
		const blocks: ScriptBlock[] = [
			{
				content: `type Props = {
					name: string;
					age: number;
					active?: boolean;
					color: "red" | "green" | "blue";
				} `,
				attributes: {}
			},
			{
				content: `interface Props {
					name: string;
					age: number;
					active?: boolean;
					color: "red" | "green" | "blue";
				} `,
				attributes: {}
			}
		];
		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 4);

			const nameProp = result.props.find((p) => p.name === 'name');
			assert.ok(nameProp);
			assert.strictEqual(nameProp.type, 'string');
			assert.strictEqual(nameProp.required, true);

			const ageProp = result.props.find((p) => p.name === 'age');
			assert.ok(ageProp);
			assert.strictEqual(ageProp.type, 'number');
			assert.strictEqual(ageProp.required, true);

			const activeProp = result.props.find((p) => p.name === 'active');
			assert.ok(activeProp);
			assert.strictEqual(activeProp.type, 'boolean');
			assert.strictEqual(activeProp.required, false);

			const colorProp = result.props.find((p) => p.name === 'color');
			assert.ok(colorProp);
			assert.strictEqual(colorProp.type, '"red" | "green" | "blue"');
			assert.strictEqual(colorProp.required, true);
		});
	});

	it('7. Types defined in separate script blocks', () => {
		const blocks: ScriptBlock[] = [
			{ content: 'type Props = { count: number; };', attributes: {} },
			{ content: 'interface Props { count: number; }', attributes: {} }
		];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'count');
			assert.strictEqual(result.props[0].type, 'number');
			assert.strictEqual(result.props[0].required, true);
		});
	});

	it('8. No $props() found - returns empty props', () => {
		const blocks: ScriptBlock[] = [
			{ content: 'type Props = { name: string; };', attributes: {} },
			{ content: 'interface Props { name: string; }', attributes: {} }
		];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 0);
			assert.strictEqual(result.inherits.length, 0);
		});
	});

	it('9. No type annotation on $props() - returns empty props', () => {
		const blocks: ScriptBlock[] = [
			{ content: 'const { ...rest } = $props();', attributes: {} },
			{ content: 'let props = $props();', attributes: {} }
		];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 0);
			assert.strictEqual(result.inherits.length, 0);
		});
	});

	it('10. Multiple script blocks with inheritance', () => {
		const blocks: ScriptBlock[] = [
			{ content: 'type Props = BaseProps & { id: string; };', attributes: {} },

			{ content: 'interface Props extends BaseProps { id: string; }', attributes: {} }
		];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'id');
			assert.strictEqual(result.props[0].type, 'string');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.inherits.length, 1);
			assert.strictEqual(result.inherits[0], 'BaseProps');
		});
	});

	it('11. Multiple types but only one assigned to $props()', () => {
		const blocks: ScriptBlock[] = [
			{
				content: `
					type PropsA = { name: string; };
					type PropsB = { age: number; };
				`,
				attributes: {}
			},
			{
				content: `
					interface PropsA { name: string; }
					interface PropsB { age: number; }
				`,
				attributes: {}
			}
		];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest }: PropsA = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'name');
			assert.strictEqual(result.props[0].type, 'string');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.inherits.length, 0, 'PropsB should not be in inherits');
		});
	});

	it('12. Multiple types with union and intersection on $props()', () => {
		const blocks: ScriptBlock[] = [
			{
				content: `
					type TypeA = { name: string; };
					type TypeB = { age: number; };
				`,
				attributes: {}
			},
			{
				content: `
					interface TypeA { name: string; }
					interface TypeB { age: number; }
				`,
				attributes: {}
			}
		];

		// Test both union and intersection
		['|', '&'].forEach((operator) => {
			blocks.forEach((block) => {
				const result = parsePropsFromScriptBlocks(
					[
						block,
						{
							content: `const { ...rest }: TypeA ${operator} TypeB = $props();`,
							attributes: {}
						}
					],
					TEST_NORMALISE_COMMENT,
					TEST_NORMALISE_TYPE,
					TEST_NORMALISE_DEFAULT_VALUE
				);

				assert.strictEqual(result.props.length, 2);

				const nameProp = result.props.find((p) => p.name === 'name');
				assert.ok(nameProp);
				assert.strictEqual(nameProp.type, 'string');
				assert.strictEqual(nameProp.required, true);

				const ageProp = result.props.find((p) => p.name === 'age');
				assert.ok(ageProp);
				assert.strictEqual(ageProp.type, 'number');
				assert.strictEqual(ageProp.required, true);

				assert.strictEqual(result.inherits.length, 0);
			});
		});
	});

	it('13. Local type with imported types on $props()', () => {
		const blocks: ScriptBlock[] = [
			{
				content: `
					import type { ImportedTypeA, ImportedTypeB } from './somewhere';
					type LocalProps = {
						id: string;
						count: number;
					};
				`,
				attributes: {}
			},
			{
				content: `
					import type { ImportedTypeA, ImportedTypeB } from './somewhere';
					interface LocalProps {
						id: string;
						count: number;
					}
				`,
				attributes: {}
			}
		];

		['|', '&'].forEach((operator) => {
			blocks.forEach((block) => {
				const result = parsePropsFromScriptBlocks(
					[
						block,
						{
							content: `const { ...rest }: LocalProps ${operator} ImportedTypeA ${operator} ImportedTypeB = $props();`,
							attributes: {}
						}
					],
					TEST_NORMALISE_COMMENT,
					TEST_NORMALISE_TYPE,
					TEST_NORMALISE_DEFAULT_VALUE
				);

				assert.strictEqual(result.props.length, 2);

				const idProp = result.props.find((p) => p.name === 'id');
				assert.ok(idProp);
				assert.strictEqual(idProp.type, 'string');
				assert.strictEqual(idProp.required, true);

				const countProp = result.props.find((p) => p.name === 'count');
				assert.ok(countProp);
				assert.strictEqual(countProp.type, 'number');
				assert.strictEqual(countProp.required, true);

				assert.strictEqual(result.inherits.length, 2);
				assert.ok(result.inherits.includes('ImportedTypeA'));
				assert.ok(result.inherits.includes('ImportedTypeB'));
			});
		});
	});

	it('14. Single-line type definition with multiple properties', () => {
		const blocks: ScriptBlock[] = [
			{
				content: 'type Props = { name: string; age: number; active?: boolean; };',
				attributes: {}
			},
			{
				content: 'interface Props { name: string; age: number; active?: boolean; }',
				attributes: {}
			}
		];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest } : Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 3);

			const nameProp = result.props.find((p) => p.name === 'name');
			assert.ok(nameProp);
			assert.strictEqual(nameProp.type, 'string');
			assert.strictEqual(nameProp.required, true);

			const ageProp = result.props.find((p) => p.name === 'age');
			assert.ok(ageProp);
			assert.strictEqual(ageProp.type, 'number');
			assert.strictEqual(ageProp.required, true);

			const activeProp = result.props.find((p) => p.name === 'active');
			assert.ok(activeProp);
			assert.strictEqual(activeProp.type, 'boolean');
			assert.strictEqual(activeProp.required, false);
		});
	});

	it('15. Single-line type definition with multiple properties and missing colons/semi-colons', () => {
		const blocks: ScriptBlock[] = [
			{
				content: 'type Props = { name: string; age: number; active?: boolean }',
				attributes: {}
			},
			{
				content: 'interface Props { name: string; age: number; active?: boolean }',
				attributes: {}
			}
		];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[
					block,
					{
						content: `
						let {
							name,
							age,
							active,
							...rest
						} : Props = $props()
					`,
						attributes: {}
					}
				],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 3);

			const nameProp = result.props.find((p) => p.name === 'name');
			assert.ok(nameProp);
			assert.strictEqual(nameProp.type, 'string');
			assert.strictEqual(nameProp.required, true);

			const ageProp = result.props.find((p) => p.name === 'age');
			assert.ok(ageProp);
			assert.strictEqual(ageProp.type, 'number');
			assert.strictEqual(ageProp.required, true);

			const activeProp = result.props.find((p) => p.name === 'active');
			assert.ok(activeProp);
			assert.strictEqual(activeProp.type, 'boolean');
			assert.strictEqual(activeProp.required, false);
		});
	});

	it('16. Complex type with diverse property types and JSDoc comments', () => {
		const typeContent = `type Props = {
			/** Simple required string identifier */
			id: string;
			/** Optional count value for tracking */
			count?: number;
			isActive: boolean;
			/**
			 * A detailed description that spans multiple lines
			 * to test multi-line comment parsing properly.
			 */
			description: string;
			maxRetries?: number;
			/** Simple click handler */
			onClick: (event: MouseEvent) => void;
			/**
			 * Complex async data processor with configuration
			 * @example
			 * processData({ url: '/api/data', timeout: 5000 })
			 *   .then(response => console.log(response))
			 */
			processData: (config: { url: string; timeout?: number }) => Promise<Response>;
			/** Basic metadata object */
			metadata: { id: string; timestamp: number };
			/**
			 * User profile with nested optional properties
			 * @example
			 * const profile = {
			 *   name: 'John',
			 *   email: 'john@example.com',
			 *   preferences: { theme: 'dark' }
			 * }
			 */
			userProfile?: { name: string; email: string; preferences?: Record<string, unknown> };
			/** Array of tags */
			tags: string[];
			/**
			 * Complex array with nested objects and generics
			 * @example
			 * items = [{ id: 1, label: 'First', data: someValue }]
			 */
			items?: Array<{ id: number; label: string; data?: unknown }>;
			/** Record mapping strings to complex nested arrays */
			dataMap: Record<string, Array<{ id: number; data: SomeType }>>;
			/**
			 * Ultra-complex function with multiple parameters and utility types
			 * @example
			 * const result = await transformConfig(
			 *   { prop: 'value', returnNum: () => 42 },
			 *   (p, getNum) => getNum() > 0
			 * )
			 */
			transformConfig?: (param1: { prop: string; returnNum: () => number }, param2: (prop: string, getNum: () => number) => boolean | Promise<boolean>) => Omit<SomeWeirdType, "old" | "dep">;
			transformConfig2?: (
				param1: { prop: string; returnNum: () => number },
				param2: (prop: string, getNum: () => number) => boolean | Promise<boolean>
			) => Omit<SomeWeirdType, "old" | "dep">
		}
		`;

		const interfaceContent = `interface Props {
			/** Simple required string identifier */
			id: string;
			/** Optional count value for tracking */
			count?: number;
			isActive: boolean;
			/**
			 * A detailed description that spans multiple lines
			 * to test multi-line comment parsing properly.
			 */
			description: string;
			maxRetries?: number;
			/** Simple click handler */
			onClick: (event: MouseEvent) => void;
			/**
			 * Complex async data processor with configuration
			 * @example
			 * processData({ url: '/api/data', timeout: 5000 })
			 *   .then(response => console.log(response))
			 */
			processData: (config: { url: string; timeout?: number }) => Promise<Response>;
			/** Basic metadata object */
			metadata: { id: string; timestamp: number };
			/**
			 * User profile with nested optional properties
			 * @example
			 * const profile = {
			 *   name: 'John',
			 *   email: 'john@example.com',
			 *   preferences: { theme: 'dark' }
			 * }
			 */
			userProfile?: { name: string; email: string; preferences?: Record<string, unknown> };
			/** Array of tags */
			tags: string[];
			/**
			 * Complex array with nested objects and generics
			 * @example
			 * items = [{ id: 1, label: 'First', data: someValue }]
			 */
			items?: Array<{ id: number; label: string; data?: unknown }>;
			/** Record mapping strings to complex nested arrays */
			dataMap: Record<string, Array<{ id: number; data: SomeType }>>;
			/**
			 * Ultra-complex function with multiple parameters and utility types
			 * @example
			 * const result = await transformConfig(
			 *   { prop: 'value', returnNum: () => 42 },
			 *   (p, getNum) => getNum() > 0
			 * )
			 */
			transformConfig?: (param1: { prop: string; returnNum: () => number }, param2: (prop: string, getNum: () => number) => boolean | Promise<boolean>) => Omit<SomeWeirdType, "old" | "dep">;
			transformConfig2?: (
				param1: { prop: string; returnNum: () => number },
				param2: (prop: string, getNum: () => number) => boolean | Promise<boolean>
			) => Omit<SomeWeirdType, "old" | "dep">
		} `;

		const blocks: ScriptBlock[] = [
			{ content: typeContent, attributes: {} },
			{ content: interfaceContent, attributes: {} }
		];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { ...rest }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			// Should have 13 properties total
			assert.strictEqual(result.props.length, 14);

			// 1. id - required string with single-line comment
			const idProp = result.props.find((p) => p.name === 'id');
			assert.ok(idProp);
			assert.strictEqual(idProp.type, 'string');
			assert.strictEqual(idProp.required, true);
			assert.ok(idProp.comment);
			assert.ok(idProp.comment.includes('Simple'));
			assert.ok(idProp.comment.includes('identifier'));

			// 2. count - optional number with single-line comment
			const countProp = result.props.find((p) => p.name === 'count');
			assert.ok(countProp);
			assert.strictEqual(countProp.type, 'number');
			assert.strictEqual(countProp.required, false);
			assert.ok(countProp.comment);
			assert.ok(countProp.comment.includes('Optional'));
			assert.ok(countProp.comment.includes('tracking'));

			// 3. isActive - required boolean without comment
			const isActiveProp = result.props.find((p) => p.name === 'isActive');
			assert.ok(isActiveProp);
			assert.strictEqual(isActiveProp.type, 'boolean');
			assert.strictEqual(isActiveProp.required, true);
			assert.strictEqual(isActiveProp.comment, undefined);

			// 4. description - required string with multi-line comment
			const descProp = result.props.find((p) => p.name === 'description');
			assert.ok(descProp);
			assert.strictEqual(descProp.type, 'string');
			assert.strictEqual(descProp.required, true);
			assert.ok(descProp.comment);
			assert.ok(descProp.comment.includes('detailed'));
			assert.ok(descProp.comment.includes('properly'));

			// 5. maxRetries - optional number without comment
			const maxRetriesProp = result.props.find((p) => p.name === 'maxRetries');
			assert.ok(maxRetriesProp);
			assert.strictEqual(maxRetriesProp.type, 'number');
			assert.strictEqual(maxRetriesProp.required, false);
			assert.strictEqual(maxRetriesProp.comment, undefined);

			// 6. onClick - required function (single-line) with comment
			const onClickProp = result.props.find((p) => p.name === 'onClick');
			assert.ok(onClickProp);
			assert.strictEqual(onClickProp.type, '(event: MouseEvent) => void');
			assert.strictEqual(onClickProp.required, true);
			assert.ok(onClickProp.comment);
			assert.ok(onClickProp.comment.includes('Simple'));
			assert.ok(onClickProp.comment.includes('handler'));

			// 7. processData - required function (multi-line) with @example
			const processDataProp = result.props.find((p) => p.name === 'processData');
			assert.ok(processDataProp);
			assert.strictEqual(
				processDataProp.type,
				'(config: { url: string; timeout?: number }) => Promise<Response>'
			);
			assert.strictEqual(processDataProp.required, true);
			assert.ok(processDataProp.comment);
			assert.ok(processDataProp.comment.includes('Complex'));
			assert.ok(processDataProp.comment.includes('configuration'));

			// 8. metadata - required object (single-line) with comment
			const metadataProp = result.props.find((p) => p.name === 'metadata');
			assert.ok(metadataProp);
			assert.strictEqual(metadataProp.type, '{ id: string; timestamp: number }');
			assert.strictEqual(metadataProp.required, true);
			assert.ok(metadataProp.comment);
			assert.ok(metadataProp.comment.includes('Basic'));
			assert.ok(metadataProp.comment.includes('object'));

			// 9. userProfile - optional object (multi-line) with @example
			const userProfileProp = result.props.find((p) => p.name === 'userProfile');
			assert.ok(userProfileProp);
			// Multi-line object type will be condensed on one line in parsing
			assert.ok(userProfileProp.type.includes('name: string'));
			assert.ok(userProfileProp.type.includes('email: string'));
			assert.strictEqual(userProfileProp.required, false);
			assert.ok(userProfileProp.comment);
			assert.ok(userProfileProp.comment.includes('User'));
			assert.ok(userProfileProp.comment.includes('properties'));

			// 10. tags - required array (single-line) with comment
			const tagsProp = result.props.find((p) => p.name === 'tags');
			assert.ok(tagsProp);
			assert.strictEqual(tagsProp.type, 'string[]');
			assert.strictEqual(tagsProp.required, true);
			assert.ok(tagsProp.comment);
			assert.ok(tagsProp.comment.includes('Array'));
			assert.ok(tagsProp.comment.includes('tags'));

			// 11. items - optional array (multi-line) with @example
			const itemsProp = result.props.find((p) => p.name === 'items');
			assert.ok(itemsProp);
			assert.ok(itemsProp.type.includes('Array<'));
			assert.ok(itemsProp.type.includes('id: number'));
			assert.strictEqual(itemsProp.required, false);
			assert.ok(itemsProp.comment);
			assert.ok(itemsProp.comment.includes('Complex'));
			assert.ok(itemsProp.comment.includes('generics'));

			// 12. dataMap - required Record with complex nested type
			const dataMapProp = result.props.find((p) => p.name === 'dataMap');
			assert.ok(dataMapProp);
			assert.strictEqual(
				dataMapProp.type,
				'Record<string, Array<{ id: number; data: SomeType }>>'
			);
			assert.strictEqual(dataMapProp.required, true);
			assert.ok(dataMapProp.comment);
			assert.ok(dataMapProp.comment.includes('Record'));
			assert.ok(dataMapProp.comment.includes('arrays'));

			// 13. transformConfig - optional ultra-complex function with @example
			const transformConfigProp = result.props.find((p) => p.name === 'transformConfig');
			assert.ok(transformConfigProp);
			// Verify it contains key parts of the complex type
			assert.ok(transformConfigProp.type.includes('param1'));
			assert.ok(transformConfigProp.type.includes('param2'));
			assert.ok(transformConfigProp.type.includes('Omit'));
			assert.strictEqual(transformConfigProp.required, false);
			assert.ok(transformConfigProp.comment);
			assert.ok(transformConfigProp.comment.includes('Ultra-complex'));
			assert.ok(transformConfigProp.comment.includes('types'));

			// 14. transformConfig2 - optional ultra-complex function with multiline definition
			const transformConfigProp2 = result.props.find((p) => p.name === 'transformConfig2');
			assert.ok(transformConfigProp2);
			// Verify it contains key parts of the complex type
			assert.ok(transformConfigProp2.type.includes('param1'));
			assert.ok(transformConfigProp2.type.includes('param2'));
			assert.ok(transformConfigProp2.type.includes('Omit'));
			assert.strictEqual(transformConfigProp2.required, false);
		});
	});

	it('17. Complex type with diverse property types and JSDoc comments (Bad format and missing semicolons)', () => {
		const typeContent = `type Props = {
			/** Simple required string identifier */
			id: string
			/** Optional count value for tracking */
			count?: number
			isActive: boolean
			/**
			 * A detailed description that spans multiple lines
			 * to test multi-line comment parsing properly.
			 */
			description: string
			maxRetries?: number
			/** Simple click handler */
			onClick: (event: MouseEvent) => void
			/**
			 * Complex async data processor with configuration
			 * @example
			 * processData({ url: '/api/data', timeout: 5000 })
			 *   .then(response => console.log(response))
			 */
			processData: (
				config: {
					url: string;
					timeout?: number
				}
			) => Promise<Response>
			/** Basic metadata object */
			metadata: {
				id: string;
				timestamp: number
			}
			/**
			 * User profile with nested optional properties
			 * @example
			 * const profile = {
			 *   name: 'John',
			 *   email: 'john@example.com',
			 *   preferences: { theme: 'dark' }
			 * }
			 */
			userProfile?: {
				name: string;
				email: string;
				preferences?: Record<string, unknown>
			}
			/** Array of tags */
			tags: string[]
			/**
			 * Complex array with nested objects and generics
			 * @example
			 * items = [{ id: 1, label: 'First', data: someValue }]
			 */
			items?: Array<
				{
					id: number;
					label: string;
					data?: unknown
				}
			>
			/** Record mapping strings to complex nested arrays;;; */
			// We should ignore this comment right here
			/* And we should also ignore this comment */
			dataMap: Record<
				string,
				Array<
					{
						id: number;
						data: SomeType
					}
				>
			>
			/**
			 * Ultra-complex function with multiple parameters and utility types
			 * @example
			 * const result = await transformConfig(
			 *   { prop: 'value', returnNum: () => 42 },
			 *   (p, getNum) => getNum() > 0
			 * )
			 */
			transformConfig?: (param1: { prop: string; returnNum: () => number }, param2: (prop: string, getNum: () => number) => boolean | Promise<boolean>) => Omit<SomeWeirdType, "old" | "dep">;
			transformConfig2?: (
				param1: {
					prop: string;
					returnNum: () => number
				},
				param2: (
					prop: string,
					getNum: () => number
				) => boolean | Promise<
					boolean
				>
			) => Omit<SomeWeirdType, "old" | "dep">
		}
		const { ...rest }: Props = $props();`;

		const blocks: ScriptBlock[] = [{ content: typeContent, attributes: {} }];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			// Should have 13 properties total
			assert.strictEqual(result.props.length, 14);

			// 1. id - required string with single-line comment
			const idProp = result.props.find((p) => p.name === 'id');
			assert.ok(idProp);
			assert.strictEqual(idProp.type, 'string');
			assert.strictEqual(idProp.required, true);
			assert.ok(idProp.comment);
			assert.ok(idProp.comment.includes('Simple'));
			assert.ok(idProp.comment.includes('identifier'));

			// 2. count - optional number with single-line comment
			const countProp = result.props.find((p) => p.name === 'count');
			assert.ok(countProp);
			assert.strictEqual(countProp.type, 'number');
			assert.strictEqual(countProp.required, false);
			assert.ok(countProp.comment);
			assert.ok(countProp.comment.includes('Optional'));
			assert.ok(countProp.comment.includes('tracking'));

			// 3. isActive - required boolean without comment
			const isActiveProp = result.props.find((p) => p.name === 'isActive');
			assert.ok(isActiveProp);
			assert.strictEqual(isActiveProp.type, 'boolean');
			assert.strictEqual(isActiveProp.required, true);
			assert.strictEqual(isActiveProp.comment, undefined);

			// 4. description - required string with multi-line comment
			const descProp = result.props.find((p) => p.name === 'description');
			assert.ok(descProp);
			assert.strictEqual(descProp.type, 'string');
			assert.strictEqual(descProp.required, true);
			assert.ok(descProp.comment);
			assert.ok(descProp.comment.includes('detailed'));
			assert.ok(descProp.comment.includes('properly'));

			// 5. maxRetries - optional number without comment
			const maxRetriesProp = result.props.find((p) => p.name === 'maxRetries');
			assert.ok(maxRetriesProp);
			assert.strictEqual(maxRetriesProp.type, 'number');
			assert.strictEqual(maxRetriesProp.required, false);
			assert.strictEqual(maxRetriesProp.comment, undefined);

			// 6. onClick - required function (single-line) with comment
			const onClickProp = result.props.find((p) => p.name === 'onClick');
			assert.ok(onClickProp);
			assert.strictEqual(onClickProp.type, '(event: MouseEvent) => void');
			assert.strictEqual(onClickProp.required, true);
			assert.ok(onClickProp.comment);
			assert.ok(onClickProp.comment.includes('Simple'));
			assert.ok(onClickProp.comment.includes('handler'));

			// 7. processData - required function (multi-line) with @example
			const processDataProp = result.props.find((p) => p.name === 'processData');
			assert.ok(processDataProp);
			assert.strictEqual(
				processDataProp.type,
				'(config: { url: string; timeout?: number }) => Promise<Response>'
			);
			assert.strictEqual(processDataProp.required, true);
			assert.ok(processDataProp.comment);
			assert.ok(processDataProp.comment.includes('Complex'));
			assert.ok(processDataProp.comment.includes('configuration'));

			// 8. metadata - required object (single-line) with comment
			const metadataProp = result.props.find((p) => p.name === 'metadata');
			assert.ok(metadataProp);
			assert.strictEqual(metadataProp.type, '{ id: string; timestamp: number }');
			assert.strictEqual(metadataProp.required, true);
			assert.ok(metadataProp.comment);
			assert.ok(metadataProp.comment.includes('Basic'));
			assert.ok(metadataProp.comment.includes('object'));

			// 9. userProfile - optional object (multi-line) with @example
			const userProfileProp = result.props.find((p) => p.name === 'userProfile');
			assert.ok(userProfileProp);
			// Multi-line object type will be condensed on one line in parsing
			assert.ok(userProfileProp.type.includes('name: string'));
			assert.ok(userProfileProp.type.includes('email: string'));
			assert.strictEqual(userProfileProp.required, false);
			assert.ok(userProfileProp.comment);
			assert.ok(userProfileProp.comment.includes('User'));
			assert.ok(userProfileProp.comment.includes('properties'));

			// 10. tags - required array (single-line) with comment
			const tagsProp = result.props.find((p) => p.name === 'tags');
			assert.ok(tagsProp);
			assert.strictEqual(tagsProp.type, 'string[]');
			assert.strictEqual(tagsProp.required, true);
			assert.ok(tagsProp.comment);
			assert.ok(tagsProp.comment.includes('Array'));
			assert.ok(tagsProp.comment.includes('tags'));

			// 11. items - optional array (multi-line) with @example
			const itemsProp = result.props.find((p) => p.name === 'items');
			assert.ok(itemsProp);
			assert.ok(itemsProp.type.includes('Array<'));
			assert.ok(itemsProp.type.includes('id: number'));
			assert.strictEqual(itemsProp.required, false);
			assert.ok(itemsProp.comment);
			assert.ok(itemsProp.comment.includes('Complex'));
			assert.ok(itemsProp.comment.includes('generics'));

			// 12. dataMap - required Record with complex nested type
			const dataMapProp = result.props.find((p) => p.name === 'dataMap');
			assert.ok(dataMapProp);
			assert.strictEqual(
				dataMapProp.type,
				'Record<string, Array<{ id: number; data: SomeType }>>'
			);
			assert.strictEqual(dataMapProp.required, true);
			assert.ok(dataMapProp.comment);
			assert.ok(dataMapProp.comment.includes('Record'));
			assert.ok(dataMapProp.comment.includes('arrays'));

			// 13. transformConfig - optional ultra-complex function with @example
			const transformConfigProp = result.props.find((p) => p.name === 'transformConfig');
			assert.ok(transformConfigProp);
			// Verify it contains key parts of the complex type
			assert.ok(transformConfigProp.type.includes('param1'));
			assert.ok(transformConfigProp.type.includes('param2'));
			assert.ok(transformConfigProp.type.includes('Omit'));
			assert.strictEqual(transformConfigProp.required, false);
			assert.ok(transformConfigProp.comment);
			assert.ok(transformConfigProp.comment.includes('Ultra-complex'));
			assert.ok(transformConfigProp.comment.includes('types'));

			// 14. transformConfig2 - optional ultra-complex function with multiline definition
			const transformConfigProp2 = result.props.find((p) => p.name === 'transformConfig2');
			assert.ok(transformConfigProp2);
			// Verify it contains key parts of the complex type
			assert.ok(transformConfigProp2.type.includes('param1'));
			assert.ok(transformConfigProp2.type.includes('param2'));
			assert.ok(transformConfigProp2.type.includes('Omit'));
			assert.strictEqual(transformConfigProp2.required, false);
		});
	});

	it('18. Super complex type with wide range of data types. WITHOUT COMMENTS', () => {
		const typeContent = `
	import type {
        HTMLAttributes,
        HTMLButtonAttributes,
        HTMLFormAttributes,
    } from "svelte/elements";

    type Props = HTMLAttributes<HTMLDivElement> &
        Omit<HTMLFormAttributes, "onsubmit" | "onreset"> &
        Pick<HTMLButtonAttributes, "disabled" | "type"> & {
			/**
             * Simple required string prop
             * @example
             * \`\`\`typescript
             * simpleRequired="hello world"
             * \`\`\`
             */
            simpleRequired: string;

			/**
             * Optional callback with generic constraints
             * @template T - Must extend Record<string, unknown>
             * @param data - The data object being processed
             * @param metadata - Additional metadata about the operation
             * @returns Promise resolving to transformed data or null on error
             * @example
             * \`\`\`typescript
             * onDataTransform={async (data, meta) => {
             *   console.log('Processing:', meta.timestamp);
             *   return { ...data, processed: true };
             * }}
             * \`\`\`
             */
            onDataTransform?: <T extends Record<string, unknown>>(
                data: T,
                metadata: { timestamp: number; source: string }
            ) => Promise<T | null>;

			/**
             * Complex nested object with optional fields
             * Represents configuration for data fetching and caching
             * @example
             * \`\`\`typescript
             * fetchConfig={{
             *   endpoint: '/api/data',
             *   headers: { 'Authorization': 'Bearer token' },
             *   cache: { ttl: 3600, strategy: 'stale-while-revalidate' }
             * }}
             * \`\`\`
             */
            fetchConfig: {
                endpoint: string;
                method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
                headers?: Record<string, string>;
                cache?: {
                    enabled: boolean;
                    ttl?: number;
                    strategy?:
                        | "cache-first"
                        | "network-first"
                        | "stale-while-revalidate";
                };
                retry?: {
                    attempts: number;
                    backoff: "linear" | "exponential";
                    delay: number;
                };
            };

			/**
             * Array of items with discriminated union type
             * Each item can be one of several types based on the 'kind' discriminator
             * @example
             * \`\`\`typescript
             * items={[
             *   { kind: 'text', content: 'Hello', format: 'markdown' },
             *   { kind: 'image', src: '/img.jpg', alt: 'Photo', lazy: true },
             *   { kind: 'video', url: '/video.mp4', autoplay: false }
             * ]}
             * \`\`\`
             */
            items: Array<
                | {
                      kind: "text";
                      content: string;
                      format?: "plain" | "markdown" | "html";
                  }
                | { kind: "image"; src: string; alt: string; lazy?: boolean }
                | {
                      kind: "video";
                      url: string;
                      autoplay?: boolean;
                      controls?: boolean;
                  }
                | {
                      kind: "custom";
                      component: any;
                      props: Record<string, unknown>;
                  }
            >;

			/**
             * Generic validation function with multiple type parameters
             * @template TInput - The input type to validate
             * @template TOutput - The validated output type (defaults to TInput)
             * @template TError - The error type (defaults to string)
             * @param value - The value to validate
             * @param context - Additional validation context
             * @returns Validation result with either data or errors
             * @example
             * \`\`\`typescript
             * validator={(value, ctx) => {
             *   if (typeof value === 'string' && value.length > 0) {
             *     return { success: true, data: value.toUpperCase() };
             *   }
             *   return { success: false, errors: ['Value must be non-empty string'] };
             * }}
             * \`\`\`
             */
            validator?: <TInput = unknown, TOutput = TInput, TError = string>(
                value: TInput,
                context: { field: string; path: string[] }
            ) =>
                | { success: true; data: TOutput }
                | { success: false; errors: TError[] };

			/**
             * Render prop function with children and slot props
             * Provides render-time data and utilities to child components
             * @param props - Object containing state and helper functions
             * @returns Svelte snippet or undefined
             * @example
             * \`\`\`typescript
             * {#snippet children({ items, isLoading, refresh })}
             *   {#if isLoading}
             *     <Spinner />
             *   {:else}
             *     {#each items as item}
             *       <div>{item.name}</div>
             *     {/each}
             *     <button onclick={refresh}>Refresh</button>
             *   {/if}
             * {/snippet}
             * \`\`\`
             */
            children?: (props: {
                items: unknown[];
                isLoading: boolean;
                error: Error | null;
                refresh: () => Promise<void>;
                filters: Map<string, Set<string>>;
            }) => any;

			/**
             * Omitted form properties - explicitly excludes certain form events
             * All standard form attributes except the dangerous ones
             */
            formOptions?: Omit<
                HTMLFormAttributes,
                "onsubmit" | "onreset" | "action" | "method"
            > & {
                customSubmit?: (
                    data: FormData,
                    event: SubmitEvent
                ) => Promise<void> | void;
            };


			/**
             * State machine configuration with generic state and event types
             * @template TState - Union of possible state strings
             * @template TEvent - Union of possible event objects
             * @example
             * \`\`\`typescript
             * stateMachine={{
             *   initial: 'idle',
             *   states: {
             *     idle: { on: { FETCH: 'loading' } },
             *     loading: { on: { SUCCESS: 'success', ERROR: 'error' } },
             *     success: { on: { RESET: 'idle' } },
             *     error: { on: { RETRY: 'loading' } }
             *   },
             *   onTransition: (from, to, event) => {
             *     console.log(\`\${from} -> \${to}\`, event);
             *   }
             * }}
             * \`\`\`
             */
            stateMachine?: <
                TState extends string = string,
                TEvent extends { type: string } = { type: string },
            >(config: {
                initial: TState;
                states: Record<
                    TState,
                    {
                        on?: Partial<Record<TEvent["type"], TState>>;
                        entry?: () => void;
                        exit?: () => void;
                    }
                >;
                onTransition?: (
                    from: TState,
                    to: TState,
                    event: TEvent
                ) => void;
            }) => void;


			/**
             * Async data loader with complex return type
             * Supports pagination, filtering, and sorting
             * @param params - Query parameters for data fetching
             * @returns Promise with paginated results and metadata
             * @example
             * \`\`\`typescript
             * dataLoader={async ({ page, pageSize, filters, sort }) => {
             *   const response = await fetch(\`/api?page=\${page}&size=\${pageSize}\`);
             *   const data = await response.json();
             *   return {
             *     data: data.items,
             *     pagination: {
             *       total: data.total,
             *       page: data.page,
             *       pageSize: data.pageSize,
             *       hasNext: data.hasNext
             *     },
             *     metadata: { fetchedAt: Date.now() }
             *   };
             * }}
             * \`\`\`
             */
            dataLoader?: <TData = unknown>(params: {
                page: number;
                pageSize: number;
                filters?: Record<string, unknown>;
                sort?: { field: string; direction: "asc" | "desc" }[];
            }) => Promise<{
                data: TData[];
                pagination: {
                    total: number;
                    page: number;
                    pageSize: number;
                    hasNext: boolean;
                    hasPrev: boolean;
                };
                metadata?: Record<string, unknown>;
            }>;

			/**
             * Conditional prop that depends on another prop's value
             * When mode is 'controlled', value and onChange are required
             * When mode is 'uncontrolled', defaultValue is required
             * @example
             * \`\`\`typescript
             * // Controlled mode
             * mode="controlled"
             * value={currentValue}
             * onChange={(v) => setCurrentValue(v)}
             *
             * // Uncontrolled mode
             * mode="uncontrolled"
             * defaultValue="initial"
             * \`\`\`
             */
            mode: "controlled" | "uncontrolled";
        };
    let { ...rest }: Props = $props();
		`;
		const blocks: ScriptBlock[] = [{ content: typeContent, attributes: {} }];

		const result = parsePropsFromScriptBlocks(blocks);

		// Should have 10 direct properties (inherited types are in inherits array)
		assert.strictEqual(result.props.length, 10);

		// Should have 3 inherited types
		assert.strictEqual(result.inherits.length, 3);
		assert.ok(result.inherits.includes('HTMLAttributes<HTMLDivElement>'));
		assert.ok(result.inherits.includes('Omit<HTMLFormAttributes, "onsubmit" | "onreset">'));
		assert.ok(result.inherits.includes('Pick<HTMLButtonAttributes, "disabled" | "type">'));

		// 1. simpleRequired - simple string type
		const simpleRequiredProp = result.props.find((p) => p.name === 'simpleRequired');
		assert.ok(simpleRequiredProp);
		assert.strictEqual(simpleRequiredProp.type, 'string');
		assert.strictEqual(simpleRequiredProp.required, true);

		// 2. onDataTransform - optional generic function
		const onDataTransformProp = result.props.find((p) => p.name === 'onDataTransform');
		assert.ok(onDataTransformProp);
		assert.ok(onDataTransformProp.type.startsWith('<T extends Record'));
		assert.ok(onDataTransformProp.type.includes('metadata'));
		assert.ok(onDataTransformProp.type.endsWith('Promise<T | null>'));
		assert.strictEqual(onDataTransformProp.required, false);

		// 3. fetchConfig - complex nested object with optional properties
		const fetchConfigProp = result.props.find((p) => p.name === 'fetchConfig');
		assert.ok(fetchConfigProp);
		assert.ok(fetchConfigProp.type.startsWith('{'));
		assert.ok(fetchConfigProp.type.includes('endpoint'));
		assert.ok(fetchConfigProp.type.includes('cache'));
		assert.ok(fetchConfigProp.type.includes('retry'));
		assert.ok(fetchConfigProp.type.endsWith('}'));
		assert.strictEqual(fetchConfigProp.required, true);

		// 4. items - discriminated union array
		const itemsProp = result.props.find((p) => p.name === 'items');
		assert.ok(itemsProp);
		assert.ok(itemsProp.type.startsWith('Array<'));
		assert.ok(itemsProp.type.includes('kind: "text"'));
		assert.ok(itemsProp.type.includes('kind: "image"'));
		assert.ok(itemsProp.type.includes('kind: "video"'));
		assert.ok(itemsProp.type.includes('kind: "custom"'));
		assert.ok(itemsProp.type.endsWith('>'));
		assert.strictEqual(itemsProp.required, true);

		// 5. validator - optional generic function with union return type
		const validatorProp = result.props.find((p) => p.name === 'validator');
		assert.ok(validatorProp);
		assert.ok(validatorProp.type.startsWith('<TInput'));
		assert.ok(validatorProp.type.includes('success'));
		assert.ok(validatorProp.type.includes('errors'));
		assert.strictEqual(validatorProp.required, false);

		// 6. children - optional render prop function
		const childrenProp = result.props.find((p) => p.name === 'children');
		assert.ok(childrenProp);
		assert.ok(childrenProp.type.startsWith('(props'));
		assert.ok(childrenProp.type.includes('isLoading'));
		assert.ok(childrenProp.type.includes('refresh'));
		assert.ok(childrenProp.type.endsWith('any'));
		assert.strictEqual(childrenProp.required, false);

		// 7. formOptions - optional intersection with Omit and custom properties
		const formOptionsProp = result.props.find((p) => p.name === 'formOptions');
		assert.ok(formOptionsProp);
		assert.ok(formOptionsProp.type.startsWith('Omit<'));
		assert.ok(formOptionsProp.type.includes('customSubmit'));
		assert.ok(formOptionsProp.type.includes('FormData'));
		assert.ok(formOptionsProp.type.endsWith('}'));
		assert.strictEqual(formOptionsProp.required, false);

		// 8. stateMachine - ultra-complex generic function (using simplified assertions)
		const stateMachineProp = result.props.find((p) => p.name === 'stateMachine');
		assert.ok(stateMachineProp);
		assert.ok(stateMachineProp.type.startsWith('<TState'));
		assert.ok(stateMachineProp.type.includes('states'));
		assert.ok(stateMachineProp.type.endsWith('void'));
		assert.strictEqual(stateMachineProp.required, false);

		// 9. dataLoader - optional generic function with pagination
		const dataLoaderProp = result.props.find((p) => p.name === 'dataLoader');
		assert.ok(dataLoaderProp);
		assert.ok(dataLoaderProp.type.startsWith('<TData'));
		assert.ok(dataLoaderProp.type.includes('pagination'));
		assert.ok(dataLoaderProp.type.includes('hasNext'));
		assert.strictEqual(dataLoaderProp.required, false);

		// 10. mode - string literal union
		const modeProp = result.props.find((p) => p.name === 'mode');
		assert.ok(modeProp);
		assert.strictEqual(modeProp.type, '"controlled" | "uncontrolled"');
		assert.strictEqual(modeProp.required, true);
	});

	it('19. Fallback types applied when prop type is unknown', () => {
		const blocks: ScriptBlock[] = [
			{
				content: 'interface Props { label: string; }',
				attributes: {}
			},
			{
				content: 'const { label, children, class: className }: Props = $props();',
				attributes: {}
			}
		];

		const result = parsePropsFromScriptBlocks(
			blocks,
			TEST_NORMALISE_COMMENT,
			TEST_NORMALISE_TYPE,
			TEST_NORMALISE_DEFAULT_VALUE,
			{ children: 'Snippet', class: 'string' }
		);

		assert.strictEqual(result.props.length, 3);

		// label should have actual type from interface
		const labelProp = result.props.find((p) => p.name === 'label');
		assert.ok(labelProp);
		assert.strictEqual(labelProp.type, 'string');

		// children should get fallback type Snippet (not in interface)
		const childrenProp = result.props.find((p) => p.name === 'children');
		assert.ok(childrenProp);
		assert.strictEqual(childrenProp.type, 'Snippet');

		// class should get fallback type string (destructured as className)
		const classProp = result.props.find((p) => p.name === 'class');
		assert.ok(classProp);
		assert.strictEqual(classProp.type, 'string');
	});

	it('20. Fallback types not applied when prop has explicit type', () => {
		const blocks: ScriptBlock[] = [
			{
				content: 'interface Props { children: HTMLElement; class: number; }',
				attributes: {}
			},
			{
				content: 'const { children, class: className }: Props = $props();',
				attributes: {}
			}
		];

		const result = parsePropsFromScriptBlocks(
			blocks,
			TEST_NORMALISE_COMMENT,
			TEST_NORMALISE_TYPE,
			TEST_NORMALISE_DEFAULT_VALUE,
			{ children: 'Snippet', class: 'string' }
		);

		assert.strictEqual(result.props.length, 2);

		// children should keep its explicit HTMLElement type, not fallback to Snippet
		const childrenProp = result.props.find((p) => p.name === 'children');
		assert.ok(childrenProp);
		assert.strictEqual(childrenProp.type, 'HTMLElement');

		// class should keep its explicit number type, not fallback to string
		const classProp = result.props.find((p) => p.name === 'class');
		assert.ok(classProp);
		assert.strictEqual(classProp.type, 'number');
	});
});
