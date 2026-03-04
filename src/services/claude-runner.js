import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { MAX_CONCURRENT_REVIEWS, CLAUDE_TIMEOUT_MS, REVIEW_REPORTS_DIR, PROJECT_ROOT } from '../config.js';
import store from '../store.js';
import { notifyComplete, notifyFailed } from './notifier.js';

// Resolve claude binary absolute path at module load
let claudeBin;
try {
  claudeBin = execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim();
} catch {
  throw new Error('claude CLI not found in PATH');
}

// Log resolved binary info
const claudeVersion = execFileSync(claudeBin, ['--version'], {
  encoding: 'utf-8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
// Logged via store.addLog after Ink mounts (console.log breaks Ink rendering)
const claudeBinInfo = `[claude-runner] binary: ${claudeBin} (${claudeVersion})`;

let running = 0;
const queue = [];

function formatStreamEvent(event) {
  // Init event
  if (event.type === 'system' && event.subtype === 'init') {
    return `ℹ Session started (${event.model || 'unknown'})`;
  }

  // Assistant message — extract tool use and text
  if (event.type === 'assistant' && event.message?.content) {
    const parts = [];
    for (const block of event.message.content) {
      if (block.type === 'tool_use') {
        const input = block.input || {};
        let detail = '';
        if (block.name === 'Read' && input.file_path) {
          detail = `: ${path.basename(input.file_path)}`;
        } else if (block.name === 'Write' && input.file_path) {
          detail = `: ${path.basename(input.file_path)}`;
        } else if (block.name === 'Edit' && input.file_path) {
          detail = `: ${path.basename(input.file_path)}`;
        } else if (block.name === 'Bash' && input.command) {
          detail = `: ${input.command.slice(0, 60)}`;
        } else if (block.name === 'Glob' && input.pattern) {
          detail = `: ${input.pattern}`;
        } else if (block.name === 'Grep' && input.pattern) {
          detail = `: ${input.pattern}`;
        }
        parts.push(`⚡ ${block.name}${detail}`);
      } else if (block.type === 'text' && block.text) {
        const trimmed = block.text.trim();
        if (trimmed.length > 0) {
          parts.push(trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed);
        }
      }
    }
    return parts.length > 0 ? parts.join(' | ') : null;
  }

  // Tool result
  if (event.type === 'tool_result') {
    return null; // skip verbose tool results
  }

  // Result event (final)
  if (event.type === 'result') {
    const cost = event.total_cost_usd != null ? ` ($${event.total_cost_usd.toFixed(4)})` : '';
    const turns = event.num_turns ? ` ${event.num_turns} turns` : '';
    return `✓ Complete${turns}${cost}`;
  }

  return null;
}

function getExistingReports() {
  try {
    return new Set(fs.readdirSync(REVIEW_REPORTS_DIR));
  } catch {
    return new Set();
  }
}

function findNewReport(beforeSet) {
  try {
    const after = fs.readdirSync(REVIEW_REPORTS_DIR);
    const newFile = after.find((f) => !beforeSet.has(f));
    return newFile ? path.join(REVIEW_REPORTS_DIR, newFile) : null;
  } catch {
    return null;
  }
}

function processQueue() {
  while (running < MAX_CONCURRENT_REVIEWS && queue.length > 0) {
    const pr = queue.shift();
    runReview(pr);
  }
}

let logged = false;
export function enqueue(pr) {
  if (!logged) {
    logged = true;
    store.addLog(claudeBinInfo);
  }
  queue.push(pr);
  processQueue();
}

function runReview(pr) {
  running++;
  store.updatePR(pr.url, { status: 'reviewing' });
  store.addLog(`Starting review: ${pr.repo}#${pr.number}`);

  const beforeReports = getExistingReports();

  // Verify claude version before each review
  try {
    const ver = execFileSync(claudeBin, ['--version'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    store.addLog(`[claude-runner] Using: ${claudeBin} (${ver})`);
  } catch (e) {
    store.addLog(`[claude-runner] WARNING: version check failed: ${e.message}`);
  }

  const prompt = `PRレビューレポートスキルを使って ${pr.url} のレビューレポートを作成して。レポートは ./review-reports/ に保存して。確認不要でそのまま保存してください。`;

  const child = spawn(claudeBin, [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
  ], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    detached: true,
  });

  let stderr = '';
  let stdoutBuffer = '';
  child.stdout.on('data', (d) => {
    stdoutBuffer += d;
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); // keep incomplete line in buffer
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        const display = formatStreamEvent(event);
        if (display) {
          store.addClaudeOutput(pr.url, display);
        }
      } catch {
        // non-JSON line, show as-is
        store.addClaudeOutput(pr.url, line);
      }
    }
  });
  child.stderr.on('data', (d) => (stderr += d));

  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    store.addLog(`Review timeout: ${pr.repo}#${pr.number} — sending SIGTERM`);

    // Kill the entire process group to include child processes
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }

    // Force kill after 5 seconds if SIGTERM didn't work
    setTimeout(() => {
      if (!child.killed) {
        store.addLog(`Force killing review: ${pr.repo}#${pr.number}`);
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    }, 5_000);
  }, CLAUDE_TIMEOUT_MS);

  child.on('close', (code) => {
    clearTimeout(timeout);
    running--;
    store.flushClaudeOutput();

    if (timedOut) {
      store.updatePR(pr.url, { status: 'failed', error: 'Timeout' });
      notifyFailed(pr, 'Timeout');
    } else if (code === 0) {
      const reportPath = findNewReport(beforeReports);
      store.updatePR(pr.url, { status: 'completed', reportPath });
      store.addLog(
        `Review complete: ${pr.repo}#${pr.number}${reportPath ? ` → ${path.basename(reportPath)}` : ''}`,
      );
      notifyComplete(pr, reportPath);
    } else {
      const errMsg = stderr.trim() || `Exit code ${code}`;
      store.updatePR(pr.url, { status: 'failed', error: errMsg });
      store.addLog(`Review failed: ${pr.repo}#${pr.number} - ${errMsg}`);
      notifyFailed(pr, errMsg);
    }

    processQueue();
  });
}
