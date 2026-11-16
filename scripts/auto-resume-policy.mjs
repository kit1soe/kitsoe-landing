export const RESUME_PROMPT = 'Автоматическое продолжение по просьбе владельца после восстановления лимита. Продолжи работу над kitsoe-landing в этом же чате, сохраняя текущую модель. Прочитай PROJECT_STATE.md, TASKS.md, DECISIONS.md, git status и последние коммиты; восстанови контекст из локальной памяти MGI-Mind. Выполни оставшиеся задачи и проверки до готовности. Не публикуй сайт. Не запускай конкурирующие сессии и не обходи лимиты. После завершения всех задач создай .local/project-complete.json и останови наблюдатель auto resume.';

export function isUsageLimit(turn) {
  if (turn?.status !== 'failed') return false;
  const info = turn.error?.codexErrorInfo;
  const code = typeof info === 'string' ? info : Object.keys(info || {})[0];
  if (code === 'usageLimitExceeded' || code === 'rateLimitExceeded') return true;
  // Some desktop versions omit the structured code. Do not match generic errors or budgets.
  return !code && /you(?:'|’)ve hit your usage limit|usage limit (?:has been )?(?:reached|exceeded)/i.test(turn.error?.message || '');
}

/** Fail closed: recovery requires the native desktop state AND backend permission. */
export function decideRecovery(snapshot, state, config, now = Date.now()) {
  if (snapshot.thread?.id !== config.threadId || snapshot.thread?.cwd?.toLowerCase() !== config.projectRoot.toLowerCase()) return 'wrong-thread';
  const type = snapshot.thread?.status?.type;
  const turn = snapshot.turns?.[0];
  if (type === 'active' || turn?.status === 'inProgress') return 'active';
  if (type !== 'idle') return 'unavailable';
  if (!isUsageLimit(turn)) return 'idle';
  if (state.attempts.some(attempt => attempt.turnId === turn.id)) return 'already-attempted';
  if (state.attempts.length >= config.maxResumes) return 'attempt-limit';
  if (snapshot.ordinaryUsageAllowed !== true) return 'waiting-limit';
  if (state.failedTurnId !== turn.id || now - state.failedSince < config.graceMs) return 'cooldown';
  return 'resume';
}
