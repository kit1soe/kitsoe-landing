import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideRecovery, isUsageLimit } from '../scripts/auto-resume-policy.mjs';
const config = { threadId: 'test-thread', projectRoot: 'C:\\project', maxResumes: 6, graceMs: 90000 };
const state = { attempts: [], failedTurnId: 'failed-turn', failedSince: 0 };
const snapshot = () => ({ thread: { id: 'test-thread', cwd: 'C:\\project', status: { type: 'idle' } }, turns: [{ id: 'failed-turn', status: 'failed', error: { codexErrorInfo: 'usageLimitExceeded' } }], ordinaryUsageAllowed: true });
test('confirmed usage recovery resumes once after cooldown', () => {
  assert.equal(decideRecovery(snapshot(), state, config, 100000), 'resume');
  assert.equal(decideRecovery(snapshot(), { ...state, attempts: [{ turnId: 'failed-turn', result: 'reserved' }] }, config, 100000), 'already-attempted');
});
test('active thread always blocks resumption even with stale failed turn', () => {
  const value = snapshot(); value.thread.status.type = 'active';
  assert.equal(decideRecovery(value, state, config, 100000), 'active');
  value.thread.status.type = 'idle'; value.turns[0].status = 'inProgress';
  assert.equal(decideRecovery(value, state, config, 100000), 'active');
});
test('backend permission is mandatory; reset timestamps and percentages cannot grant it', () => {
  for (const permission of [false, null, undefined]) {
    const value = snapshot(); value.ordinaryUsageAllowed = permission;
    assert.equal(decideRecovery(value, state, config, 100000), 'waiting-limit');
  }
});
test('manual stop, completion, budget, network and auth errors are never resumed', () => {
  for (const status of ['interrupted', 'completed']) { const value = snapshot(); value.turns[0].status = status; assert.equal(decideRecovery(value, state, config, 100000), 'idle'); }
  for (const code of ['sessionBudgetExceeded', 'unauthorized', 'httpConnectionFailed', 'other']) { const value = snapshot(); value.turns[0].error.codexErrorInfo = code; assert.equal(decideRecovery(value, state, config, 100000), 'idle'); }
});
test('wrong project, missing thread and unloaded state fail closed', () => {
  const value = snapshot(); value.thread.cwd = 'C:\\unrelated'; assert.equal(decideRecovery(value, state, config, 100000), 'wrong-thread');
  assert.equal(decideRecovery({}, state, config, 100000), 'wrong-thread');
  for (const type of ['notLoaded', undefined]) { const value = snapshot(); value.thread.status.type = type; assert.equal(decideRecovery(value, state, config, 100000), 'unavailable'); }
});
test('actual desktop usage failure is systemError with a typographic apostrophe and no error code', () => {
  const value = snapshot(); value.thread.status.type = 'systemError';
  value.turns[0].error = { message: 'You’ve hit your usage limit. Try again later.', additionalDetails: null };
  assert.equal(decideRecovery(value, state, config, 100000), 'resume');
  value.ordinaryUsageAllowed = false;
  assert.equal(decideRecovery(value, state, config, 100000), 'waiting-limit');
  value.turns[0].error = { message: 'Connection was lost.' };
  assert.equal(decideRecovery(value, state, config, 100000), 'unavailable');
});
test('cooldown and maximum attempt count bound automatic work', () => {
  assert.equal(decideRecovery(snapshot(), state, config, 40000), 'cooldown');
  assert.equal(decideRecovery(snapshot(), { ...state, failedTurnId: 'previous' }, config, 100000), 'cooldown');
  assert.equal(decideRecovery(snapshot(), { ...state, attempts: Array.from({ length: 6 }, (_, i) => ({ turnId: String(i) })) }, config, 100000), 'attempt-limit');
});
test('legacy message match is narrow and never overrides explicit error codes', () => {
  assert.equal(isUsageLimit({status:'failed',error:{message:"You've hit your usage limit. Try later."}}), true);
  assert.equal(isUsageLimit({status:'failed',error:{message:'Some limit in a tool was reached'}}), false);
  assert.equal(isUsageLimit({status:'failed',error:{codexErrorInfo:'sessionBudgetExceeded',message:"You've hit your usage limit"}}), false);
});
