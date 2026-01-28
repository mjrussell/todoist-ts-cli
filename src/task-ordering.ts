import type { GetTasksArgs, Task } from "@doist/todoist-api-typescript";
import { reorderItemsToMatchOrder } from "./todoist-sync.js";

export type TaskOrderable = Pick<
  Task,
  "id" | "projectId" | "sectionId" | "parentId" | "childOrder"
>;

export type TaskOrderingApi = {
  getTasks: (args: GetTasksArgs) => Promise<{ results: TaskOrderable[] }>;
};

function getOrderingArgs(task: TaskOrderable): GetTasksArgs {
  if (task.parentId) {
    return { parentId: task.parentId };
  }
  if (task.sectionId) {
    return { sectionId: task.sectionId };
  }
  return { projectId: task.projectId };
}

function inSameScope(task: TaskOrderable, candidate: TaskOrderable): boolean {
  return (
    task.sectionId === candidate.sectionId && task.parentId === candidate.parentId
  );
}

function sortByChildOrder(tasks: TaskOrderable[]): TaskOrderable[] {
  return tasks
    .slice()
    .sort(
      (left, right) =>
        left.childOrder - right.childOrder || left.id.localeCompare(right.id)
    );
}

export async function moveTaskToTop(
  api: TaskOrderingApi,
  token: string,
  task: TaskOrderable,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  await moveTaskToPosition(api, token, task, 1, fetchImpl);
}

export async function moveTaskToPosition(
  api: TaskOrderingApi,
  token: string,
  task: TaskOrderable,
  position: number,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const args = getOrderingArgs(task);
  const response = await api.getTasks(args);
  const scopedTasks = response.results.filter((candidate) =>
    inSameScope(task, candidate)
  );
  const remaining = scopedTasks.filter((candidate) => candidate.id !== task.id);
  const orderedRemaining = sortByChildOrder(remaining);
  const insertIndex = Math.min(
    Math.max(position - 1, 0),
    orderedRemaining.length
  );
  const ordered = [
    ...orderedRemaining.slice(0, insertIndex),
    task,
    ...orderedRemaining.slice(insertIndex),
  ];

  await reorderItemsToMatchOrder(
    token,
    ordered.map((item, index) => ({
      id: item.id,
      childOrder: index + 1,
    })),
    fetchImpl
  );
}
