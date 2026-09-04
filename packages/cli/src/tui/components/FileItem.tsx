import React from 'react';
import { Text, Box } from 'ink';
import figures from 'figures';
import path from 'path';
import type { FileMatch } from '../hooks/useOrganizer.js';

interface FileItemProps {
  item: FileMatch;
  selected: boolean;
  index: number;
}

export const FileItem: React.FC<FileItemProps> = ({ item, selected, index }) => {
  const fileName = path.basename(item.file.path);
  const destDir = path.dirname(item.destination);

  return (
    <Box flexDirection="column" marginBottom={0}>
      <Box>
        <Text dimColor>{String(index + 1).padStart(3, ' ')}. </Text>
        {selected ? (
          <Text color="cyan" bold>
            {figures.pointer} {fileName}
          </Text>
        ) : (
          <Text>  {fileName}</Text>
        )}
      </Box>
      <Box marginLeft={6}>
        <Text dimColor>{figures.arrowRight} </Text>
        <Text color="green">{destDir}</Text>
        <Text dimColor> [{item.rule.name}]</Text>
      </Box>
    </Box>
  );
};
