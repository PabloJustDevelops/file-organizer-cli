import chalk from 'chalk';
import type { OrganizeResult, Rule, UndoEntry } from '../../types/index.js';
import { formatFileSize } from '../../utils/file-utils.js';

export function printOrganizeResult(result: OrganizeResult, dryRun = false): void {
  const prefix = dryRun ? chalk.yellow('[DRY RUN] ') : '';

  console.log();
  console.log(chalk.bold(`${prefix}Organization Results`));
  console.log(chalk.gray('─'.repeat(40)));

  if (result.moved.length > 0) {
    console.log(chalk.green(`\n  Files ${dryRun ? 'to move' : 'moved'}: ${result.moved.length}`));
    for (const file of result.moved) {
      console.log(`    ${chalk.gray(file.from)}`);
      console.log(`      ${chalk.gray('→')} ${chalk.cyan(file.to)}`);
      console.log(`      ${chalk.gray(`[${file.rule}]`)}`);
    }
  }

  if (result.skipped.length > 0) {
    console.log(chalk.yellow(`\n  Skipped: ${result.skipped.length}`));
    for (const file of result.skipped) {
      console.log(`    ${chalk.gray(file.file)}: ${file.reason}`);
    }
  }

  if (result.errors.length > 0) {
    console.log(chalk.red(`\n  Errors: ${result.errors.length}`));
    for (const file of result.errors) {
      console.log(`    ${chalk.gray(file.file)}: ${file.error}`);
    }
  }

  console.log();
  console.log(chalk.bold('Summary:'));
  console.log(`  ${chalk.green(`✓ ${result.moved.length} moved`)}`);
  if (result.skipped.length > 0) {
    console.log(`  ${chalk.yellow(`⊘ ${result.skipped.length} skipped`)}`);
  }
  if (result.errors.length > 0) {
    console.log(`  ${chalk.red(`✗ ${result.errors.length} errors`)}`);
  }
  console.log();
}

export function printRules(rules: Rule[]): void {
  if (rules.length === 0) {
    console.log(chalk.yellow('No rules configured.'));
    return;
  }

  console.log();
  console.log(chalk.bold('Configured Rules:'));
  console.log(chalk.gray('─'.repeat(50)));

  for (const rule of rules) {
    const status = rule.enabled === false ? chalk.red('✗') : chalk.green('✓');
    const priority = rule.priority !== undefined ? chalk.gray(`[p:${rule.priority}]`) : '';

    console.log(`\n  ${status} ${chalk.cyan(rule.name)} ${priority}`);
    console.log(`    Patterns: ${chalk.gray(rule.patterns.join(', '))}`);
    console.log(`    Destination: ${chalk.gray(rule.destination)}`);

    if (rule.condition) {
      console.log(`    Condition: ${chalk.gray(JSON.stringify(rule.condition))}`);
    }
  }
  console.log();
}

export function printHistory(history: UndoEntry[]): void {
  if (history.length === 0) {
    console.log(chalk.yellow('No operations in history.'));
    return;
  }

  console.log();
  console.log(chalk.bold('Operation History:'));
  console.log(chalk.gray('─'.repeat(50)));

  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    console.log(`\n  ${chalk.gray(`${i + 1}.`)} ${chalk.cyan(entry.id.slice(0, 8))}`);
    console.log(`    Time: ${chalk.gray(entry.timestamp.toLocaleString())}`);
    console.log(`    Files: ${chalk.gray(entry.operations.length.toString())}`);
  }
  console.log();
}

export function printConfig(config: Record<string, unknown>): void {
  console.log();
  console.log(chalk.bold('Current Configuration:'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.gray(JSON.stringify(config, null, 2)));
  console.log();
}

export function printWelcome(): void {
  console.log();
  console.log(chalk.cyan.bold('  📁 File Organizer CLI'));
  console.log(chalk.gray('  ─────────────────────'));
  console.log(chalk.gray('  Type "fo --help" for available commands'));
  console.log();
}

export function printFileStats(files: { name: string; size: number }[]): void {
  console.log();
  console.log(chalk.bold('Files found:'));
  console.log(chalk.gray('─'.repeat(40)));

  let totalSize = 0;
  for (const file of files) {
    console.log(`  ${chalk.gray(file.name)} ${chalk.cyan(formatFileSize(file.size))}`);
    totalSize += file.size;
  }

  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  Total: ${files.length} files, ${formatFileSize(totalSize)}`);
  console.log();
}
