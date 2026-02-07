export type LabelsParseResult = {
  labels?: string[];
  error?: string;
};

export function parseLabelsCsv(value: string): LabelsParseResult {
  const raw = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const labels = Array.from(new Set(raw));

  if (labels.length === 0) {
    return { error: "--labels must contain at least one label" };
  }

  return { labels };
}

export type LabelDelta = {
  add?: string[];
  remove?: string[];
};

export function applyLabelDelta(
  current: string[],
  delta: LabelDelta
): string[] {
  const set = new Set(current);

  for (const label of delta.add ?? []) {
    const normalized = label.trim();
    if (normalized) set.add(normalized);
  }

  for (const label of delta.remove ?? []) {
    const normalized = label.trim();
    if (normalized) set.delete(normalized);
  }

  return Array.from(set);
}
