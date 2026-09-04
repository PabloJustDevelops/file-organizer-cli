export function getDateValue(date: Date, format: string, locale = 'en-US'): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const monthName = date
    .toLocaleString(locale, { month: 'long' })
    .toLowerCase();
  const day = date.getDate().toString().padStart(2, '0');

  switch (format) {
    case 'year':
      return year;
    case 'month':
      return month;
    case 'monthName':
      return monthName;
    case 'day':
      return day;
    case 'year-month':
    case 'yearMonth':
      return `${year}-${month}`;
    default:
      return year;
  }
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseBound(value: string, endOfDay: boolean): Date | null {
  const trimmed = value.trim();

  // Date-only strings: interpret in local time so `before: 2024-03-15`
  // includes files modified at any time that day, not just before UTC midnight.
  if (DATE_ONLY_PATTERN.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return endOfDay
      ? new Date(y, m - 1, d, 23, 59, 59, 999)
      : new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function isDateInRange(
  date: Date,
  after?: string,
  before?: string
): boolean {
  if (after !== undefined) {
    const afterDate = parseBound(after, false);
    // Fail closed: an invalid bound must not silently match everything
    if (afterDate === null || date < afterDate) return false;
  }

  if (before !== undefined) {
    const beforeDate = parseBound(before, true);
    if (beforeDate === null || date > beforeDate) return false;
  }

  return true;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
