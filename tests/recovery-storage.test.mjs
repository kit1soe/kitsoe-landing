import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteJson, readReservations, reserveAttempt } from '../scripts/recovery-storage.mjs';

test('snapshot survives the observed temporary Windows EPERM rename failure', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kitsoe-recovery-'));
  const filename = path.join(dir, 'state.json');
  let calls = 0;
  await atomicWriteJson(filename, { status: 'waiting-limit' }, { move: async (...args) => {
    if (++calls < 4) throw Object.assign(new Error('Locked by reader'), { code: 'EPERM' });
    await rename(...args);
  }, sleep: async () => {} });
  assert.equal(calls, 4);
  assert.equal(JSON.parse(await readFile(filename, 'utf8')).status, 'waiting-limit');
});
test('snapshot retries remain bounded on a permanent filesystem failure', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kitsoe-recovery-'));
  let calls = 0;
  await assert.rejects(atomicWriteJson(path.join(dir, 'state.json'), {}, { move: async () => { calls++; throw Object.assign(new Error('Locked'), { code: 'EPERM' }); }, sleep: async () => {} }));
  assert.equal(calls, 8);
});
test('durable reservations recover independently of snapshots and reject corruption', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kitsoe-recovery-'));
  const filename = path.join(dir, 'attempts.jsonl');
  const attempt = { turnId: 'stopped-turn', at: new Date().toISOString(), result: 'reserved' };
  await reserveAttempt(filename, attempt);
  assert.deepEqual(await readReservations(filename), [attempt]);
  await writeFile(filename, '{incomplete');
  await assert.rejects(readReservations(filename));
});
