// main.ts — the program the harness runs (node22, erasable TypeScript syntax only).
//
// It reads every case from /input/cases.json (a JSON array of {id, markdown}), renders each one with
// parse() from parse.js, and writes /output/html.json: a JSON array of the HTML strings, one per case
// and in the cases' order. Outside a container MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in for
// /input and /output.
//
// The run is short (a few megabytes of Markdown, once), and what is scored is the CPU time of every
// thread. On such a run V8's optimizing compiler costs more CPU on its background thread than the
// optimized code gives back before the program ends, so it is switched off: the code runs on V8's
// interpreter and baseline compiler, and parse.js is written for that (its scanning is done by regexes
// and string built-ins, which are native code either way). This changes no output.

import { readFileSync, writeFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
import { parse } from './parse.js';

setFlagsFromString('--no-opt');

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(INPUT_DIR + '/cases.json', 'utf8')) as { id: string; markdown: string }[];

const n = cases.length;
const html = new Array<string>(n);
for (let i = 0; i < n; i++) html[i] = parse(cases[i].markdown);

writeFileSync(OUTPUT_DIR + '/html.json', JSON.stringify(html));
