import { readFile, writeFile, rename, mkdir, appendFile, access, unlink } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { connectCodexApp } from './codex-app-client.mjs';
import { decideRecovery, isUsageLimit, RESUME_PROMPT } from './auto-resume-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = path.join(root, '.local');
const statePath = path.join(local, 'auto-resume-state.json');
const stopPath = path.join(local, 'auto-resume.stop');
const completePath = path.join(local, 'project-complete.json');
const logPath = path.join(local, 'auto-resume.jsonl');
const exists = async filename => { try { await access(filename); return true; } catch { return false; } };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const config = JSON.parse(await readFile(path.join(local, 'auto-resume-config.json'), 'utf8'));
if (config.projectRoot !== root || config.threadId !== process.env.CODEX_THREAD_ID) throw new Error('Recovery configuration does not match this project and originating chat.');
if (!Number.isInteger(config.maxResumes) || config.maxResumes < 1 || config.maxResumes > 6 || config.graceMs < 60000 || config.pollMs < 60000 || config.lifetimeMs > 172800000) throw new Error('Invalid recovery bounds.');
await mkdir(local, { recursive: true });

// An OS-owned local pipe prevents concurrent watchers and disappears on process exit.
const lockName = createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 20);
const lock = net.createServer(socket => socket.destroy());
await new Promise((resolve, reject) => {
  lock.once('error', reject);
  lock.listen(process.platform === 'win32' ? `\\\\.\\pipe\\kitsoe-resume-${lockName}` : path.join(local, 'auto-resume.sock'), resolve);
});
let app;
let state = { attempts: [] };
try { state = { ...state, ...JSON.parse(await readFile(statePath, 'utf8')) }; } catch { /* First run. */ }
const started = Date.now();
state = { ...state, pid: process.pid, startedAt: new Date(started).toISOString(), expiresAt: new Date(started + config.lifetimeMs).toISOString(), threadId: config.threadId, running: true, consecutiveErrors: 0 };
const persist = async () => {
  const temp = `${statePath}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(state, null, 2) + '\n');
  await rename(temp, statePath);
};
const setStatus = async (status, detail) => {
  if (state.status !== status || detail) await appendFile(logPath, JSON.stringify({ at: new Date().toISOString(), status, ...(detail ? { detail } : {}) }) + '\n');
  state.status = status; state.lastCheck = new Date().toISOString();
  await persist();
};
async function snapshot() {
  const result = await app.call('read_thread', { threadId: config.threadId, hostId: 'local', turnLimit: 1, includeOutputs: false, maxOutputCharsPerItem: 80 });
  // Do not request or retain account details while the agent is working.
  if (result.thread?.status?.type === 'idle' && isUsageLimit(result.turns?.[0])) {
    result.ordinaryUsageAllowed = (await app.call('get_usage_limits', {})).ordinaryUsageAllowed;
  }
  return result;
}
try {
  if (await exists(stopPath)) await unlink(stopPath);
  app = await connectCodexApp(config.serverPath);
  await setStatus('starting');
  while (Date.now() - started < config.lifetimeMs) {
    if (await exists(stopPath)) { await setStatus('stopped-by-user'); break; }
    if (await exists(completePath)) { await setStatus('project-complete'); break; }
    try {
      const current = await snapshot();
      const turn = current.turns?.[0];
      state.lastTurn = turn ? { id: turn.id, status: turn.status } : null;
      state.threadStatus = current.thread?.status?.type || 'unknown';
      if (isUsageLimit(turn) && state.failedTurnId !== turn.id) {
        state.failedTurnId = turn.id; state.failedSince = Date.now();
      }
      let decision = decideRecovery(current, state, config);
      if (decision === 'resume') {
        // Recheck immediately before sending; a user may have resumed during the first read.
        decision = decideRecovery(await snapshot(), state, config);
        if (decision === 'resume') {
          const attempt = { turnId: turn.id, at: new Date().toISOString(), result: 'reserved' };
          state.attempts.push(attempt);
          await setStatus('resume-reserved'); // Durable BEFORE the side effect; timeout never retries it.
          try {
            await app.call('send_message_to_thread', { threadId: config.threadId, hostId: 'local', prompt: RESUME_PROMPT });
            attempt.result = 'sent';
            await setStatus('resume-sent');
          } catch (error) {
            attempt.result = 'uncertain';
            await setStatus('manual-attention', error.message.slice(0, 240));
            break;
          }
        }
      }
      if (decision !== 'resume') await setStatus(decision);
      state.consecutiveErrors = 0;
      if (['wrong-thread', 'attempt-limit'].includes(decision)) break;
    } catch (error) {
      state.consecutiveErrors += 1;
      await setStatus('connection-error', error.message.slice(0, 240));
      if (state.consecutiveErrors >= 5) { await setStatus('manual-attention'); break; }
    }
    state.nextCheck = new Date(Date.now() + config.pollMs).toISOString();
    await persist();
    const until = Date.now() + config.pollMs;
    while (Date.now() < until && !(await exists(stopPath)) && !(await exists(completePath))) await sleep(Math.min(5000, until - Date.now()));
  }
  if (Date.now() - started >= config.lifetimeMs) await setStatus('expired');
} finally {
  state.running = false; state.nextCheck = null; await persist();
  app?.close(); lock.close();
}
