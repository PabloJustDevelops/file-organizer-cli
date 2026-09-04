import type { Rule, OrganizeConfig } from '../types/index.js';

export const CONFIG_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    rules: {
      type: 'array',
      items: { $ref: '#/definitions/rule' },
    },
    conflictResolution: {
      type: 'string',
      enum: ['rename', 'overwrite', 'skip', 'newest'],
    },
    dryRun: { type: 'boolean' },
    recursive: { type: 'boolean' },
    includeHidden: { type: 'boolean' },
    plugins: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
  },
  definitions: {
    rule: {
      type: 'object',
      required: ['name', 'patterns', 'destination'],
      properties: {
        name: { type: 'string' },
        patterns: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
        },
        destination: { type: 'string' },
        priority: { type: 'number' },
        enabled: { type: 'boolean' },
        condition: { $ref: '#/definitions/condition' },
      },
    },
    condition: {
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['regex', 'extension', 'size', 'date'],
        },
        pattern: { type: 'string' },
        match: { type: 'string' },
        extensions: {
          type: 'array',
          items: { type: 'string' },
        },
        minSize: { type: 'number' },
        maxSize: { type: 'number' },
        after: { type: 'string' },
        before: { type: 'string' },
      },
    },
  },
};

export function getExampleRules(): Rule[] {
  return [
    {
      name: 'Images by date',
      patterns: ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.webp', '*.svg'],
      destination: './images/{year}/{month}',
      priority: 10,
    },
    {
      name: 'Documents by type',
      patterns: ['*.pdf', '*.docx', '*.xlsx', '*.pptx', '*.txt', '*.md'],
      destination: './documents/{type}',
      priority: 10,
    },
    {
      name: 'Videos',
      patterns: ['*.mp4', '*.avi', '*.mkv', '*.mov', '*.wmv'],
      destination: './videos/{year}',
      priority: 10,
    },
    {
      name: 'Audio',
      patterns: ['*.mp3', '*.wav', '*.flac', '*.aac', '*.ogg'],
      destination: './audio/{type}',
      priority: 10,
    },
    {
      name: 'Code files',
      patterns: ['*.js', '*.ts', '*.py', '*.java', '*.cpp', '*.html', '*.css'],
      destination: './code/{extension}',
      priority: 5,
    },
    {
      name: 'Archives',
      patterns: ['*.zip', '*.rar', '*.7z', '*.tar', '*.gz'],
      destination: './archives/{year-month}',
      priority: 5,
    },
    {
      name: 'Screenshots',
      patterns: ['*screenshot*', '*Screen Shot*'],
      destination: './screenshots/{year}/{month}',
      priority: 20,
      condition: {
        type: 'regex',
        pattern: '(screenshot|Screen Shot)',
      },
    },
    {
      name: 'Project files',
      patterns: ['*'],
      destination: './projects/{match1}',
      priority: 15,
      condition: {
        type: 'regex',
        pattern: '^(project\\d+)-',
      },
    },
  ];
}

export function getExampleConfig(): OrganizeConfig {
  return {
    rules: getExampleRules(),
    conflictResolution: 'rename',
    recursive: false,
    includeHidden: false,
  };
}
