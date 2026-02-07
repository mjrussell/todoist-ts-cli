export type DeadlineParseResult = {
  deadlineDate?: string | null;
  error?: string;
};

export type DeadlineDateParseResult = {
  deadlineDate?: string;
  error?: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isClearValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "none" ||
    normalized === "null" ||
    normalized === "clear" ||
    normalized === "no" ||
    normalized === "no-deadline" ||
    normalized === "nodeadline"
  );
}

export function parseDeadlineDate(value: string): DeadlineDateParseResult {
  const trimmed = value.trim();
  if (!DATE_PATTERN.test(trimmed)) {
    return { error: 'Invalid --deadline value. Use YYYY-MM-DD or "none".' };
  }
  return { deadlineDate: trimmed };
}

export function parseDeadlineUpdate(value: string): DeadlineParseResult {
  if (isClearValue(value)) {
    return { deadlineDate: null };
  }
  return parseDeadlineDate(value);
}
