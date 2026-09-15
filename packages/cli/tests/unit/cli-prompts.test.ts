import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  promptForRule,
  promptForCondition,
  promptForConflictResolution,
  confirmAction,
  selectRule,
  promptForDirectory,
} from '../../src/cli/ui/prompts.js';
import type { Rule } from '../../src/types/index.js';

/**
 * SPEC-adapter-coverage AC-3: `src/cli/ui/prompts.ts` at 100%.
 *
 * `inquirer` is replaced at the module boundary — there is no TTY in CI. Beyond
 * the returned value, the *question definitions* are asserted (validators and
 * filters run by hand), so the prompt contract stays pinned even though the
 * terminal is fake.
 */
const { promptMock } = vi.hoisted(() => ({ promptMock: vi.fn() }));

vi.mock('inquirer', () => ({ default: { prompt: promptMock } }));

// Each test owns its call history: `askedQuestions(0)` must mean "the first
// question this test asked", not "the first question the file ever asked".
beforeEach(() => {
  promptMock.mockReset();
});

interface Question {
  name: string;
  type: string;
  message: string;
  validate?: (input: string) => string | boolean;
  filter?: (input: string) => string[];
  choices?: Array<{ name: string; value: string | null }>;
  default?: string | number | boolean;
}

type QuestionList = Question[];

function askedQuestions(callIndex = 0): QuestionList {
  return promptMock.mock.calls[callIndex][0] as QuestionList;
}

function question(questions: QuestionList, name: string): Question {
  const found = questions.find((q) => q.name === name);
  if (!found) throw new Error(`no question named "${name}" was asked`);
  return found;
}

const baseAnswers = {
  name: 'Images',
  patterns: ['*.jpg'],
  destination: './images',
  priority: 3,
  addCondition: false,
};

describe('promptForRule()', () => {
  it('returns the rule described by the base answers', async () => {
    promptMock.mockResolvedValueOnce({ ...baseAnswers });

    const rule = await promptForRule();

    expect(rule).toEqual({
      name: 'Images',
      patterns: ['*.jpg'],
      destination: './images',
      priority: 3,
    });
  });

  it('rejects empty names, patterns and destinations, and accepts valid ones', async () => {
    promptMock.mockResolvedValueOnce({ ...baseAnswers });
    await promptForRule();

    const questions = askedQuestions();
    const name = question(questions, 'name');
    const patterns = question(questions, 'patterns');
    const destination = question(questions, 'destination');

    expect(name.validate?.('')).toBe('Name is required');
    expect(name.validate?.('ok')).toBe(true);
    expect(patterns.validate?.('')).toBe('At least one pattern is required');
    expect(patterns.validate?.('*.jpg')).toBe(true);
    expect(destination.validate?.('')).toBe('Destination is required');
    expect(destination.validate?.('./x')).toBe(true);
  });

  it('splits the comma-separated patterns into a trimmed list', async () => {
    promptMock.mockResolvedValueOnce({ ...baseAnswers });
    await promptForRule();

    const patterns = question(askedQuestions(), 'patterns');
    expect(patterns.filter?.('*.jpg, *.png ,*.gif')).toEqual(['*.jpg', '*.png', '*.gif']);
  });

  it('attaches a condition when the user opts in', async () => {
    promptMock
      .mockResolvedValueOnce({ ...baseAnswers, addCondition: true })
      .mockResolvedValueOnce({ type: 'size' })
      .mockResolvedValueOnce({ minSize: '1024', maxSize: '' });

    const rule = await promptForRule();

    expect(rule.condition).toEqual({ type: 'size', minSize: 1024 });
  });

  it('omits the condition when the user declines', async () => {
    promptMock.mockResolvedValueOnce({ ...baseAnswers, addCondition: false });

    const rule = await promptForRule();

    expect(rule.condition).toBeUndefined();
    expect(promptMock).toHaveBeenCalledTimes(1);
  });
});

