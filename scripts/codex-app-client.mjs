import { spawn } from 'node:child_process';

/** Stdio MCP client for the installed Codex app-tools plugin. No credentials are copied. */
export async function connectCodexApp(serverPath, { timeout = 20000 } = {}) {
  if (!process.env.CODEX_APP_TOOLS_PIPE_PATH) throw new Error('Start from a Codex desktop terminal with CODEX_APP_TOOLS_PIPE_PATH available.');
  if (!process.env.CODEX_THREAD_ID) throw new Error('The originating Codex thread ID is unavailable.');
  const child = spawn(process.execPath, [serverPath], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '', sequence = 0;
  const pending = new Map();
  const fail = error => { for (const job of pending.values()) { clearTimeout(job.timer); job.reject(error); } pending.clear(); };
  child.on('error', fail);
  child.on('exit', () => fail(new Error('Codex app MCP connection closed')));
  child.stderr.resume();
  child.stdout.on('data', data => {
    buffer += data.toString();
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      const job = pending.get(message.id);
      if (!job) continue;
      pending.delete(message.id); clearTimeout(job.timer);
      if (message.error) job.reject(new Error(message.error.message));
      else job.resolve(message.result);
    }
  });
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Codex MCP timeout: ${method}`)); }, timeout);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const close = () => { fail(new Error('Client closed')); child.stdin.end(); child.kill(); };
  try {
    await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'kitsoe-recovery', version: '1.0.0' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  } catch (error) { close(); throw error; }
  return {
    close,
    async call(name, args) {
      if (!['read_thread', 'get_usage_limits', 'send_message_to_thread'].includes(name)) throw new Error('Tool is outside the recovery scope.');
      const response = await request('tools/call', { name, arguments: args, _meta: { 'openai/threadId': process.env.CODEX_THREAD_ID } });
      if (response.isError) throw new Error(response.content?.find(item => item.type === 'text')?.text || 'Codex app tool failed');
      const text = response.content?.find(item => item.type === 'text')?.text;
      if (!text) throw new Error('Codex app returned no text result');
      try { return JSON.parse(text); } catch {
        if (name === 'send_message_to_thread') return { acknowledgement: text };
        throw new Error('Codex app returned an unexpected result format');
      }
    },
  };
}
