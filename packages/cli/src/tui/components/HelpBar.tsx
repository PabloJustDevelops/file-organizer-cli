import React from 'react';
import { Box, Text } from 'ink';

interface HelpBarProps {
  mode: 'preview' | 'organizing' | 'complete';
}

export const HelpBar: React.FC<HelpBarProps> = ({ mode }) => {
  if (mode === 'organizing') {
    return (
      <Box justifyContent="center" paddingX={1}>
        <Text dimColor>Organizing files, please wait...</Text>
      </Box>
    );
  }

  if (mode === 'complete') {
    return (
      <Box justifyContent="center" paddingX={1}>
        <Text>
          <Text color="green">Enter</Text> Continue | <Text color="yellow">q</Text> Quit
        </Text>
      </Box>
    );
  }

  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text>
        <Text color="cyan">↑↓</Text> Navigate
      </Text>
      <Text>
        <Text color="green">Enter</Text> Organize
      </Text>
      <Text>
        <Text color="yellow">d</Text> Dry run
      </Text>
      <Text>
        <Text color="red">q</Text> Quit
      </Text>
    </Box>
  );
};
