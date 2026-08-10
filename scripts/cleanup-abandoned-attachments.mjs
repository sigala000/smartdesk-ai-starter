import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
}

const client = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const now = new Date().toISOString();
const result = await client
  .from("attachments")
  .select("id,organization_id,storage_bucket,storage_path,upload_status")
  .in("upload_status", ["pending", "validating", "deletion_pending"])
  .lt("upload_expires_at", now)
  .limit(100);
if (result.error) throw result.error;

for (const row of result.data) {
  const safePrefix = `${row.organization_id}/`;
  if (
    row.storage_bucket !== "private-attachments" ||
    !row.storage_path.startsWith(safePrefix)
  ) {
    console.error(`Skipped unsafe attachment path for ${row.id}`);
    continue;
  }
  if (dryRun) {
    console.log(`Would clean attachment ${row.id}`);
    continue;
  }
  const removed = await client.storage
    .from("private-attachments")
    .remove([row.storage_path]);
  if (removed.error) {
    await client
      .from("attachments")
      .update({
        upload_status: "deletion_pending",
        rejection_code: "cleanup_retry_required",
      })
      .eq("id", row.id)
      .eq("organization_id", row.organization_id);
    continue;
  }
  await client
    .from("attachments")
    .update({
      upload_status: "deleted",
      deleted_at: now,
      rejection_code:
        row.upload_status === "pending" ? "upload_abandoned" : null,
    })
    .eq("id", row.id)
    .eq("organization_id", row.organization_id);
  console.log(`Cleaned attachment ${row.id}`);
}
