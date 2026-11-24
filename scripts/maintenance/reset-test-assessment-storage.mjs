#!/usr/bin/env node
// One-off Storage cleanup for the 0006 test reset. Uses the Supabase Storage API
// (never SQL on storage.objects). DRY RUN by default.
//
//   Plan (dry run, writes a manifest):
//     node --env-file=.env.local scripts/maintenance/reset-test-assessment-storage.mjs
//   Delete exactly the files in a saved manifest:
//     node --env-file=.env.local scripts/maintenance/reset-test-assessment-storage.mjs --execute --manifest scripts/maintenance/output/<file>.json
//   Optional backup of the files before deleting:
//     add --backup  (copies each file into scripts/maintenance/output/backup-<time>/)
//
// Credentials come only from environment variables (.env.local, gitignored).

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { planStorageCleanup, RECORDED_SCOPE, validateScope } from "./reset-scope.mjs";

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const backup = args.includes("--backup");
const manifestArg = args.includes("--manifest") ? args[args.indexOf("--manifest") + 1] : null;
const outDir = join("scripts", "maintenance", "output");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL or service role key in the environment. Run with --env-file=.env.local.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const scope = RECORDED_SCOPE;

const scopeErrors = validateScope(scope);
if (scopeErrors.length) {
  console.error("Scope is invalid:", scopeErrors.join("; "));
  process.exit(1);
}

console.log("Scope");
console.log(`  learner:    ${scope.learnerId}`);
console.log(`  assessment: ${scope.assessmentId}`);
console.log(`  cutoff:     ${scope.cutoff} (UTC)`);
console.log(`  bucket:     ${scope.bucket}`);
console.log(`  mode:       ${execute ? "EXECUTE (deletes files)" : "dry run (no changes)"}`);

if (!execute) {
  const [attempts, rows] = await Promise.all([
    supabase.from("question_attempts").select("id, clerk_user_id, question_id, submitted_at"),
    supabase.from("attempt_attachments").select("id, clerk_user_id, question_id, attempt_id, storage_path, created_at"),
  ]);
  if (attempts.error || rows.error) {
    console.error("Could not read the database:", attempts.error?.message ?? rows.error?.message);
    process.exit(1);
  }
  const plan = planStorageCleanup(scope, rows.data, attempts.data);
  if (plan.conflicts.length) {
    console.error("STOP — conflicts with work after the cutoff:\n  " + plan.conflicts.join("\n  "));
    process.exit(1);
  }
  console.log(`\nTargeted attempts: ${plan.targetedAttemptCount}`);
  console.log(`Files to delete (${plan.files.length}):`);
  for (const file of plan.files) console.log(`  ${file.path}  [${file.kind}, ${file.questionId}]`);

  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const manifestPath = join(outDir, `0006-storage-manifest-${stamp}.json`);
  writeFileSync(manifestPath, JSON.stringify({ createdAt: new Date().toISOString(), scope, files: plan.files }, null, 2));
  console.log(`\nManifest saved: ${manifestPath}`);
  console.log("Review it, then run again with --execute --manifest <that file>.");
  process.exit(0);
}

// EXECUTE: delete only files listed in an approved manifest.
if (!manifestArg) {
  console.error("--execute requires --manifest <file> created by a dry run.");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestArg, "utf8"));
if (JSON.stringify(manifest.scope) !== JSON.stringify(scope)) {
  console.error("The manifest scope does not match the recorded scope. Create a new manifest with a dry run.");
  process.exit(1);
}
// Safety: every path must be inside this learner's folder for the assessment questions.
const bad = manifest.files.filter((file) => !new RegExp(`^${scope.learnerId}/intro-q(?:[1-9]|1[0-2])/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`).test(file.path));
if (bad.length) {
  console.error("Refusing: manifest contains unexpected paths:\n  " + bad.map((file) => file.path).join("\n  "));
  process.exit(1);
}

const results = { deleted: [], alreadyMissing: [], failed: [] };
const backupDir = join(outDir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`);
for (const file of manifest.files) {
  const folder = dirname(file.path);
  const name = file.path.slice(folder.length + 1);
  const listing = await supabase.storage.from(scope.bucket).list(folder, { search: name });
  if (listing.error) {
    results.failed.push({ path: file.path, error: listing.error.message });
    continue;
  }
  if (!listing.data.some((entry) => entry.name === name)) {
    results.alreadyMissing.push(file.path);
    continue;
  }
  if (backup) {
    const download = await supabase.storage.from(scope.bucket).download(file.path);
    if (download.error) {
      results.failed.push({ path: file.path, error: `backup failed, not deleted: ${download.error.message}` });
      continue;
    }
    const target = join(backupDir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, new Uint8Array(await download.data.arrayBuffer()));
  }
  const removal = await supabase.storage.from(scope.bucket).remove([file.path]);
  if (removal.error || !removal.data?.length) results.failed.push({ path: file.path, error: removal.error?.message ?? "not removed" });
  else results.deleted.push(file.path);
}

const resultPath = manifestArg.replace(/\.json$/, `-result-${Date.now()}.json`);
writeFileSync(resultPath, JSON.stringify(results, null, 2));
console.log(`\nDeleted: ${results.deleted.length}`);
console.log(`Already missing (reported, nothing else touched): ${results.alreadyMissing.length}`);
console.log(`Failed: ${results.failed.length}`);
for (const failure of results.failed) console.log(`  ${failure.path}: ${failure.error}`);
console.log(`Result saved: ${resultPath}`);
if (results.failed.length) {
  console.log("\nSome deletions failed. Re-run the same --execute command; files already deleted are reported as missing. Do NOT run the SQL until Failed is 0.");
  process.exit(2);
}
if (backup) console.log(`Backups: ${backupDir}`);
console.log("\nStorage step complete. Next: run supabase/maintenance/0006-reset-test-assessment.sql.");
