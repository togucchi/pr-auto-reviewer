import React from 'react';
import { Text, Box } from 'ink';

const { createElement: h } = React;

export default function Header({ isPolling, lastPollTime, pollInterval }) {
  const intervalSec = Math.round(pollInterval / 1000);
  const lastTime = lastPollTime
    ? lastPollTime.toLocaleTimeString('ja-JP', { hour12: false })
    : '--:--';
  const dot = isPolling ? '◉' : '●';

  return h(
    Box,
    { borderStyle: 'single', borderColor: 'cyan', paddingX: 1 },
    h(Text, { bold: true, color: 'cyan' }, 'PR Auto-Reviewer'),
    h(Box, { flexGrow: 1 }),
    h(
      Text,
      { dimColor: true },
      `Polling: ${dot} ${intervalSec}s  Last: ${lastTime}`,
    ),
  );
}
