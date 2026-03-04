import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { POLL_INTERVAL_MS } from './config.js';
import store from './store.js';
import { poll } from './services/github-poller.js';
import { enqueue } from './services/claude-runner.js';
import Header from './components/header.js';
import PRList from './components/pr-list.js';
import LogPanel from './components/log-panel.js';

const { createElement: h, useState, useEffect, useCallback } = React;

export default function App() {
  const { exit } = useApp();
  const [state, setState] = useState({
    prs: store.getPRs(),
    logs: store.logs,
    isPolling: store.isPolling,
    lastPollTime: store.lastPollTime,
  });

  const syncState = useCallback(() => {
    setState({
      prs: store.getPRs(),
      logs: [...store.logs],
      isPolling: store.isPolling,
      lastPollTime: store.lastPollTime,
    });
  }, []);

  useEffect(() => {
    store.on('change', syncState);
    return () => store.off('change', syncState);
  }, [syncState]);

  const doPoll = useCallback(async () => {
    const before = new Set(store.prs.keys());
    await poll();
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

  useInput((input) => {
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
    h(PRList, { prs: state.prs }),
    h(LogPanel, { logs: state.logs }),
    h(
      Box,
      { borderStyle: 'single', borderColor: 'gray', paddingX: 1 },
      h(
        Text,
        { dimColor: true },
        '[q] quit  [r] refresh now  [space] retry failed',
      ),
    ),
  );
}
