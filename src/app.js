import React from 'react';
import { execFile } from 'child_process';
import { Box, Text, useApp, useInput } from 'ink';
import { POLL_INTERVAL_MS } from './config.js';
import store from './store.js';
import { poll } from './services/github-poller.js';
import { enqueue } from './services/claude-runner.js';
import Header from './components/header.js';
import PRList from './components/pr-list.js';
import LogPanel from './components/log-panel.js';
import ClaudeOutputPanel from './components/claude-output-panel.js';

const { createElement: h, useState, useEffect, useCallback, useRef } = React;

export default function App() {
  const { exit } = useApp();
  const isInitialPoll = useRef(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [state, setState] = useState({
    prs: store.getPRs(),
    logs: store.logs,
    isPolling: store.isPolling,
    lastPollTime: store.lastPollTime,
  });

  const syncState = useCallback(() => {
    const prs = store.getPRs();
    // Find the currently reviewing PR to show its Claude output
    const reviewingPR = prs.find((p) => p.status === 'reviewing');
    setState({
      prs,
      logs: [...store.logs],
      isPolling: store.isPolling,
      lastPollTime: store.lastPollTime,
      claudeOutput: reviewingPR ? store.getClaudeOutput(reviewingPR.url) : [],
      claudeOutputLabel: reviewingPR ? `${reviewingPR.repo}#${reviewingPR.number}` : null,
    });
  }, []);

  useEffect(() => {
    store.on('change', syncState);
    return () => store.off('change', syncState);
  }, [syncState]);

  const doPoll = useCallback(async () => {
    const initial = isInitialPoll.current;
    const before = new Set(store.prs.keys());
    if (initial) {
      isInitialPoll.current = false;
    }
    await poll(initial ? 'pending' : 'queued');
    for (const [url, pr] of store.prs) {
      if (!before.has(url) && pr.status === 'queued') {
        enqueue(pr);
      }
    }
  }, []);

  useEffect(() => {
    doPoll();
    const timer = setInterval(doPoll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [doPoll]);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
    } else if (input === 'r') {
      doPoll();
    } else if (input === ' ') {
      const failed = store.getFailedPRs();
      for (const pr of failed) {
        store.resetPR(pr.url);
        enqueue(pr);
      }
      if (failed.length > 0) {
        store.addLog(`Retrying ${failed.length} failed review(s)`);
      }
    } else if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      const prs = store.getPRs();
      setSelectedIndex((prev) => Math.min(prs.length - 1, prev + 1));
    } else if (input === 'o') {
      const prs = store.getPRs();
      const pr = prs[selectedIndex];
      if (pr && pr.status === 'completed' && pr.reportPath) {
        execFile('open', [pr.reportPath]);
        store.addLog(`Opening report: ${pr.repo}#${pr.number}`);
      } else {
        store.addLog('レポートがありません');
      }
    } else if (key.return) {
      const prs = store.getPRs();
      const pr = prs[selectedIndex];
      if (pr && (pr.status === 'pending' || pr.status === 'failed' || pr.status === 'completed')) {
        store.resetPR(pr.url);
        enqueue(pr);
        store.addLog(`Manual review started: ${pr.repo}#${pr.number}`);
      }
    }
  });

  return h(
    Box,
    { flexDirection: 'column' },
    h(Header, {
      isPolling: state.isPolling,
      lastPollTime: state.lastPollTime,
      pollInterval: POLL_INTERVAL_MS,
    }),
    h(PRList, { prs: state.prs, selectedIndex }),
    h(ClaudeOutputPanel, { lines: state.claudeOutput || [], prLabel: state.claudeOutputLabel }),
    h(LogPanel, { logs: state.logs }),
    h(
      Box,
      { borderStyle: 'single', borderColor: 'gray', paddingX: 1 },
      h(
        Text,
        { dimColor: true },
        '[q] quit  [r] refresh now  [space] retry failed  [↑↓] select  [enter] review  [o] open report',
      ),
    ),
  );
}
