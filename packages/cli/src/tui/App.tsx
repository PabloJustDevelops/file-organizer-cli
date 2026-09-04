import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import figures from 'figures';
import { useOrganizer, type OrganizeResult } from './hooks/useOrganizer.js';
import { FileList } from './components/FileList.js';
import { Stats } from './components/Stats.js';
import { HelpBar } from './components/HelpBar.js';
import { ProgressBar } from './components/ProgressBar.js';
import { ResultSummary } from './components/ResultSummary.js';

type Mode = 'loading' | 'preview' | 'organizing' | 'complete' | 'error';

interface AppProps {
  source: string;
  configPath?: string;
}

export const App: React.FC<AppProps> = ({ source, configPath }) => {
  const { exit } = useApp();
  const [state, actions] = useOrganizer(source, configPath);

  const [mode, setMode] = useState<Mode>('loading');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const visibleRows = 10;

  useEffect(() => {
    if (state.error) {
      setMode('error');
    } else if (!state.loading && state.files.length > 0) {
      setMode('preview');
    } else if (!state.loading && state.files.length === 0) {
      setMode('complete');
    }
  }, [state.loading, state.error, state.files.length]);

  const handleOrganize = useCallback(async () => {
    if (dryRun) {
      setResult({
        moved: state.files.length,
        skipped: 0,
        errors: 0,
      });
      setMode('complete');
      return;
    }

    setMode('organizing');
    setProgress({ current: 0, total: state.files.length });

    try {
      const res = await actions.organize();
      setResult(res);
      setMode('complete');
    } catch {
      setResult({ moved: 0, skipped: 0, errors: state.files.length });
      setMode('complete');
    }
  }, [actions, dryRun, state.files.length]);

  useInput((input, key) => {
    if (mode === 'preview') {
      if (key.upArrow) {
        setSelectedIndex((i) => {
          const next = Math.max(0, i - 1);
          if (next < scrollOffset) {
            setScrollOffset(next);
          }
          return next;
        });
      } else if (key.downArrow) {
        setSelectedIndex((i) => {
          const next = Math.min(state.files.length - 1, i + 1);
          if (next >= scrollOffset + visibleRows) {
            setScrollOffset(next - visibleRows + 1);
          }
          return next;
        });
      } else if (input === 'd') {
        setDryRun((d) => !d);
      } else if (key.return || input === 'o') {
        handleOrganize();
      } else if (input === 'q' || key.escape) {
        exit();
      }
    } else if (mode === 'complete') {
      if (key.return || input === 'q') {
        exit();
      }
    } else if (mode === 'error') {
      if (input === 'q' || key.escape) {
        exit();
      }
    }
  });

  if (mode === 'loading') {
    return (
      <Box flexDirection="column" padding={2}>
        <Text>
          <Text color="cyan">{figures.pointer} </Text>
          Scanning files...
        </Text>
      </Box>
    );
  }

  if (mode === 'error') {
    return (
      <Box flexDirection="column" padding={2}>
        <Box borderStyle="single" borderColor="red" paddingX={2} paddingY={1}>
          <Text color="red" bold>
            Error
          </Text>
          <Text> </Text>
          <Text>{state.error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press q to quit</Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'organizing') {
    return (
      <Box flexDirection="column" padding={2}>
        <Text bold color="cyan">
          Organizing files...
        </Text>
        <ProgressBar current={progress.current} total={progress.total} />
        <Box marginTop={1}>
          <Text dimColor>Press Ctrl+C to cancel</Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'complete' && result) {
    return (
      <Box flexDirection="column" padding={2}>
        <ResultSummary moved={result.moved} skipped={result.skipped} errors={result.errors} />
        <Box marginTop={1}>
          <HelpBar mode="complete" />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📁 File Organizer TUI
        </Text>
        {dryRun && <Text color="yellow"> [DRY RUN]</Text>}
      </Box>

      <Box>
        <Box flexGrow={1} marginRight={1}>
          <FileList
            files={state.files}
            selectedIndex={selectedIndex}
            scrollOffset={scrollOffset}
            visibleRows={visibleRows}
          />
        </Box>
        <Box width={35}>
          <Stats files={state.files} source={state.source} />
        </Box>
      </Box>

      <Box marginTop={1}>
        <HelpBar mode="preview" />
      </Box>
    </Box>
  );
};
