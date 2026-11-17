import { readFile, writeFile, rename, open } from 'node:fs/promises';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Windows scanners/readers can briefly lock a destination during rename. */
export async function atomicWriteJson(filename, value, { move = rename, sleep = wait } = {}) {
  const temp = `${filename}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  for (let attempt = 0; ; attempt++) {
    try { await move(temp, filename); return; }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 7) throw error;
      await sleep(Math.min(50 * 2 ** attempt, 1000));
    }
  }
}

export async function readReservations(filename) {
  let text;
  try { text = await readFile(filename, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return text.split('\n').filter(Boolean).map(line => {
    const record = JSON.parse(line);
    if (typeof record.turnId !== 'string' || typeof record.at !== 'string') throw new Error('Invalid recovery reservation ledger. Manual review required.');
    return record;
  });
}

/** Append and fsync before the request; it remains authoritative if snapshots fail. */
export async function reserveAttempt(filename, attempt) {
  const file = await open(filename, 'a');
  try { await file.writeFile(JSON.stringify(attempt) + '\n'); await file.sync(); }
  finally { await file.close(); }
}
