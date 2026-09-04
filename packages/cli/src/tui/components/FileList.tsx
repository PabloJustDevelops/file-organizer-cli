import React from 'react';
import { Box, Text } from 'ink';
import type { FileMatch } from '../hooks/useOrganizer.js';
import { FileItem } from './FileItem.js';

interface FileListProps {
  files: FileMatch[];
  selectedIndex: number;
  scrollOffset: number;
  visibleRows: number;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  selectedIndex,
  scrollOffset,
  visibleRows,
}) => {
  if (files.length === 0) {
    return (
      <Box marginY={1}>
        <Text color="yellow">No files to organize.</Text>
      </Box>
    );
  }

  const visibleFiles = files.slice(scrollOffset, scrollOffset + visibleRows);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Files to organize ({files.length})
        </Text>
      </Box>
      {visibleFiles.map((file, idx) => {
        const actualIndex = scrollOffset + idx;
        return (
          <FileItem
            key={file.file.path}
            item={file}
            selected={actualIndex === selectedIndex}
            index={actualIndex}
          />
        );
      })}
      {files.length > visibleRows && (
        <Box marginTop={1}>
          <Text dimColor>
            Showing {scrollOffset + 1}-{Math.min(scrollOffset + visibleRows, files.length)} of {files.length}
          </Text>
        </Box>
      )}
    </Box>
  );
};
