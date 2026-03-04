import { EventEmitter } from 'events';
import fs from 'fs';
import { MAX_LOG_ENTRIES, REVIEWED_PRS_PATH } from './config.js';

class Store extends EventEmitter {
  constructor() {
    super();
    this.prs = new Map();
    this.reviewedUrls = new Set();
    this.logs = [];
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

  addPR(pr) {
    if (this.prs.has(pr.url)) return false;
    if (this.reviewedUrls.has(pr.url)) return false;
    this.prs.set(pr.url, {
      url: pr.url,
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      status: 'queued',
      reportPath: null,
      error: null,
    });
    this.emit('change');
    return true;
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
    if (!pr || pr.status !== 'failed') return;
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

  setPolling(isPolling) {
    this.isPolling = isPolling;
    if (isPolling) this.lastPollTime = new Date();
    this.emit('change');
  }
}

export default new Store();
