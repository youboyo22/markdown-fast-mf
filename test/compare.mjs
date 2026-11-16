// Differential test: parse.js against the vendored, unchanged marked 18.1.3 on every case of a
// cases.json (the kit's practice/input/cases.json, or any instance the kit's generator draws).
//
//   node test/compare.mjs <path to cases.json> [more cases.json ...]
import { readFileSync } from 'node:fs';
import { parse } from '../parse.js';
import { marked } from '../vendor/marked/marked.esm.js';

let failed = 0;
for (const file of process.argv.slice(2)) {
  const cases = JSON.parse(readFileSync(file, 'utf8'));
  let bad = 0;
  for (const c of cases) {
    const want = marked.parse(c.markdown);
    const got = parse(c.markdown);
    if (want !== got) {
      bad++;
      if (bad <= 3) {
        let i = 0;
        while (want[i] === got[i]) i++;
        console.log(`${c.id}: differs at ${i}\n  want ${JSON.stringify(want.slice(Math.max(0, i - 60), i + 60))}\n  got  ${JSON.stringify(got.slice(Math.max(0, i - 60), i + 60))}`);
      }
    }
  }
  console.log(`${file}: ${cases.length - bad}/${cases.length} identical`);
  failed += bad;
}
process.exit(failed ? 1 : 0);
