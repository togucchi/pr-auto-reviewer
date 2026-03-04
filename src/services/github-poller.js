import { execFileSync } from 'child_process';
import store from '../store.js';

let currentUser = null;

function getUser() {
  if (currentUser) return currentUser;
  currentUser = execFileSync('gh', ['api', 'user', '--jq', '.login'], {
    encoding: 'utf-8',
  }).trim();
  return currentUser;
}

export async function poll() {
  store.setPolling(true);
  store.addLog('Polling for review requests...');

  try {
    const user = getUser();
    const query = `type:pr+review-requested:${user}+state:open`;
    const result = execFileSync(
      'gh',
      [
        'api',
        `search/issues?q=${query}&per_page=100`,
        '--jq',
        '.items[] | {url: .pull_request.html_url, number: .number, title: .title, repo: .repository_url}',
      ],
      { encoding: 'utf-8' },
    );

    const lines = result.trim().split('\n').filter(Boolean);
    let newCount = 0;

    for (const line of lines) {
      const item = JSON.parse(line);
      const repo = item.repo.replace('https://api.github.com/repos/', '');
      const added = store.addPR({
        url: item.url,
        repo,
        number: item.number,
        title: item.title,
      });
      if (added) newCount++;
    }

    store.addLog(
      newCount > 0
        ? `Found ${newCount} new review request(s)`
        : 'No new review requests',
    );
  } catch (err) {
    store.addLog(`Polling error: ${err.message}`);
  } finally {
    store.setPolling(false);
  }
}
