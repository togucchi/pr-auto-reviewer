import React from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';

const { createElement: h } = React;

const STATUS_ICON = {
  queued: () => h(Text, { color: 'gray' }, '○'),
  reviewing: () => h(Spinner, { type: 'dots' }),
  completed: () => h(Text, { color: 'green' }, '✓'),
  failed: () => h(Text, { color: 'red' }, '✗'),
};

const STATUS_COLOR = {
  queued: 'gray',
  reviewing: 'yellow',
  completed: 'green',
  failed: 'red',
};

export default function PRList({ prs }) {
  if (prs.length === 0) {
    return h(
      Box,
      { borderStyle: 'single', borderColor: 'gray', paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true }, 'Review Requests'),
      h(Text, { dimColor: true }, '  No review requests found'),
    );
  }

  return h(
    Box,
    { borderStyle: 'single', borderColor: 'gray', paddingX: 1, flexDirection: 'column' },
    h(Text, { bold: true }, 'Review Requests'),
    ...prs.map((pr) =>
      h(
        Box,
        { key: pr.url, gap: 1 },
        h(Box, { width: 3 }, (STATUS_ICON[pr.status] || (() => h(Text, null, '?')))()),
        h(
          Text,
          { color: STATUS_COLOR[pr.status] },
          pr.status.padEnd(10),
        ),
        h(Text, { color: 'white' }, `${pr.repo}#${pr.number}`),
        h(Text, { dimColor: true }, `  ${pr.title}`),
      ),
    ),
  );
}
