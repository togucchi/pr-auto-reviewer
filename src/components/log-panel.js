import React from 'react';
import { Text, Box } from 'ink';

const { createElement: h } = React;
const MAX_VISIBLE_LOGS = 8;

export default function LogPanel({ logs }) {
  const visible = logs.slice(-MAX_VISIBLE_LOGS);

  return h(
    Box,
    { borderStyle: 'single', borderColor: 'gray', paddingX: 1, flexDirection: 'column' },
    h(Text, { bold: true }, 'Activity Log'),
    visible.length === 0
      ? h(Text, { dimColor: true }, '  Waiting for activity...')
      : visible.map((entry, i) =>
          h(
            Text,
            { key: i, dimColor: true },
            `  [${entry.timestamp}] ${entry.message}`,
          ),
        ),
  );
}
