import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { MAX_CONCURRENT_REVIEWS, CLAUDE_TIMEOUT_MS, REVIEW_REPORTS_DIR, PROJECT_ROOT } from '../config.js';
import store from '../store.js';
import { notifyComplete, notifyFailed } from './notifier.js';

let running = 0;
const queue = [];

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

export function enqueue(pr) {
  queue.push(pr);
  processQueue();
}

function runReview(pr) {
  running++;
  store.updatePR(pr.url, { status: 'reviewing' });
  store.addLog(`Starting review: ${pr.repo}#${pr.number}`);

  const beforeReports = getExistingReports();

  const prompt = `PRレビューレポートスキルを使って ${pr.url} のレビューレポートを作成して。レポートは ./review-reports/ に保存して。確認不要でそのまま保存してください。`;

  const child = spawn('claude', ['--print', '-p', prompt], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));

  const timeout = setTimeout(() => {
    child.kill('SIGTERM');
    store.updatePR(pr.url, { status: 'failed', error: 'Timeout' });
    store.addLog(`Review timeout: ${pr.repo}#${pr.number}`);
  }, CLAUDE_TIMEOUT_MS);

  child.on('close', (code) => {
    clearTimeout(timeout);
    running--;

    if (code === 0) {
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
