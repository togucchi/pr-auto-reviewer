import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const POLL_INTERVAL_MS = 60_000;
export const MAX_CONCURRENT_REVIEWS = 2;
export const REVIEW_REPORTS_DIR = path.resolve(__dirname, '..', 'review-reports');
export const CLAUDE_TIMEOUT_MS = 1_800_000;
export const MAX_LOG_ENTRIES = 100;
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const REVIEWED_PRS_PATH = path.resolve(__dirname, '..', '.reviewed-prs.json');
