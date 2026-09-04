import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  current: number;
  total: number;
  fileName?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, fileName }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const barWidth = 30;
  const filledWidth = Math.round((percentage / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text>Progress: </Text>
        <Text color="cyan">
          {filled}
          {empty}
        </Text>
        <Text bold> {percentage}%</Text>
      </Box>
      <Box>
        <Text dimColor>
          {current}/{total} files
        </Text>
      </Box>
      {fileName && (
        <Box marginTop={1}>
          <Text dimColor>Current: </Text>
          <Text color="yellow" wrap="truncate">
            {fileName}
          </Text>
        </Box>
      )}
    </Box>
  );
};
