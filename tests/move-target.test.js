import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMoveTarget } from "../dist/move-target.js";

test("resolveMoveTarget prefers section move when both project and section are provided", () => {
  const result = resolveMoveTarget(
    { projectName: "Proj", sectionName: "Section A" },
    [{ id: "p1", name: "Proj" }],
    [
      { id: "s1", name: "Section A", projectId: "p1" },
      { id: "s2", name: "Section A", projectId: "p2" },
    ]
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.args, { sectionId: "s1" });
});

test("resolveMoveTarget errors on ambiguous section without project", () => {
  const result = resolveMoveTarget(
    { sectionName: "Section A" },
    [
      { id: "p1", name: "Proj1" },
      { id: "p2", name: "Proj2" },
    ],
    [
      { id: "s1", name: "Section A", projectId: "p1" },
      { id: "s2", name: "Section A", projectId: "p2" },
    ]
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /Multiple sections/);
});
