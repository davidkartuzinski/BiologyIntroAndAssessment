import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRole } from "../src/lib/auth/roles.ts";

test("only exact known roles are accepted", () => {
  assert.equal(parseRole({ role: "reviewer" }), "reviewer");
  assert.equal(parseRole({ role: "learner" }), "learner");
});

test("missing or unrecognised roles never grant reviewer access", () => {
  for (const value of [undefined, null, {}, { role: "Reviewer" }, { role: "tutor" }, { role: ["reviewer"] }, { role: "admin" }, "reviewer"]) {
    assert.equal(parseRole(value), null);
  }
});
