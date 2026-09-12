import { describe, expect, it } from 'vitest';
import { errorMessage } from '../../src/utils/errors.js';

describe('errorMessage', () => {
  it('returns the message of an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back for a non-Error throw', () => {
    // A rejected promise or plugin hook can carry anything, not just Error.
    expect(errorMessage('just a string')).toBe('Unknown error');
    expect(errorMessage(undefined)).toBe('Unknown error');
    expect(errorMessage({ message: 'not an Error instance' })).toBe('Unknown error');
  });
});
