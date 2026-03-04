import React from 'react';
import { Text, Box } from 'ink';

const { createElement: h } = React;
const MAX_VISIBLE_LINES = 8;

export default function ClaudeOutputPanel({ lines, prLabel }) {
  const visible = lines.slice(-MAX_VISIBLE_LINES);

  // Build fixed-height rows: always render exactly MAX_VISIBLE_LINES rows
  // to prevent layout height changes that corrupt Ink's rendering
  const rows = [];
  for (let i = 0; i < MAX_VISIBLE_LINES; i++) {
    if (i < visible.length) {
      rows.push(
        h(Text, { key: i, dimColor: true, wrap: 'truncate' }, `  ${visible[i]}`),
      );
    } else {
      rows.push(h(Text, { key: i }, ' '));
    }
  }

  return h(
    Box,
    { borderStyle: 'single', borderColor: 'magenta', paddingX: 1, flexDirection: 'column', height: MAX_VISIBLE_LINES + 3 },
    h(Text, { bold: true, color: 'magenta' }, `Claude Output${prLabel ? ` — ${prLabel}` : ''}`),
    ...rows,
  );
}
