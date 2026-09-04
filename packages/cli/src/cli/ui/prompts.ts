import inquirer from 'inquirer';
import type { Rule, ConflictResolution } from '../../types/index.js';

export async function promptForRule(): Promise<Rule> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Rule name:',
      validate: (input: string) => input.length > 0 || 'Name is required',
    },
    {
      type: 'input',
      name: 'patterns',
      message: 'Patterns (comma-separated, e.g., *.jpg,*.png):',
      validate: (input: string) => input.length > 0 || 'At least one pattern is required',
      filter: (input: string) => input.split(',').map((p) => p.trim()),
    },
    {
      type: 'input',
      name: 'destination',
      message: 'Destination (e.g., ./images/{year}/{month}):',
      validate: (input: string) => input.length > 0 || 'Destination is required',
    },
    {
      type: 'number',
      name: 'priority',
      message: 'Priority (higher = applied first):',
      default: 0,
    },
    {
      type: 'confirm',
      name: 'addCondition',
      message: 'Add a condition?',
      default: false,
    },
  ]);

  const rule: Rule = {
    name: answers.name,
    patterns: answers.patterns,
    destination: answers.destination,
    priority: answers.priority,
  };

  if (answers.addCondition) {
    rule.condition = await promptForCondition();
  }

  return rule;
}

export async function promptForCondition(): Promise<Rule['condition']> {
  const { type } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Condition type:',
      choices: [
        { name: 'Regex (pattern match)', value: 'regex' },
        { name: 'File extension', value: 'extension' },
        { name: 'File size', value: 'size' },
        { name: 'Date range', value: 'date' },
      ],
    },
  ]);

  const condition: Rule['condition'] = { type };

  switch (type) {
    case 'regex': {
      const { pattern } = await inquirer.prompt([
        {
          type: 'input',
          name: 'pattern',
          message: 'Regex pattern:',
          validate: (input: string) => {
            try {
              new RegExp(input);
              return true;
            } catch {
              return 'Invalid regex pattern';
            }
          },
        },
      ]);
      condition.pattern = pattern;
      break;
    }

    case 'extension': {
      const { extensions } = await inquirer.prompt([
        {
          type: 'input',
          name: 'extensions',
          message: 'Extensions (comma-separated):',
          filter: (input: string) => input.split(',').map((e) => e.trim()),
        },
      ]);
      condition.extensions = extensions;
      break;
    }

    case 'size': {
      const sizeAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'minSize',
          message: 'Minimum size (bytes, optional):',
          default: '',
        },
        {
          type: 'input',
          name: 'maxSize',
          message: 'Maximum size (bytes, optional):',
          default: '',
        },
      ]);
      if (sizeAnswers.minSize) condition.minSize = parseInt(sizeAnswers.minSize);
      if (sizeAnswers.maxSize) condition.maxSize = parseInt(sizeAnswers.maxSize);
      break;
    }

    case 'date': {
      const dateAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'after',
          message: 'After date (YYYY-MM-DD, optional):',
          default: '',
        },
        {
          type: 'input',
          name: 'before',
          message: 'Before date (YYYY-MM-DD, optional):',
          default: '',
        },
      ]);
      if (dateAnswers.after) condition.after = dateAnswers.after;
      if (dateAnswers.before) condition.before = dateAnswers.before;
      break;
    }
  }

  return condition;
}

export async function promptForConflictResolution(): Promise<ConflictResolution> {
  const { resolution } = await inquirer.prompt([
    {
      type: 'list',
      name: 'resolution',
      message: 'How to handle file conflicts?',
      choices: [
        { name: 'Rename (add suffix like "(1)")', value: 'rename' },
        { name: 'Overwrite existing file', value: 'overwrite' },
        { name: 'Skip conflicting files', value: 'skip' },
        { name: 'Keep newest file', value: 'newest' },
      ],
      default: 'rename',
    },
  ]);

  return resolution;
}

export async function confirmAction(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false,
    },
  ]);

  return confirmed;
}

export async function selectRule(rules: Rule[]): Promise<string | null> {
  if (rules.length === 0) {
    return null;
  }

  const { ruleName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'ruleName',
      message: 'Select a rule:',
      choices: [
        ...rules.map((r) => ({ name: `${r.name} (${r.patterns.join(', ')})`, value: r.name })),
        { name: 'Cancel', value: null },
      ],
    },
  ]);

  return ruleName;
}

export async function promptForDirectory(message: string, defaultDir?: string): Promise<string> {
  const { dir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'dir',
      message,
      default: defaultDir || '.',
    },
  ]);

  return dir;
}
