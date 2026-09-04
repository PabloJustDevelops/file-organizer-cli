import React from 'react';
import { Box, Text } from 'ink';

interface ResultSummaryProps {
  moved: number;
  skipped: number;
  errors: number;
}

export const ResultSummary: React.FC<ResultSummaryProps> = ({ moved, skipped, errors }) => {
  const hasErrors = errors > 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={hasErrors ? 'red' : 'green'}
      paddingX={2}
      paddingY={1}
    >
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color={hasErrors ? 'yellow' : 'green'}>
          {hasErrors ? '⚠ Completed with errors' : '✓ Organization Complete'}
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text>Files moved:</Text>
        <Text color="green" bold>
          {moved}
        </Text>
      </Box>
      {skipped > 0 && (
        <Box justifyContent="space-between">
          <Text>Skipped:</Text>
          <Text color="yellow">{skipped}</Text>
        </Box>
      )}
      {errors > 0 && (
        <Box justifyContent="space-between">
          <Text>Errors:</Text>
          <Text color="red" bold>
            {errors}
          </Text>
        </Box>
      )}
    </Box>
  );
};
