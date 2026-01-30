// For commands where Todoist expects a string assigneeId (e.g. addTask)
export function parseAssigneeId(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === "null") return undefined;
  return value;
}

// For commands where Todoist allows explicit unassignment (e.g. updateTask)
export function parseAssigneeIdUpdate(
  value: string | undefined
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === "null") return null;
  return value;
}
