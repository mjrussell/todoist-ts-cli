import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDeadlineDate, parseDeadlineUpdate } from "../dist/deadline.js";

test("parseDeadlineDate accepts YYYY-MM-DD", () => {
  assert.deepEqual(parseDeadlineDate("2026-03-05"), { deadlineDate: "2026-03-05" });
});

test("parseDeadlineDate rejects non-date", () => {
  const { error } = parseDeadlineDate("next monday");
  assert.equal(error, 'Invalid --deadline value. Use YYYY-MM-DD or "none".');
});

test("parseDeadlineUpdate supports clearing", () => {
  assert.deepEqual(parseDeadlineUpdate("none"), { deadlineDate: null });
  assert.deepEqual(parseDeadlineUpdate("null"), { deadlineDate: null });
  assert.deepEqual(parseDeadlineUpdate("clear"), { deadlineDate: null });
});
