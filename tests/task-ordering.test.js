import { test } from "node:test";
import assert from "node:assert/strict";
import { moveTaskToPosition, moveTaskToTop } from "../dist/task-ordering.js";

const baseTask = () => ({
  id: "task",
  projectId: "project-1",
  sectionId: null,
  parentId: null,
  childOrder: 1,
});

const createTask = (overrides) => ({
  ...baseTask(),
  ...overrides,
});

const createFetchMock = () => {
  const calls = [];
  const fetchMock = async (_url, init = {}) => {
    calls.push([_url, init]);
    const body = init.body ? JSON.parse(init.body) : null;
    const uuid = body?.commands?.[0]?.uuid ?? "missing";
    return new Response(JSON.stringify({ sync_status: { [uuid]: "ok" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fetchMock, calls };
};

test("moveTaskToTop reorders project root tasks with new task first", async () => {
  const newTask = createTask({ id: "new", childOrder: 42 });
  const api = {
    getTasks: async (args) => {
      assert.deepEqual(args, { projectId: "project-1" });
      return {
        results: [
          createTask({ id: "a", childOrder: 2 }),
          createTask({ id: "b", childOrder: 1 }),
          createTask({ id: "section-task", sectionId: "section-1", childOrder: 1 }),
          newTask,
        ],
      };
    },
  };

  const { fetchMock, calls } = createFetchMock();
  await moveTaskToTop(api, "token", newTask, fetchMock);

  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0][1].body);
  assert.equal(body.commands[0].type, "item_reorder");
  assert.deepEqual(body.commands[0].args.items, [
    { id: "new", child_order: 1 },
    { id: "b", child_order: 2 },
    { id: "a", child_order: 3 },
  ]);
});

test("moveTaskToTop scopes to section when sectionId is set", async () => {
  const newTask = createTask({ id: "new", sectionId: "section-9" });
  const api = {
    getTasks: async (args) => {
      assert.deepEqual(args, { sectionId: "section-9" });
      return {
        results: [
          createTask({ id: "c", sectionId: "section-9", childOrder: 2 }),
          createTask({ id: "d", sectionId: "section-9", childOrder: 1 }),
          createTask({ id: "other", sectionId: "section-10", childOrder: 1 }),
          newTask,
        ],
      };
    },
  };

  const { fetchMock, calls } = createFetchMock();
  await moveTaskToTop(api, "token", newTask, fetchMock);

  const body = JSON.parse(calls[0][1].body);
  assert.deepEqual(body.commands[0].args.items, [
    { id: "new", child_order: 1 },
    { id: "d", child_order: 2 },
    { id: "c", child_order: 3 },
  ]);
});

test("moveTaskToPosition inserts at position 1", async () => {
  const newTask = createTask({ id: "new", childOrder: 10 });
  const api = {
    getTasks: async () => ({
      results: [
        createTask({ id: "a", childOrder: 2 }),
        createTask({ id: "b", childOrder: 1 }),
        newTask,
      ],
    }),
  };

  const { fetchMock, calls } = createFetchMock();
  await moveTaskToPosition(api, "token", newTask, 1, fetchMock);

  const body = JSON.parse(calls[0][1].body);
  assert.deepEqual(body.commands[0].args.items, [
    { id: "new", child_order: 1 },
    { id: "b", child_order: 2 },
    { id: "a", child_order: 3 },
  ]);
});

test("moveTaskToPosition inserts in the middle", async () => {
  const newTask = createTask({ id: "new", childOrder: 10 });
  const api = {
    getTasks: async () => ({
      results: [
        createTask({ id: "a", childOrder: 1 }),
        createTask({ id: "b", childOrder: 2 }),
        createTask({ id: "c", childOrder: 3 }),
        newTask,
      ],
    }),
  };

  const { fetchMock, calls } = createFetchMock();
  await moveTaskToPosition(api, "token", newTask, 2, fetchMock);

  const body = JSON.parse(calls[0][1].body);
  assert.deepEqual(body.commands[0].args.items, [
    { id: "a", child_order: 1 },
    { id: "new", child_order: 2 },
    { id: "b", child_order: 3 },
    { id: "c", child_order: 4 },
  ]);
});

test("moveTaskToPosition inserts at bottom when position exceeds list length", async () => {
  const newTask = createTask({ id: "new", childOrder: 10 });
  const api = {
    getTasks: async () => ({
      results: [
        createTask({ id: "a", childOrder: 1 }),
        createTask({ id: "b", childOrder: 2 }),
        newTask,
      ],
    }),
  };

  const { fetchMock, calls } = createFetchMock();
  await moveTaskToPosition(api, "token", newTask, 10, fetchMock);

  const body = JSON.parse(calls[0][1].body);
  assert.deepEqual(body.commands[0].args.items, [
    { id: "a", child_order: 1 },
    { id: "b", child_order: 2 },
    { id: "new", child_order: 3 },
  ]);
});
