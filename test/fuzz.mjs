// Differential fuzz: parse.js against the vendored, unchanged marked 18.1.3 on random Markdown, built
// from fragments that exercise every rule and, when given, from mutated cases of a cases.json.
//
//   node test/fuzz.mjs [seed] [count] [path to cases.json]
import { readFileSync } from 'node:fs';
import { parse } from '../parse.js';
import { marked } from '../vendor/marked/marked.esm.js';

let seed = +process.argv[2] || 1;
const count = +process.argv[3] || 20000;
const corpus = process.argv[4] ? JSON.parse(readFileSync(process.argv[4], 'utf8')).map((c) => c.markdown) : [];
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const ri = (n) => Math.floor(rnd() * n);
const pick = (a) => a[ri(a.length)];
// prettier-ignore
const atoms = ['*', '**', '_', '__', '~', '~~', '`', '``', '[', ']', '(', ')', '<', '>', '!', '\\', '&', '#', '-', '+', '=', '|', ':', '.', ' ', '  ', '   ', '    ', '\n', '\n\n', '\t', 'a', 'b', 'foo', 'bar baz', '1.', '1)', '2. ', '- ', '* ', '> ', '```', '~~~', '---', '***', '___', '===',
  'http://x.y/z', 'https://example.com/a_b?c=d&e', 'www.foo.com', 'ftp://f.tp', 'mailto:a@b.co', 'xmpp:a@b.co/r', 'user@example.com', 'a.b-c_d+e@x-y.z.org', '@', 'http', 'HTTP', 'www.', 'ww', 'h', 'f', 'w', 'm', 'x',
  '&amp;', '&#35;', '&#x1F600;', '&#0;', '&copy', '&;', '<a href="x">', '</a>', '<b>', '<!-- c -->', '<div>', '</div>', '<pre>', '</pre>', '<script>', '<br/>', '<x@y.z>', '<http://a.b>', '[foo]', '[foo]: /url "t"', '[bar]: <u r l>', '[foo][bar]', '[a](b)', '[a](<b c> "t")', '![i](s)', '![i][foo]', '[x]', '[ ]', '- [x] ', '- [ ] ',
  '| a | b |', '|---|:-:|', '| - | - |', 'a | b', '-- | --', ':--', '\\|', '\\*', '\\_', '\\\n', '  \n', ' \n', '\r\n', '\r', '\f', '\v', ' ', ' ', ' ', 'é', 'ü', '日本', '😀', '\ud83d', '\ude00', '“', '”', '«', '$', '^', '{', '}', "'", '"', '/', '?', ',', ';', '%', '0', '9', '12345678901', 'x86_64', 'snake_case_word', '*a*', '**b**', '_c_', '~d~', '~~e~~', '`f`', '<details>', '<summary>s</summary>', '</details>', '<style>', '</style>', '<?php', '?>', '<!DOCTYPE x>', '<![CDATA[', ']]>', 'Setext\n===', 'Setext\n---', '    code', '\tcode', ' # h', '# h #', '###### h', '####### no'];

function randomDoc() {
  let s = '';
  for (let i = 1 + ri(40); i > 0; i--) s += pick(atoms);
  return s;
}

function mutate(base) {
  let s = base;
  if (s.length > 3000) {
    const a = ri(s.length - 3000);
    s = s.slice(a, a + 200 + ri(2800));
  }
  for (let i = 1 + ri(6); i > 0; i--) {
    const p = ri(s.length + 1);
    const op = ri(4);
    if (op === 0) s = s.slice(0, p) + pick(atoms) + s.slice(p);
    else if (op === 1) s = s.slice(0, p) + s.slice(p + 1 + ri(5));
    else if (op === 2) {
      const q = ri(s.length + 1);
      s = s.slice(0, p) + s.slice(q, q + ri(40)) + s.slice(p);
    } else {
      const lines = s.split('\n');
      const a = ri(lines.length);
      const b = ri(lines.length);
      [lines[a], lines[b]] = [lines[b], lines[a]];
      s = lines.join('\n');
    }
  }
  return s;
}

let bad = 0;
for (let i = 0; i < count; i++) {
  const markdown = corpus.length > 0 && ri(10) >= 4 ? mutate(pick(corpus)) : randomDoc();
  let want;
  let got;
  try {
    want = marked.parse(markdown);
  } catch {
    want = null;
  }
  try {
    got = parse(markdown);
  } catch {
    got = null;
  }
  if (want !== got) {
    bad++;
    if (bad <= 3) console.log(`differs on ${JSON.stringify(markdown)}`);
  }
}
console.log(`fuzz seed ${process.argv[2] || 1}: ${count - bad}/${count} identical`);
process.exit(bad ? 1 : 0);
