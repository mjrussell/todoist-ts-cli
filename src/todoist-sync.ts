import { randomUUID } from "node:crypto";

const TODOIST_SYNC_URL = "https://api.todoist.com/api/v1/sync";

type ReorderItem = {
  id: string;
  childOrder: number;
};

function formatSyncError(status: unknown): string {
  if (!status || status === "ok") {
    return "";
  }
  if (typeof status === "string") {
    return status;
  }
  try {
    return JSON.stringify(status);
  } catch {
    return String(status);
  }
}

export async function reorderItemsToMatchOrder(
  token: string,
  items: ReorderItem[],
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (items.length <= 1) {
    return;
  }

  const uuid = randomUUID();
  const payload = {
    commands: [
      {
        type: "item_reorder",
        uuid,
        args: {
          items: items.map((item) => ({
            id: item.id,
            child_order: item.childOrder,
          })),
        },
      },
    ],
  };

  const response = await fetchImpl(TODOIST_SYNC_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let responseJson: unknown = null;
  if (responseText) {
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = null;
    }
  }

  if (!response.ok) {
    const detail = responseText ? `: ${responseText}` : "";
    throw new Error(
      `Todoist reorder failed (${response.status} ${response.statusText})${detail}`
    );
  }

  const status = (responseJson as { sync_status?: Record<string, unknown> })
    ?.sync_status?.[uuid];
  const statusMessage = formatSyncError(status);
  if (statusMessage) {
    throw new Error(`Todoist reorder failed: ${statusMessage}`);
  }
}
