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
describe('Prop Parser (Extracting Defaults and Bindables)', () => {
	it('1. Simple definition with single default value', () => {
		const blocks: ScriptBlock[] = [
			{
				content: 'type Props = { active?: boolean; }',
				attributes: {}
			},
			{
				content: 'interface Props { active?: boolean; }',
				attributes: {}
			}
		];
		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[
					block,
					{
						content: `
                    const { active = false }: Props = $props();
                    const { some, other, variables }: Props = props();
                `,
						attributes: {}
					}
				],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'active');
			assert.strictEqual(result.props[0].type, 'boolean');
			assert.strictEqual(result.props[0].required, false);
			assert.strictEqual(result.props[0].bindable, false);
			assert.strictEqual(result.props[0].defaultValue, 'false');
			assert.strictEqual(result.inherits.length, 0);
		});
	});

	it('2. Single intersection/extend and $bindable', () => {
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
				[
					block,
					{
						content: 'const { active = $bindable(false) }: Props = $props();',
						attributes: {}
					}
				],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'active');
			assert.strictEqual(result.props[0].type, 'boolean');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.props[0].bindable, true);
			assert.strictEqual(result.props[0].defaultValue, 'false');
			assert.strictEqual(result.inherits.length, 1);
			assert.strictEqual(result.inherits[0], 'ParentProps');
		});
	});

	it('3. Multiple intersections/extends and no default value', () => {
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
				[block, { content: 'const { value, ...rest }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'value');
			assert.strictEqual(result.props[0].type, 'string');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.props[0].bindable, false);
			assert.strictEqual(result.props[0].defaultValue, undefined);
			assert.strictEqual(result.inherits.length, 2);
			assert.strictEqual(result.inherits[0], 'Parent1');
			assert.strictEqual(result.inherits[1], 'Parent2');
		});
	});

	it('4. Single intersection/extend and generics (getting props from parent)', () => {
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
				[
					block,
					{
						content: "const { id, value = '', ...rest }: Props = $props();",
						attributes: {}
					}
				],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 2);
			assert.strictEqual(result.props[0].name, 'id');
			assert.strictEqual(result.props[0].type, 'number');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.props[0].bindable, false);
			assert.strictEqual(result.props[0].defaultValue, undefined);
			assert.strictEqual(result.props[1].name, 'value');
			assert.strictEqual(result.props[1].type, 'unknown');
			assert.strictEqual(result.props[1].required, false);
			assert.strictEqual(result.props[1].bindable, false);
			assert.strictEqual(result.props[1].defaultValue, "''");
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
				[
					block,
					{ content: 'const { id = $bindable(12) }: Props = $props();', attributes: {} }
				],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'id');
			assert.strictEqual(result.props[0].type, 'number');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.props[0].bindable, true);
			assert.strictEqual(result.props[0].defaultValue, '12');
			assert.strictEqual(result.inherits.length, 2);
			assert.strictEqual(result.inherits[0], 'ParentProps<SomeType>');
			assert.strictEqual(result.inherits[1], 'Pick<AnotherType, "prop1" | "prop2">');
		});
	});

	it('6. Simple with multiple properties and multiple default and bindings', () => {
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
				[
					block,
					{
						content: `const {
					name = $bindable('Guest'),
					age = $bindable(18),
					active = false,
					color
				}: Props = $props();`,
						attributes: {}
					}
				],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 4);

			const nameProp = result.props.find((p) => p.name === 'name');
			assert.ok(nameProp);
			assert.strictEqual(nameProp.type, 'string');
			assert.strictEqual(nameProp.required, true);
			assert.strictEqual(nameProp.bindable, true);
			assert.strictEqual(nameProp.defaultValue, "'Guest'");

			const ageProp = result.props.find((p) => p.name === 'age');
			assert.ok(ageProp);
			assert.strictEqual(ageProp.type, 'number');
			assert.strictEqual(ageProp.required, true);
			assert.strictEqual(ageProp.bindable, true);
			assert.strictEqual(ageProp.defaultValue, '18');

			const activeProp = result.props.find((p) => p.name === 'active');
			assert.ok(activeProp);
			assert.strictEqual(activeProp.type, 'boolean');
			assert.strictEqual(activeProp.required, false);
			assert.strictEqual(activeProp.bindable, false);
			assert.strictEqual(activeProp.defaultValue, 'false');

			const colorProp = result.props.find((p) => p.name === 'color');
			assert.ok(colorProp);
			assert.strictEqual(colorProp.type, '"red" | "green" | "blue"');
			assert.strictEqual(colorProp.required, true);
			assert.strictEqual(colorProp.bindable, false);
			assert.strictEqual(colorProp.defaultValue, undefined);
		});
	});

	it('7. Types defined in separate script blocks and no default or binding', () => {
		const blocks: ScriptBlock[] = [
			{ content: 'type Props = { count: number; };', attributes: {} },
			{ content: 'interface Props { count: number; }', attributes: {} }
		];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks(
				[block, { content: 'const { count }: Props = $props();', attributes: {} }],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'count');
			assert.strictEqual(result.props[0].type, 'number');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.props[0].bindable, false);
			assert.strictEqual(result.props[0].defaultValue, undefined);
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

	it('9. No type annotation on $props() - returns empty props regardless of defaults or bindings', () => {
		const blocks: ScriptBlock[] = [
			{ content: 'const { id = $bindable(), ...rest } = $props();', attributes: {} },
			{ content: "let { id = 'na' } = $props();", attributes: {} },
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

	it('10. Multiple script blocks with inheritance - missing destructuring results in no default', () => {
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
			assert.strictEqual(result.props[0].bindable, false);
			assert.strictEqual(result.props[0].defaultValue, undefined);
			assert.strictEqual(result.inherits.length, 1);
			assert.strictEqual(result.inherits[0], 'BaseProps');
		});
	});

	it('11. Multiple types but only one assigned to $props() - ensure the correct default value used', () => {
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
				[
					block,
					{
						content: "const { name = $bindable('') }: PropsA = $props();",
						attributes: {}
					}
				],
				TEST_NORMALISE_COMMENT,
				TEST_NORMALISE_TYPE,
				TEST_NORMALISE_DEFAULT_VALUE
			);

			assert.strictEqual(result.props.length, 1);
			assert.strictEqual(result.props[0].name, 'name');
			assert.strictEqual(result.props[0].type, 'string');
			assert.strictEqual(result.props[0].required, true);
			assert.strictEqual(result.props[0].bindable, true);
			assert.strictEqual(result.props[0].defaultValue, "''");
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
							content: `const { name, age = 18 }: TypeA ${operator} TypeB = $props();`,
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
				assert.strictEqual(nameProp.bindable, false);
				assert.strictEqual(nameProp.defaultValue, undefined);

				const ageProp = result.props.find((p) => p.name === 'age');
				assert.ok(ageProp);
				assert.strictEqual(ageProp.type, 'number');
				assert.strictEqual(ageProp.required, true);
				assert.strictEqual(ageProp.bindable, false);
				assert.strictEqual(ageProp.defaultValue, '18');

				assert.strictEqual(result.inherits.length, 0);
			});
		});
	});

	it('13. Local type with imported types on $props() - with inline comment on destructuring', () => {
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
							content: `const {
                            count = $bindable(0), // inline comment here
                            ...rest
                        }: LocalProps ${operator} ImportedTypeA ${operator} ImportedTypeB = $props();`,
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
				assert.strictEqual(idProp.bindable, false);
				assert.strictEqual(idProp.defaultValue, undefined);

				const countProp = result.props.find((p) => p.name === 'count');
				assert.ok(countProp);
				assert.strictEqual(countProp.type, 'number');
				assert.strictEqual(countProp.required, true);
				assert.strictEqual(countProp.bindable, true);
				assert.strictEqual(countProp.defaultValue, '0');

				assert.strictEqual(result.inherits.length, 2);
				assert.ok(result.inherits.includes('ImportedTypeA'));
				assert.ok(result.inherits.includes('ImportedTypeB'));
			});
		});
	});

	it('14. Single-line type definition with multiple properties - multi-line destructuring with block comments', () => {
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
				[
					block,
					{
						content: `const {
                    name, /* user's name */
                    age,   /** user's age */
                    active = $bindable(true) /* is user active? */
                } : Props = $props();`,
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
			assert.strictEqual(nameProp.bindable, false);
			assert.strictEqual(nameProp.defaultValue, undefined);

			const ageProp = result.props.find((p) => p.name === 'age');
			assert.ok(ageProp);
			assert.strictEqual(ageProp.type, 'number');
			assert.strictEqual(ageProp.required, true);
			assert.strictEqual(ageProp.bindable, false);
			assert.strictEqual(ageProp.defaultValue, undefined);

			const activeProp = result.props.find((p) => p.name === 'active');
			assert.ok(activeProp);
			assert.strictEqual(activeProp.type, 'boolean');
			assert.strictEqual(activeProp.required, false);
			assert.strictEqual(activeProp.bindable, true);
			assert.strictEqual(activeProp.defaultValue, 'true');
		});
	});

	it('15. Single-line type definition with multiple properties (bad formatting) - With default function value', () => {
		const blocks: ScriptBlock[] = [
			{
				content: 'type Props = { name: string; age: number; active?: ()=>boolean }',
				attributes: {}
			},
			{
				content: 'interface Props { name: string; age: number; active?: ()=>boolean }',
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
							active = () => true,
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
			assert.strictEqual(nameProp.bindable, false);
			assert.strictEqual(nameProp.defaultValue, undefined);

			const ageProp = result.props.find((p) => p.name === 'age');
			assert.ok(ageProp);
			assert.strictEqual(ageProp.type, 'number');
			assert.strictEqual(ageProp.required, true);
			assert.strictEqual(ageProp.bindable, false);
			assert.strictEqual(ageProp.defaultValue, undefined);

			const activeProp = result.props.find((p) => p.name === 'active');
			assert.ok(activeProp);
			assert.strictEqual(activeProp.type, '()=>boolean');
			assert.strictEqual(activeProp.required, false);
			assert.strictEqual(activeProp.bindable, false);
			assert.strictEqual(activeProp.defaultValue, '() => true');
		});
	});

	it('16. Complex type with diverse property types and JSDoc comments, including COMPLEX defaults and bindings', () => {
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
			const result = parsePropsFromScriptBlocks([
				block,
				{
					content: `const {
                    id = 'SomeString',
                    count = $bindable(10),
                    isActive, // Ignore this
                    description = 'No description yet', /* Ignore this too */
                    onClick = (event: MouseEvent) => { console.log(event); },
                    processData,
                    metadata = $bindable({ id: 'meta1', timestamp: Date.now() }),
                    userProfile = {
                        name: 'Default User',
                        email: "default@example.com",
                        preferences: {
                            theme: 'light',
                            notifications: true,
                            callbacks: [() => true]
                        }
                    },
                    tags = ["}", "{", "[", "}", "]"],
                    items = $bindable([{ id: 1, label: 'First {"{Item"}', data: null }]),
                    dataMap = { key1: [{ id: 101, data: someValue }], key2: [{ id: 202, data: anotherValue }] },
                    transformConfig = async (param1, param2) => {
                        const isValid = await param2(param1.prop, param1.returnNum);
                        if (isValid) {
                            return { newProp: 'newValue' };
                        }
                    },
                    transformConfig2 = async (param1, param2) => {
                        const isValid = await param2(param1.prop, param1.returnNum);
                        if (isValid) {
                            return { newProp: 'newValue' };
                        }
                    },
                ...rest }: Props = $props();`,
					attributes: {}
				}
			]);

			assert.strictEqual(result.props.length, 14);

			// 1. id - required string with single-line comment
			//#region id

			const idProp = result.props.find((p) => p.name === 'id');
			assert.ok(idProp);
			assert.strictEqual(idProp.type, 'string');
			assert.strictEqual(idProp.required, true);
			assert.strictEqual(idProp.bindable, false);
			assert.strictEqual(idProp.defaultValue, "'SomeString'");
			assert.strictEqual(idProp.comment, 'Simple required string identifier');

			//#endregion

			// 2. count - optional number with single-line comment
			//#region count

			const countProp = result.props.find((p) => p.name === 'count');
			assert.ok(countProp);
			assert.strictEqual(countProp.type, 'number');
			assert.strictEqual(countProp.required, false);
			assert.strictEqual(countProp.bindable, true);
			assert.strictEqual(countProp.defaultValue, '10');
			assert.strictEqual(countProp.comment, 'Optional count value for tracking');

			//#endregion

			// 3. isActive - required boolean without comment
			//#region isActive

			const isActiveProp = result.props.find((p) => p.name === 'isActive');
			assert.ok(isActiveProp);
			assert.strictEqual(isActiveProp.type, 'boolean');
			assert.strictEqual(isActiveProp.required, true);
			assert.strictEqual(isActiveProp.bindable, false);
			assert.strictEqual(isActiveProp.defaultValue, undefined);
			assert.strictEqual(isActiveProp.comment, undefined);

			//#endregion

			// 4. description - required string with multi-line comment
			//#region description

			const descProp = result.props.find((p) => p.name === 'description');
			assert.ok(descProp);
			assert.strictEqual(descProp.type, 'string');
			assert.strictEqual(descProp.required, true);
			assert.strictEqual(descProp.bindable, false);
			assert.strictEqual(descProp.defaultValue, "'No description yet'");
			assert.ok(descProp.comment);
			assert.ok(descProp.comment.includes('detailed'));
			assert.ok(descProp.comment.includes('properly'));

			//#endregion

			// 5. maxRetries - optional number without comment
			//#region maxRetries

			const maxRetriesProp = result.props.find((p) => p.name === 'maxRetries');
			assert.ok(maxRetriesProp);
			assert.strictEqual(maxRetriesProp.type, 'number');
			assert.strictEqual(maxRetriesProp.required, false);
			assert.strictEqual(maxRetriesProp.bindable, false);
			assert.strictEqual(maxRetriesProp.defaultValue, undefined);
			assert.strictEqual(maxRetriesProp.comment, undefined);

			//#endregion

			// 6. onClick - required function (single-line) with comment
			//#region onClick

			const onClickProp = result.props.find((p) => p.name === 'onClick');
			assert.ok(onClickProp);
			assert.strictEqual(onClickProp.type, '(event: MouseEvent) => void');
			assert.strictEqual(onClickProp.required, true);
			assert.strictEqual(onClickProp.bindable, false);
			assert.strictEqual(
				onClickProp.defaultValue,
				'(event: MouseEvent) => { console.log(event); }'
			);
			assert.ok(onClickProp.comment);
			assert.ok(onClickProp.comment.includes('Simple'));
			assert.ok(onClickProp.comment.includes('handler'));

			//#endregion

			// 7. processData - required function (multi-line) with @example
			//#region processData

			const processDataProp = result.props.find((p) => p.name === 'processData');
			assert.ok(processDataProp);
			assert.strictEqual(
				processDataProp.type,
				'(config: { url: string; timeout?: number }) => Promise<Response>'
			);
			assert.strictEqual(processDataProp.required, true);
			assert.strictEqual(processDataProp.bindable, false);
			assert.strictEqual(processDataProp.defaultValue, undefined);
			assert.ok(processDataProp.comment);
			assert.ok(processDataProp.comment.includes('Complex'));
			assert.ok(processDataProp.comment.includes('configuration'));

			//#endregion

			// 8. metadata - required object (single-line) with comment
			//#region metadata

			const metadataProp = result.props.find((p) => p.name === 'metadata');
			assert.ok(metadataProp);
			assert.strictEqual(metadataProp.type, '{ id: string; timestamp: number }');
			assert.strictEqual(metadataProp.required, true);
			assert.strictEqual(metadataProp.bindable, true);
			assert.strictEqual(metadataProp.defaultValue, "{ id: 'meta1', timestamp: Date.now() }");
			assert.strictEqual(metadataProp.comment, 'Basic metadata object');

			//#endregion

			// 9. userProfile - optional object (multi-line) with @example
			//#region userProfile

			const userProfileProp = result.props.find((p) => p.name === 'userProfile');
			assert.ok(userProfileProp);
			// Multi-line object type will be condensed on one line in parsing
			assert.ok(userProfileProp.type.includes('name: string'));
			assert.ok(userProfileProp.type.includes('email: string'));
			assert.ok(userProfileProp.type.includes('preferences?: Record<string, unknown>'));
			assert.strictEqual(userProfileProp.required, false);
			assert.strictEqual(userProfileProp.bindable, false);
			assert.ok(userProfileProp.defaultValue);
			assert.ok(userProfileProp.defaultValue.includes("name: 'Default User'"));
			assert.ok(userProfileProp.defaultValue.includes('email: "default@example.com"'));
			assert.ok(userProfileProp.defaultValue.includes('callbacks: [() => true]'));
			assert.ok(userProfileProp.comment);
			assert.ok(userProfileProp.comment.includes('User'));
			assert.ok(userProfileProp.comment.includes('properties'));

			//#endregion

			// 10. tags - required array (single-line) with comment
			//#region tags

			const tagsProp = result.props.find((p) => p.name === 'tags');
			assert.ok(tagsProp);
			assert.strictEqual(tagsProp.type, 'string[]');
			assert.strictEqual(tagsProp.required, true);
			assert.strictEqual(tagsProp.bindable, false);
			assert.strictEqual(tagsProp.defaultValue, '["}", "{", "[", "}", "]"]');
			assert.strictEqual(tagsProp.comment, 'Array of tags');

			//#endregion

			// 11. items - optional array (multi-line) with @example
			//#region items

			const itemsProp = result.props.find((p) => p.name === 'items');
			assert.ok(itemsProp);
			assert.strictEqual(
				itemsProp.type,
				'Array<{ id: number; label: string; data?: unknown }>'
			);
			assert.strictEqual(itemsProp.required, false);
			assert.strictEqual(itemsProp.bindable, true);
			assert.strictEqual(
				itemsProp.defaultValue,
				'[{ id: 1, label: \'First {"{Item"}\', data: null }]'
			);
			assert.ok(itemsProp.comment);
			assert.ok(itemsProp.comment.includes('Complex'));
			assert.ok(itemsProp.comment.includes('generics'));
			assert.ok(itemsProp.comment.includes('data: someValue'));

			//#endregion

			// 12. dataMap - required Record with complex nested type
			//#region dataMap

			const dataMapProp = result.props.find((p) => p.name === 'dataMap');
			assert.ok(dataMapProp);
			assert.strictEqual(
				dataMapProp.type,
				'Record<string, Array<{ id: number; data: SomeType }>>'
			);
			assert.strictEqual(dataMapProp.required, true);
			assert.strictEqual(dataMapProp.bindable, false);
			assert.strictEqual(
				dataMapProp.defaultValue,
				'{ key1: [{ id: 101, data: someValue }], key2: [{ id: 202, data: anotherValue }] }'
			);
			assert.strictEqual(
				dataMapProp.comment,
				'Record mapping strings to complex nested arrays'
			);

			//#endregion

			// 13. transformConfig - optional ultra-complex function with @example
			//#region transformConfig

			const transformConfigProp = result.props.find((p) => p.name === 'transformConfig');
			assert.ok(transformConfigProp);
			// Verify it contains key parts of the complex type
			assert.ok(transformConfigProp.type.includes('param1'));
			assert.ok(transformConfigProp.type.includes('param2'));
			assert.ok(transformConfigProp.type.includes('Omit'));
			assert.strictEqual(transformConfigProp.required, false);
			assert.strictEqual(transformConfigProp.bindable, false);
			assert.ok(transformConfigProp.defaultValue);
			assert.ok(transformConfigProp.defaultValue.includes('async (param1, param2) =>'));
			assert.ok(transformConfigProp.defaultValue.includes('returnNum'));
			assert.ok(transformConfigProp.defaultValue.includes("return { newProp: 'newValue' };"));
			assert.ok(transformConfigProp.comment);
			assert.ok(transformConfigProp.comment.includes('Ultra-complex'));
			assert.ok(transformConfigProp.comment.includes('types'));
			assert.ok(transformConfigProp.comment.includes('getNum() > 0'));

			//#endregion

			// 14. transformConfig2 - optional ultra-complex function with multiline definition
			//#region transformConfig2

			const transformConfigProp2 = result.props.find((p) => p.name === 'transformConfig2');
			assert.ok(transformConfigProp2);
			// Verify it contains key parts of the complex type
			assert.ok(transformConfigProp2.type.includes('param1'));
			assert.ok(transformConfigProp2.type.includes('param2'));
			assert.ok(transformConfigProp2.type.includes('Omit'));
			assert.strictEqual(transformConfigProp2.required, false);
			assert.strictEqual(transformConfigProp2.bindable, false);
			assert.ok(transformConfigProp2.defaultValue);
			assert.ok(transformConfigProp2.defaultValue.includes('async (param1, param2) =>'));
			assert.ok(transformConfigProp2.defaultValue.includes('returnNum'));
			assert.ok(
				transformConfigProp2.defaultValue.includes("return { newProp: 'newValue' };")
			);

			//#endregion
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
		`;

		const blocks: ScriptBlock[] = [{ content: typeContent, attributes: {} }];

		blocks.forEach((block) => {
			const result = parsePropsFromScriptBlocks([
				block,
				{
					content: `const {
                    id = 'SomeString',
                    count = $bindable(10),
                    isActive, // Ignore this
                    description = 'No description yet', /* Ignore this too */
                    onClick = (event: MouseEvent) => { console.log(event); },
                    processData,
                    metadata = $bindable({ id: 'meta1', timestamp: Date.now() }),
                    userProfile = {
                        name: 'Default User',
                        email: "default@example.com",
                        preferences: {
                            theme: 'light',
                            notifications: true,
                            callbacks: [() => true]
                        }
                    },
                    tags = ["}", "{", "[", "}", "]"],
                    items = $bindable([{ id: 1, label: 'First {"{Item"}', data: null }]),
                    dataMap = { key1: [{ id: 101, data: someValue }], key2: [{ id: 202, data: anotherValue }] },
                    transformConfig = async (param1, param2) => {
                        const isValid = await param2(param1.prop, param1.returnNum);
                        if (isValid) {
                            return { newProp: 'newValue' };
                        }
                    },
                    transformConfig2 = async (param1, param2) => {
                        const isValid = await param2(param1.prop, param1.returnNum);
                        if (isValid) {
                            return { newProp: 'newValue' };
                        }
                    },
                ...rest }: Props = $props();`,
					attributes: {}
				}
			]);

			assert.strictEqual(result.props.length, 14);

			// 1. id - required string with single-line comment
			//#region id

			const idProp = result.props.find((p) => p.name === 'id');
			assert.ok(idProp);
			assert.strictEqual(idProp.type, 'string');
			assert.strictEqual(idProp.required, true);
			assert.strictEqual(idProp.bindable, false);
			assert.strictEqual(idProp.defaultValue, "'SomeString'");
			assert.strictEqual(idProp.comment, 'Simple required string identifier');

			//#endregion

			// 2. count - optional number with single-line comment
			//#region count

			const countProp = result.props.find((p) => p.name === 'count');
			assert.ok(countProp);
			assert.strictEqual(countProp.type, 'number');
			assert.strictEqual(countProp.required, false);
			assert.strictEqual(countProp.bindable, true);
			assert.strictEqual(countProp.defaultValue, '10');
			assert.strictEqual(countProp.comment, 'Optional count value for tracking');

			//#endregion

			// 3. isActive - required boolean without comment
			//#region isActive

			const isActiveProp = result.props.find((p) => p.name === 'isActive');
			assert.ok(isActiveProp);
			assert.strictEqual(isActiveProp.type, 'boolean');
			assert.strictEqual(isActiveProp.required, true);
			assert.strictEqual(isActiveProp.bindable, false);
			assert.strictEqual(isActiveProp.defaultValue, undefined);
			assert.strictEqual(isActiveProp.comment, undefined);

			//#endregion

			// 4. description - required string with multi-line comment
			//#region description

			const descProp = result.props.find((p) => p.name === 'description');
			assert.ok(descProp);
			assert.strictEqual(descProp.type, 'string');
			assert.strictEqual(descProp.required, true);
			assert.strictEqual(descProp.bindable, false);
			assert.strictEqual(descProp.defaultValue, "'No description yet'");
			assert.ok(descProp.comment);
			assert.ok(descProp.comment.includes('detailed'));
			assert.ok(descProp.comment.includes('properly'));

			//#endregion

			// 5. maxRetries - optional number without comment
			//#region maxRetries

			const maxRetriesProp = result.props.find((p) => p.name === 'maxRetries');
			assert.ok(maxRetriesProp);
			assert.strictEqual(maxRetriesProp.type, 'number');
			assert.strictEqual(maxRetriesProp.required, false);
			assert.strictEqual(maxRetriesProp.bindable, false);
			assert.strictEqual(maxRetriesProp.defaultValue, undefined);
			assert.strictEqual(maxRetriesProp.comment, undefined);

			//#endregion

			// 6. onClick - required function (single-line) with comment
			//#region onClick

			const onClickProp = result.props.find((p) => p.name === 'onClick');
			assert.ok(onClickProp);
			assert.strictEqual(onClickProp.type, '(event: MouseEvent) => void');
			assert.strictEqual(onClickProp.required, true);
			assert.strictEqual(onClickProp.bindable, false);
			assert.strictEqual(
				onClickProp.defaultValue,
				'(event: MouseEvent) => { console.log(event); }'
			);
			assert.ok(onClickProp.comment);
			assert.ok(onClickProp.comment.includes('Simple'));
			assert.ok(onClickProp.comment.includes('handler'));

			//#endregion

			// 7. processData - required function (multi-line) with @example
			//#region processData

			const processDataProp = result.props.find((p) => p.name === 'processData');
			assert.ok(processDataProp);
			assert.strictEqual(
				processDataProp.type,
				'(config: { url: string; timeout?: number }) => Promise<Response>'
			);
			assert.strictEqual(processDataProp.required, true);
			assert.strictEqual(processDataProp.bindable, false);
			assert.strictEqual(processDataProp.defaultValue, undefined);
			assert.ok(processDataProp.comment);
			assert.ok(processDataProp.comment.includes('Complex'));
			assert.ok(processDataProp.comment.includes('configuration'));

			//#endregion

			// 8. metadata - required object (single-line) with comment
			//#region metadata

			const metadataProp = result.props.find((p) => p.name === 'metadata');
			assert.ok(metadataProp);
			assert.strictEqual(metadataProp.type, '{ id: string; timestamp: number }');
			assert.strictEqual(metadataProp.required, true);
			assert.strictEqual(metadataProp.bindable, true);
			assert.strictEqual(metadataProp.defaultValue, "{ id: 'meta1', timestamp: Date.now() }");
			assert.strictEqual(metadataProp.comment, 'Basic metadata object');

			//#endregion

			// 9. userProfile - optional object (multi-line) with @example
			//#region userProfile

			const userProfileProp = result.props.find((p) => p.name === 'userProfile');
			assert.ok(userProfileProp);
			// Multi-line object type will be condensed on one line in parsing
			assert.ok(userProfileProp.type.includes('name: string'));
			assert.ok(userProfileProp.type.includes('email: string'));
			assert.ok(userProfileProp.type.includes('preferences?: Record<string, unknown>'));
			assert.strictEqual(userProfileProp.required, false);
			assert.strictEqual(userProfileProp.bindable, false);
			assert.ok(userProfileProp.defaultValue);
			assert.ok(userProfileProp.defaultValue.includes("name: 'Default User'"));
			assert.ok(userProfileProp.defaultValue.includes('email: "default@example.com"'));
			assert.ok(userProfileProp.defaultValue.includes('callbacks: [() => true]'));
			assert.ok(userProfileProp.comment);
			assert.ok(userProfileProp.comment.includes('User'));
			assert.ok(userProfileProp.comment.includes('properties'));

			//#endregion

			// 10. tags - required array (single-line) with comment
			//#region tags

			const tagsProp = result.props.find((p) => p.name === 'tags');
			assert.ok(tagsProp);
			assert.strictEqual(tagsProp.type, 'string[]');
			assert.strictEqual(tagsProp.required, true);
			assert.strictEqual(tagsProp.bindable, false);
			assert.strictEqual(tagsProp.defaultValue, '["}", "{", "[", "}", "]"]');
			assert.strictEqual(tagsProp.comment, 'Array of tags');

			//#endregion

			// 11. items - optional array (multi-line) with @example
			//#region items

			const itemsProp = result.props.find((p) => p.name === 'items');
			assert.ok(itemsProp);
			assert.strictEqual(
				itemsProp.type,
				'Array<{ id: number; label: string; data?: unknown }>'
			);
			assert.strictEqual(itemsProp.required, false);
			assert.strictEqual(itemsProp.bindable, true);
			assert.strictEqual(
				itemsProp.defaultValue,
				'[{ id: 1, label: \'First {"{Item"}\', data: null }]'
			);
			assert.ok(itemsProp.comment);
			assert.ok(itemsProp.comment.includes('Complex'));
			assert.ok(itemsProp.comment.includes('generics'));
			assert.ok(itemsProp.comment.includes('data: someValue'));

			//#endregion

			// 12. dataMap - required Record with complex nested type
			//#region dataMap

			const dataMapProp = result.props.find((p) => p.name === 'dataMap');
			assert.ok(dataMapProp);
			assert.strictEqual(
				dataMapProp.type,
				'Record<string, Array<{ id: number; data: SomeType }>>'
			);
			assert.strictEqual(dataMapProp.required, true);
			assert.strictEqual(dataMapProp.bindable, false);
			assert.strictEqual(
				dataMapProp.defaultValue,
				'{ key1: [{ id: 101, data: someValue }], key2: [{ id: 202, data: anotherValue }] }'
			);
			assert.strictEqual(
				dataMapProp.comment,
				'Record mapping strings to complex nested arrays;;;'
			);

			//#endregion

			// 13. transformConfig - optional ultra-complex function with @example
			//#region transformConfig

			const transformConfigProp = result.props.find((p) => p.name === 'transformConfig');
			assert.ok(transformConfigProp);
			// Verify it contains key parts of the complex type
			assert.ok(transformConfigProp.type.includes('param1'));
			assert.ok(transformConfigProp.type.includes('param2'));
			assert.ok(transformConfigProp.type.includes('Omit'));
			assert.strictEqual(transformConfigProp.required, false);
			assert.strictEqual(transformConfigProp.bindable, false);
			assert.ok(transformConfigProp.defaultValue);
			assert.ok(transformConfigProp.defaultValue.includes('async (param1, param2) =>'));
			assert.ok(transformConfigProp.defaultValue.includes('returnNum'));
			assert.ok(transformConfigProp.defaultValue.includes("return { newProp: 'newValue' };"));
			assert.ok(transformConfigProp.comment);
			assert.ok(transformConfigProp.comment.includes('Ultra-complex'));
			assert.ok(transformConfigProp.comment.includes('types'));
			assert.ok(transformConfigProp.comment.includes('getNum() > 0'));

			//#endregion

			// 14. transformConfig2 - optional ultra-complex function with multiline definition
			//#region transformConfig2

			const transformConfigProp2 = result.props.find((p) => p.name === 'transformConfig2');
			assert.ok(transformConfigProp2);
			// Verify it contains key parts of the complex type
			assert.ok(transformConfigProp2.type.includes('param1'));
			assert.ok(transformConfigProp2.type.includes('param2'));
			assert.ok(transformConfigProp2.type.includes('Omit'));
			assert.strictEqual(transformConfigProp2.required, false);
			assert.strictEqual(transformConfigProp2.bindable, false);
			assert.ok(transformConfigProp2.defaultValue);
			assert.ok(transformConfigProp2.defaultValue.includes('async (param1, param2) =>'));
			assert.ok(transformConfigProp2.defaultValue.includes('returnNum'));
			assert.ok(
				transformConfigProp2.defaultValue.includes("return { newProp: 'newValue' };")
			);

			//#endregion
		});
	});
});
