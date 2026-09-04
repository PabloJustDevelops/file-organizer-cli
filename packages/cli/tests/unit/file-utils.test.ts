import { describe, it, expect } from 'vitest';
import { getFileType, formatFileSize } from '../../src/utils/file-utils.js';

describe('File Utils', () => {
  describe('getFileType', () => {
    it('identifies image files', () => {
      expect(getFileType('jpg')).toBe('image');
      expect(getFileType('png')).toBe('image');
      expect(getFileType('gif')).toBe('image');
      expect(getFileType('webp')).toBe('image');
      expect(getFileType('svg')).toBe('image');
    });

    it('identifies document files', () => {
      expect(getFileType('pdf')).toBe('document');
      expect(getFileType('docx')).toBe('document');
      expect(getFileType('xlsx')).toBe('document');
      expect(getFileType('txt')).toBe('document');
    });

    it('identifies video files', () => {
      expect(getFileType('mp4')).toBe('video');
      expect(getFileType('avi')).toBe('video');
      expect(getFileType('mkv')).toBe('video');
    });

    it('identifies audio files', () => {
      expect(getFileType('mp3')).toBe('audio');
      expect(getFileType('wav')).toBe('audio');
      expect(getFileType('flac')).toBe('audio');
    });

    it('identifies code files', () => {
      expect(getFileType('js')).toBe('code');
      expect(getFileType('ts')).toBe('code');
      expect(getFileType('py')).toBe('code');
      expect(getFileType('html')).toBe('code');
    });

    it('identifies archive files', () => {
      expect(getFileType('zip')).toBe('archive');
      expect(getFileType('rar')).toBe('archive');
      expect(getFileType('7z')).toBe('archive');
    });

    it('returns other for unknown extensions', () => {
      expect(getFileType('xyz')).toBe('other');
      expect(getFileType('unknown')).toBe('other');
    });

    it('handles case insensitively', () => {
      expect(getFileType('JPG')).toBe('image');
      expect(getFileType('PNG')).toBe('image');
      expect(getFileType('PDF')).toBe('document');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(0)).toBe('0.0 B');
      expect(formatFileSize(500)).toBe('500.0 B');
      expect(formatFileSize(1023)).toBe('1023.0 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });

    it('formats gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });
  });
});
