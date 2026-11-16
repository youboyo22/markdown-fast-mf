[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/youboyo22/markdown-fast-mf/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/youboyo22/markdown-fast-mf/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

Built by an AI agent for [make.fun](https://make.fun/bounty/markdown-render-speed-02)'s bounty.

# A faster drop-in for marked 18.1.3

`parse(markdown)` in `parse.js` returns, for every string, exactly the HTML that marked 18.1.3's
`marked.parse(markdown)` returns with its default options (GFM on, `breaks` false, `pedantic` false,
`async` false), code unit for code unit. `main.ts` is the program the harness runs.

`parse.js` is a fork of marked 18.1.3 (MIT, <https://github.com/markedjs/marked>; the unchanged build
and its licence are in `vendor/marked/`). It keeps marked's design, a block lexer, an inline lexer over a
queue and a renderer, and marked's own regexes, and computes the same tokens. It is faster because it
does less work to get to them.

## What changed

**Only the default path.** Options, extensions, hooks, `walkTokens`, the pedantic and `breaks` rule
sets and the async path are gone; the lexer and tokenizer are one class, the parser and renderers are
three plain functions. The regexes are written out as literals (generated from marked's build, sources
unchanged) instead of being assembled by string replacement when the module loads.

**A rule is only tried where it can match.** marked tries every rule in turn at every position, and
almost all of them fail on their first character. Here each rule is guarded by what its regex needs:

- block rules by the first character of the source (a fence needs a backtick or a tilde, a heading `#`,
  a list a bullet or a digit, and so on; a leading space or tab still takes marked's whole sequence);
- the table rule only when the second line starts like a delimiter row, the setext heading rule only
  when a line before the next empty line starts like an underline;
- inline rules by the first character (`\`, `<`, `!` `[`, `*` `_`, a backtick, `~`, two spaces), and the
  extended autolink rule only where a protocol, `www.` or an e-mail name can start;
- inside a list item, the six "does this line end the item" regexes only when the line's first
  non-space character is one that can.

Every guard is a necessary condition of the regex it stands in front of, so skipping the regex changes
nothing.

**Hand-written matchers for the three hottest rules.** Each returns what marked's regex matches:

- `paragraphEnd`: block.paragraph. The alternation that ends a paragraph is cut out of marked's regex
  and compiled sticky; it is only asked at lines that can start one of its alternatives.
- `textLength`: inline.text, the most executed regex in marked. When the source holds no `@` it is one
  native scan for the next place the text can end; otherwise a loop over a character table.
- an inline source that holds nothing but text (no special character, hard break, protocol or `www.`)
  becomes its one text token without entering the loop at all. Most table cells and list items do.

**The emphasis mask is built on first use.** marked builds a masked copy of every inline source that
holds `*`, `_` or `~` (three global replaces with callbacks) and scans it for the last possible closer
before lexing it. Here the mask is built when the first delimiter run is actually lexed, each replace is
skipped when the source lacks the characters its regex needs, and the closer bound is found from the end
with `lastIndexOf`.

**Smaller things.** No per-list regex construction (the five bullet forms are built once); list lines
are cut with `indexOf` instead of `split('\n', 1)`; a table row without a backslash is split at its
pipes directly; code point counting without array spreads; the carriage-return replace and the
character-reference decode only run when the text holds a `\r` or an `&`.

**No out-of-bounds reads, and no optimizing compiler.** The run is short and its score is the CPU time
of every thread. V8's optimizing compiler costs more on its background thread than its code gives back
before the program ends, so `main.ts` switches it off (`v8.setFlagsFromString('--no-opt')`); the
scanning that matters is done by regexes and string built-ins, which are native code either way.

Nothing is kept from one call to the next: every call builds a new lexer, and the module-level values
are regexes and character tables that depend on no input.

## Correctness

The token stream is marked's, so the renderer's output is. That was checked, against the vendored
marked, on:

- all 720 practice cases, and 6 more instances drawn by the kit's generator from other seeds
  (`node test/compare.mjs <cases.json>`);
- several hundred thousand random and mutated documents (`node test/fuzz.mjs [seed] [count] [cases.json]`);
- each hand-written matcher against the regex it replaces, on random strings over the characters the
  regex cares about.

## Speed

On the practice set, Node 22, CPU time of the whole process (all threads), net of a do-nothing
`main.ts`: about 260 ms against about 440 ms for marked behind the baseline driver, 1.7 times faster.

## Files

- `parse.js` — the module: `parse(markdown) -> string`
- `main.ts` — the program the harness runs
- `test/` — the differential test and the fuzzer
- `vendor/marked/` — marked 18.1.3, unchanged, with its LICENSE and NOTICE (the fork's source and the
  tests' reference; not loaded by `main.ts`)
