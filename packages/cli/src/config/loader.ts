import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import type { OrganizeConfig, Rule, AppConfig } from '../types/index.js';
import { validateRuleCore } from '../core/rule-validation.js';
import { logger } from '../utils/logger.js';

export const DEFAULT_CONFIG: AppConfig = {
  defaultRules: [],
  historySize: 50,
  conflictResolution: 'rename',
  watchIgnorePatterns: ['node_modules', '.git', 'dist', '.cache'],
  plugins: [],
  logLevel: 'info',
};

export async function loadConfig(configPath: string): Promise<OrganizeConfig> {
  if (!(await fs.pathExists(configPath))) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = await fs.readFile(configPath, 'utf-8');
  const parsed = yaml.parse(content);

  return validateAndNormalizeConfig(parsed);
}

export async function saveConfig(
  configPath: string,
  config: OrganizeConfig
): Promise<void> {
  const dir = path.dirname(configPath);
  await fs.ensureDir(dir);

  const yamlString = yaml.stringify(config, {
    indent: 2,
    lineWidth: 120,
  });

  await fs.writeFile(configPath, yamlString, 'utf-8');
}

export function validateAndNormalizeConfig(config: unknown): OrganizeConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config: must be an object');
  }

  const raw = config as Record<string, unknown>;
  const rules: Rule[] = [];

  if (raw.rules && Array.isArray(raw.rules)) {
    for (const rawRule of raw.rules) {
      rules.push(validateRule(rawRule));
    }
  }

  const normalized: OrganizeConfig = {
    rules,
    conflictResolution: validateConflictResolution(raw.conflictResolution),
    dryRun: Boolean(raw.dryRun),
    recursive: raw.recursive !== false,
    includeHidden: Boolean(raw.includeHidden),
  };

  if (raw.locale !== undefined) {
    if (typeof raw.locale !== 'string' || raw.locale.trim() === '') {
      throw new Error('Invalid config: locale must be a non-empty string (e.g. "en-US", "es-ES")');
    }
    // Sanity-check the tag early so users get a config-time error,
    // not silent English fallback at organize time.
    try {
      Intl.DateTimeFormat.supportedLocalesOf([raw.locale]);
    } catch {
      throw new Error(`Invalid config: "${raw.locale}" is not a valid BCP-47 locale tag`);
    }
    normalized.locale = raw.locale.trim();
  }

  if (raw.sizeBuckets && typeof raw.sizeBuckets === 'object') {
    const rawBuckets = raw.sizeBuckets as Record<string, unknown>;
    const buckets: NonNullable<OrganizeConfig['sizeBuckets']> = {};
    for (const key of ['small', 'medium', 'large'] as const) {
      const value = rawBuckets[key];
      if (value === undefined) continue;
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) {
        throw new Error(`Invalid config: sizeBuckets.${key} must be a positive number of bytes`);
      }
      buckets[key] = num;
    }
    normalized.sizeBuckets = buckets;
  }

  if (raw.plugins !== undefined) {
    if (!Array.isArray(raw.plugins)) {
      throw new Error('Invalid config: plugins must be an array of strings');
    }
    const pluginSpecs: string[] = [];
    const seen = new Set<string>();
    raw.plugins.forEach((entry: unknown, index: number) => {
      if (typeof entry !== 'string' || entry.trim() === '') {
        throw new Error(`Invalid config: plugins[${index}] must be a non-empty string`);
      }
      if (seen.has(entry)) {
        throw new Error(`Invalid config: plugins[${index}] duplicates "${entry}"`);
      }
      seen.add(entry);
      pluginSpecs.push(entry);
    });
    normalized.plugins = pluginSpecs;
  }

  return normalized;
}

function validateRule(rule: unknown): Rule {
  return validateRuleCore(rule);
}

function validateConflictResolution(value: unknown): OrganizeConfig['conflictResolution'] {
  const valid = ['rename', 'overwrite', 'skip', 'newest'];
  if (valid.includes(value as string)) {
    return value as OrganizeConfig['conflictResolution'];
  }
  return 'rename';
}

export async function loadAppConfig(): Promise<AppConfig> {
  const Conf = (await import('conf')).default;
  const conf = new Conf<{ config: AppConfig }>({
    projectName: 'file-organizer',
    defaults: { config: DEFAULT_CONFIG },
  });

  return conf.get('config') as AppConfig;
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  const Conf = (await import('conf')).default;
  const conf = new Conf<{ config: AppConfig }>({
    projectName: 'file-organizer',
  });

  conf.set('config', config);
}

export function findConfigPath(startDir: string = process.cwd()): string | null {
  const names = [
    '.file-organizer.yaml',
    '.file-organizer.yml',
    'file-organizer.yaml',
    'file-organizer.yml',
  ];

  let current = path.resolve(startDir);

  while (current !== path.dirname(current)) {
    for (const name of names) {
      const configPath = path.join(current, name);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    current = path.dirname(current);
  }

  return null;
}

export async function initConfig(configPath: string): Promise<void> {
  const exampleConfig: OrganizeConfig = {
    rules: [
      {
        name: 'Images',
        patterns: ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.webp'],
        destination: './images/{year}/{month}',
      },
      {
        name: 'Documents',
        patterns: ['*.pdf', '*.docx', '*.xlsx', '*.txt'],
        destination: './documents/{type}',
      },
      {
        name: 'Videos',
        patterns: ['*.mp4', '*.avi', '*.mkv', '*.mov'],
        destination: './videos/{year}',
      },
    ],
  };

  await saveConfig(configPath, exampleConfig);
  logger.info(`Created config file: ${configPath}`);
}
