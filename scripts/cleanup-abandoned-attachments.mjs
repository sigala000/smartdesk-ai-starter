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
const orphanGraceCutoff = new Date(
  Date.now() - 24 * 60 * 60 * 1000,
).toISOString();
const result = await client
  .from("attachments")
  .select(
    "id,organization_id,storage_bucket,storage_path,upload_status,upload_expires_at,created_at",
  )
  .in("upload_status", ["pending", "validating", "deletion_pending"])
  .limit(500);
if (result.error) throw result.error;

const candidates = result.data
  .filter((row) =>
    row.upload_status === "deletion_pending"
      ? Boolean(row.upload_expires_at && row.upload_expires_at < now)
      : row.created_at < orphanGraceCutoff,
  )
  .slice(0, 100);

for (const row of candidates) {
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
        invalidated_at: now,
        upload_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
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
