import { test } from "node:test";
import assert from "node:assert/strict";
import { applyLabelDelta, parseLabelsCsv } from "../dist/labels.js";

test("parseLabelsCsv parses and dedupes", () => {
  const { labels } = parseLabelsCsv("next, waiting, next");
  assert.deepEqual(labels, ["next", "waiting"]);
});

test("parseLabelsCsv rejects empty", () => {
  const { error } = parseLabelsCsv(" ,  ,");
  assert.equal(error, "--labels must contain at least one label");
});

test("applyLabelDelta adds and removes", () => {
  const result = applyLabelDelta(["a", "b"], { add: ["c"], remove: ["b"] });
  assert.deepEqual(new Set(result), new Set(["a", "c"]));
});