describe('promptForCondition()', () => {
  it('offers the four condition types', async () => {
    promptMock.mockResolvedValueOnce({ type: 'extension' }).mockResolvedValueOnce({ extensions: [] });

    await promptForCondition();

    const choices = question(askedQuestions(), 'type').choices ?? [];
    expect(choices.map((c) => c.value)).toEqual(['regex', 'extension', 'size', 'date']);
  });

  it('accepts a valid regex and rejects an invalid one', async () => {
    promptMock.mockResolvedValueOnce({ type: 'regex' }).mockResolvedValueOnce({ pattern: '^a' });

    const condition = await promptForCondition();

    expect(condition).toEqual({ type: 'regex', pattern: '^a' });
    const pattern = question(askedQuestions(1), 'pattern');
    expect(pattern.validate?.('(')).toBe('Invalid regex pattern');
    expect(pattern.validate?.('^a$')).toBe(true);
  });

  it('splits the comma-separated extensions', async () => {
    promptMock
      .mockResolvedValueOnce({ type: 'extension' })
      .mockResolvedValueOnce({ extensions: ['jpg', 'png'] });

    const condition = await promptForCondition();

    expect(condition).toEqual({ type: 'extension', extensions: ['jpg', 'png'] });
    const extensions = question(askedQuestions(1), 'extensions');
    expect(extensions.filter?.('jpg, png ,gif')).toEqual(['jpg', 'png', 'gif']);
  });

  it('keeps both size bounds when given', async () => {
    promptMock
      .mockResolvedValueOnce({ type: 'size' })
      .mockResolvedValueOnce({ minSize: '10', maxSize: '99' });

    const condition = await promptForCondition();

    expect(condition).toEqual({ type: 'size', minSize: 10, maxSize: 99 });
  });

  it('leaves size bounds out when the answers are blank', async () => {
    promptMock
      .mockResolvedValueOnce({ type: 'size' })
      .mockResolvedValueOnce({ minSize: '', maxSize: '' });

    const condition = await promptForCondition();

    expect(condition).toEqual({ type: 'size' });
  });

  it('keeps both date bounds when given', async () => {
    promptMock
      .mockResolvedValueOnce({ type: 'date' })
      .mockResolvedValueOnce({ after: '2024-01-01', before: '2024-12-31' });

    const condition = await promptForCondition();

    expect(condition).toEqual({ type: 'date', after: '2024-01-01', before: '2024-12-31' });
  });

  it('leaves date bounds out when the answers are blank', async () => {
    promptMock
      .mockResolvedValueOnce({ type: 'date' })
      .mockResolvedValueOnce({ after: '', before: '' });

    const condition = await promptForCondition();

    expect(condition).toEqual({ type: 'date' });
  });
});

describe('promptForConflictResolution()', () => {
  it('returns the chosen resolution and defaults to rename', async () => {
    promptMock.mockResolvedValueOnce({ resolution: 'skip' });

    await expect(promptForConflictResolution()).resolves.toBe('skip');

    const asked = question(askedQuestions(), 'resolution');
    expect(asked.default).toBe('rename');
    expect(asked.choices?.map((c) => c.value)).toEqual([
      'rename',
      'overwrite',
      'skip',
      'newest',
    ]);
  });
});

describe('confirmAction()', () => {
  it.each([
    [true, true],
    [false, false],
  ])('returns the confirmation (%s) and defaults to false', async (answer, expected) => {
    promptMock.mockResolvedValueOnce({ confirmed: answer });

    await expect(confirmAction('Proceed?')).resolves.toBe(expected);
    expect(question(askedQuestions(), 'confirmed').default).toBe(false);
  });
});

describe('selectRule()', () => {
  const rules: Rule[] = [
    { name: 'Images', patterns: ['*.jpg'], destination: './images' },
    { name: 'Docs', patterns: ['*.pdf'], destination: './docs' },
  ];

  it('returns null without prompting when there are no rules', async () => {
    await expect(selectRule([])).resolves.toBeNull();
    expect(promptMock).not.toHaveBeenCalled();
  });

  it('lists every rule plus a cancel option and returns the selection', async () => {
    promptMock.mockResolvedValueOnce({ ruleName: 'Docs' });

    await expect(selectRule(rules)).resolves.toBe('Docs');

    const choices = question(askedQuestions(), 'ruleName').choices ?? [];
    expect(choices[0]).toEqual({ name: 'Images (*.jpg)', value: 'Images' });
    expect(choices[choices.length - 1]).toEqual({ name: 'Cancel', value: null });
  });

  it('returns null when the user cancels', async () => {
    promptMock.mockResolvedValueOnce({ ruleName: null });

    await expect(selectRule(rules)).resolves.toBeNull();
  });
});

describe('promptForDirectory()', () => {
  it('uses the provided default directory', async () => {
    promptMock.mockResolvedValueOnce({ dir: '/data' });

    await expect(promptForDirectory('Where?', '/tmp')).resolves.toBe('/data');
    expect(question(askedQuestions(), 'dir').default).toBe('/tmp');
  });

  it('falls back to the current directory when no default is given', async () => {
    promptMock.mockResolvedValueOnce({ dir: '.' });

    await expect(promptForDirectory('Where?')).resolves.toBe('.');
    expect(question(askedQuestions(), 'dir').default).toBe('.');
  });
});
