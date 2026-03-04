import { EventEmitter } from 'events';
import fs from 'fs';
import { MAX_LOG_ENTRIES, REVIEWED_PRS_PATH } from './config.js';

const MAX_CLAUDE_OUTPUT_LINES = 50;
const CLAUDE_OUTPUT_THROTTLE_MS = 500;

class Store extends EventEmitter {
  constructor() {
    super();
    this.prs = new Map();
    this.reviewedUrls = new Set();
    this.logs = [];
    this.claudeOutput = new Map(); // url -> string[]
    this._claudeOutputDirty = false;
    this._claudeOutputTimer = null;
    this.lastPollTime = null;
    this.isPolling = false;
    this._loadReviewed();
  }

  _loadReviewed() {
    try {
      const data = JSON.parse(fs.readFileSync(REVIEWED_PRS_PATH, 'utf-8'));
      for (const url of data) {
        this.reviewedUrls.add(url);
      }
    } catch {
      // File doesn't exist yet — that's fine
    }
  }

  _saveReviewed() {
    fs.writeFileSync(
      REVIEWED_PRS_PATH,
      JSON.stringify([...this.reviewedUrls], null, 2) + '\n',
    );
  }

  isReviewed(url) {
    return this.reviewedUrls.has(url);
  }

  addPR(pr, status = 'queued') {
    if (this.prs.has(pr.url)) return false;
    const isReviewed = this.reviewedUrls.has(pr.url);
    this.prs.set(pr.url, {
      url: pr.url,
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      status: isReviewed ? 'completed' : status,
      reportPath: null,
      error: null,
    });
    this.emit('change');
    return !isReviewed;
  }

  updatePR(url, updates) {
    const pr = this.prs.get(url);
    if (!pr) return;
    Object.assign(pr, updates);
    if (updates.status === 'completed') {
      this.reviewedUrls.add(url);
      this._saveReviewed();
    }
    this.emit('change');
  }

  getPRs() {
    return Array.from(this.prs.values());
  }

  getFailedPRs() {
    return this.getPRs().filter((pr) => pr.status === 'failed');
  }

  resetPR(url) {
    const pr = this.prs.get(url);
    if (!pr || pr.status === 'queued' || pr.status === 'reviewing') return;
    pr.status = 'queued';
    pr.error = null;
    pr.reportPath = null;
    this.emit('change');
  }

  addLog(message) {
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    this.logs.push({ timestamp, message });
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
    }
    this.emit('change');
  }

  addClaudeOutput(url, line) {
    if (!this.claudeOutput.has(url)) {
      this.claudeOutput.set(url, []);
    }
    const lines = this.claudeOutput.get(url);
    lines.push(line);
    if (lines.length > MAX_CLAUDE_OUTPUT_LINES) {
      lines.splice(0, lines.length - MAX_CLAUDE_OUTPUT_LINES);
    }
    // Throttle re-renders for claude output
    this._claudeOutputDirty = true;
    if (!this._claudeOutputTimer) {
      this._claudeOutputTimer = setTimeout(() => {
        this._claudeOutputTimer = null;
        if (this._claudeOutputDirty) {
          this._claudeOutputDirty = false;
          this.emit('change');
        }
      }, CLAUDE_OUTPUT_THROTTLE_MS);
    }
  }

  flushClaudeOutput() {
    if (this._claudeOutputTimer) {
      clearTimeout(this._claudeOutputTimer);
      this._claudeOutputTimer = null;
    }
    if (this._claudeOutputDirty) {
      this._claudeOutputDirty = false;
      this.emit('change');
    }
  }

  getClaudeOutput(url) {
    return this.claudeOutput.get(url) || [];
  }

  clearClaudeOutput(url) {
    this.claudeOutput.delete(url);
  }

  setPolling(isPolling) {
    this.isPolling = isPolling;
    if (isPolling) this.lastPollTime = new Date();
    this.emit('change');
  }
}

export default new Store();
