import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAddOrder } from "../dist/add-order.js";

test("parseAddOrder rejects invalid --order values", () => {
  const invalidValues = ["0", "-1", "2.5", "middle"];
  for (const value of invalidValues) {
    const { error } = parseAddOrder({ order: value });
    assert.equal(
      error,
      'Invalid --order value. Use "top" or a positive integer.'
    );
  }
});

test("parseAddOrder rejects using --top with --order", () => {
  const { error: errorTop } = parseAddOrder({ top: true, order: "top" });
  assert.equal(errorTop, 'Use either "--top" or "--order <position>".');

  const { error: errorPosition } = parseAddOrder({ top: true, order: "3" });
  assert.equal(errorPosition, 'Use either "--top" or "--order <position>".');
});
