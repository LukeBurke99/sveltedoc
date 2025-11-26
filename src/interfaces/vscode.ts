/* eslint-disable @typescript-eslint/consistent-type-definitions */

export interface TextDocument {
	getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
	lineAt(line: number): TextLine;
	getText(range?: Range): string;
}

export interface Position {
	line: number;
	character: number;
}

interface TextLine {
	text: string;
}

//#region Types

type Range = any;

//#endregion
