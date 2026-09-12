import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { getFileType, formatFileSize, moveFile } from '../../src/utils/file-utils.js';

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

  describe('moveFile', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-move-'));
    });

    afterEach(async () => {
      await fs.remove(dir);
    });

    it('moves the file and creates missing destination directories', async () => {
      const src = path.join(dir, 'a.txt');
      await fs.writeFile(src, 'hello');
      const dest = path.join(dir, 'nested', 'deep', 'a.txt');

      await moveFile(src, dest);

      expect(await fs.readFile(dest, 'utf-8')).toBe('hello');
      expect(await fs.pathExists(src)).toBe(false);
    });

    it('falls back to a unique name when the destination appeared first (TOCTOU)', async () => {
      const src = path.join(dir, 'src.txt');
      const dest = path.join(dir, 'dest.txt');
      await fs.writeFile(src, 'incoming');
      await fs.writeFile(dest, 'already here');

      // overwrite:false onto an existing file throws EEXIST; the run must not
      // fail — it re-homes the file under a unique name instead.
      await moveFile(src, dest, { overwrite: false });

      expect(await fs.readFile(dest, 'utf-8')).toBe('already here');
      expect(await fs.readFile(path.join(dir, 'dest (1).txt'), 'utf-8')).toBe('incoming');
      expect(await fs.pathExists(src)).toBe(false);
    });

    it('rethrows errors that are not a destination conflict', async () => {
      await expect(
        moveFile(path.join(dir, 'missing.txt'), path.join(dir, 'out.txt'))
      ).rejects.toThrow();
    });
  });
});
