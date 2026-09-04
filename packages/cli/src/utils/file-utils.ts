import fs from 'fs-extra';
import path from 'path';
import type { FileInfo, ConflictResolution } from '../types/index.js';

export async function getFileInfo(filePath: string): Promise<FileInfo> {
  const stats = await fs.stat(filePath);
  const parsed = path.parse(filePath);

  return {
    path: filePath,
    name: parsed.name,
    extension: parsed.ext.toLowerCase().slice(1),
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
    isDirectory: stats.isDirectory(),
  };
}

export async function listFiles(
  directory: string,
  recursive = false,
  includeHidden = false
): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (!includeHidden && entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory() && recursive) {
      const subFiles = await listFiles(fullPath, recursive, includeHidden);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function getUniqueFilePath(
  destPath: string,
  resolution: ConflictResolution,
  sourcePath?: string
): Promise<string | null> {
  if (!(await fs.pathExists(destPath))) {
    return destPath;
  }

  switch (resolution) {
    case 'overwrite':
      return destPath;

    case 'skip':
      return null;

    case 'newest': {
      if (!sourcePath) return generateUniqueName(destPath);
      const sourceStats = await fs.stat(sourcePath);
      const destStats = await fs.stat(destPath);
      return sourceStats.mtime > destStats.mtime ? destPath : null;
    }

    case 'rename':
    default:
      return generateUniqueName(destPath);
  }
}

async function generateUniqueName(filePath: string): Promise<string> {
  const parsed = path.parse(filePath);
  let counter = 1;
  let newPath = filePath;

  while (await fs.pathExists(newPath)) {
    newPath = path.join(
      parsed.dir,
      `${parsed.name} (${counter})${parsed.ext}`
    );
    counter++;
  }

  return newPath;
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

export async function moveFile(src: string, dest: string, options: { overwrite?: boolean } = {}): Promise<void> {
  await ensureDirectory(path.dirname(dest));

  try {
    await fs.move(src, dest, { overwrite: options.overwrite === true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (!options.overwrite && (code === 'EEXIST' || code === 'EPERM')) {
      // TOCTOU: destination appeared between getUniqueFilePath and move.
      // Fall back to a fresh unique name instead of failing the whole run.
      const fallback = await generateUniqueName(dest);
      await fs.move(src, fallback, { overwrite: false });
      return;
    }
    throw err;
  }
}

export async function copyFile(src: string, dest: string): Promise<void> {
  await ensureDirectory(path.dirname(dest));
  await fs.copy(src, dest, { overwrite: false });
}

export function getFileType(extension: string): string {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'];
  const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg'];
  const codeExts = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];

  const ext = extension.toLowerCase();

  if (imageExts.includes(ext)) return 'image';
  if (docExts.includes(ext)) return 'document';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (codeExts.includes(ext)) return 'code';
  if (archiveExts.includes(ext)) return 'archive';

  return 'other';
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
