import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAssigneeId, parseAssigneeIdUpdate } from "../dist/assignee.js";

test("parseAssigneeId returns undefined when flag not provided", () => {
  assert.equal(parseAssigneeId(undefined), undefined);
});

test("parseAssigneeId ignores 'null' (not meaningful for add)", () => {
  assert.equal(parseAssigneeId("null"), undefined);
});

test("parseAssigneeId passes through user id", () => {
  assert.equal(parseAssigneeId("123"), "123");
});

test("parseAssigneeIdUpdate maps 'null' to null (unassign)", () => {
  assert.equal(parseAssigneeIdUpdate("null"), null);
});

test("parseAssigneeIdUpdate passes through user id", () => {
  assert.equal(parseAssigneeIdUpdate("123"), "123");
});
