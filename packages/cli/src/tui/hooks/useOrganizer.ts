import { useState, useEffect, useCallback } from 'react';
import path from 'path';
import { Organizer } from '../../core/organizer.js';
import { loadConfig, findConfigPath } from '../../config/loader.js';
import type { OrganizeConfig } from '../../types/index.js';
import type { FileInfo, Rule } from '../../types/index.js';

export interface FileMatch {
  file: FileInfo;
  destination: string;
  rule: Rule;
}

export interface OrganizerState {
  loading: boolean;
  files: FileMatch[];
  config: OrganizeConfig | null;
  source: string;
  error: string | null;
}

export interface OrganizerActions {
  organize: () => Promise<OrganizeResult>;
  refresh: () => Promise<void>;
}

export interface OrganizeResult {
  moved: number;
  skipped: number;
  errors: number;
}

export function useOrganizer(source: string, configPath?: string): [OrganizerState, OrganizerActions] {
  const [state, setState] = useState<OrganizerState>({
    loading: true,
    files: [],
    config: null,
    source: path.resolve(source),
    error: null,
  });

  const [organizer] = useState(() => new Organizer());

  const loadFiles = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const resolvedSource = path.resolve(source);
      let cfgPath = configPath;

      if (!cfgPath) {
        cfgPath = findConfigPath(resolvedSource) || undefined;
      }

      if (!cfgPath) {
        setState((s) => ({
          ...s,
          loading: false,
          error: 'No config file found. Run "fo config init" first.',
        }));
        return;
      }

      const config = await loadConfig(cfgPath);
      organizer.setRules(config.rules);

      const result = await organizer.preview(resolvedSource, {
        recursive: config.recursive,
        includeHidden: config.includeHidden,
      });

      const files: FileMatch[] = result.moved.map((m) => ({
        file: {
          path: m.from,
          name: path.basename(m.from, path.extname(m.from)),
          extension: path.extname(m.from).slice(1),
          size: 0,
          createdAt: new Date(),
          modifiedAt: new Date(),
          isDirectory: false,
        },
        destination: m.to,
        rule: config.rules.find((r) => r.name === m.rule) || config.rules[0],
      }));

      setState({
        loading: false,
        files,
        config,
        source: resolvedSource,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState((s) => ({
        ...s,
        loading: false,
        error: message,
      }));
    }
  }, [source, configPath, organizer]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const organize = useCallback(async (): Promise<OrganizeResult> => {
    const result = await organizer.organize(state.source, {
      dryRun: false,
      conflictResolution: state.config?.conflictResolution || 'rename',
      recursive: state.config?.recursive,
      includeHidden: state.config?.includeHidden,
    });

    return {
      moved: result.moved.length,
      skipped: result.skipped.length,
      errors: result.errors.length,
    };
  }, [organizer, state.source, state.config]);

  return [state, { organize, refresh: loadFiles }];
}
