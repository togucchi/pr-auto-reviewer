import { execFileSync } from 'child_process';
import fs from 'fs';
import React from 'react';
import { render } from 'ink';
import { REVIEW_REPORTS_DIR } from './config.js';
import App from './app.js';

function check(cmd, args, label) {
  try {
    execFileSync(cmd, args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    console.error(`Error: ${label} is not available. Please install and configure it.`);
    return false;
  }
}

// Preflight checks
if (!check('gh', ['--version'], 'GitHub CLI (gh)')) process.exit(1);
if (!check('gh', ['auth', 'status'], 'GitHub CLI auth')) process.exit(1);
if (!check('claude', ['--version'], 'Claude CLI')) process.exit(1);

// Log claude binary path and version for debugging
try {
  const claudePath = execFileSync('which', ['claude'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const claudeVersion = execFileSync(claudePath, ['--version'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  console.log(`Claude CLI: ${claudePath} (${claudeVersion})`);
} catch {
  // non-critical, continue
}

// Ensure review-reports directory exists
fs.mkdirSync(REVIEW_REPORTS_DIR, { recursive: true });

render(React.createElement(App));
