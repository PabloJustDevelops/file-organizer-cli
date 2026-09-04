import React from 'react';
import { Box, Text } from 'ink';
import type { FileMatch } from '../hooks/useOrganizer.js';

interface StatsProps {
  files: FileMatch[];
  source: string;
}

export const Stats: React.FC<StatsProps> = ({ files, source }) => {
  const ruleCounts = files.reduce<Record<string, number>>((acc, f) => {
    acc[f.rule.name] = (acc[f.rule.name] || 0) + 1;
    return acc;
  }, {});

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Statistics
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text>Source:</Text>
        <Text color="yellow">{source}</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text>Files to move:</Text>
        <Text color="green" bold>
          {files.length}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>By rule:</Text>
      </Box>
      {Object.entries(ruleCounts).map(([rule, count]) => (
        <Box key={rule} justifyContent="space-between" marginLeft={2}>
          <Text>{rule}</Text>
          <Text color="cyan">{count}</Text>
        </Box>
      ))}
    </Box>
  );
};
