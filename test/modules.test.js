// Every server module must load: a syntax slip in a big string (tool descriptions, server
// instructions) otherwise only shows up as a failed deploy.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const dir of ['lib', 'api']) {
  for (const f of fs.readdirSync(new URL(`../${dir}/`, import.meta.url)).filter(f => f.endsWith('.js'))) {
    test(`${dir}/${f} loads`, async () => { await assert.doesNotReject(import(`../${dir}/${f}`)); });
  }
}
