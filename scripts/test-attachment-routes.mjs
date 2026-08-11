import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const origin = "http://127.0.0.1:3106";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function localEnvironment() {
  const output = execFileSync(
    fileURLToPath(new URL("../node_modules/.bin/supabase", import.meta.url)),
    ["status", "-o", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const values = new Map();
  for (const line of output.split("\n")) {
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    const raw = line.slice(separator + 1).trim();
    values.set(
      key,
      raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw,
    );
  }
  return {
    url: values.get("API_URL"),
    anonKey: values.get("ANON_KEY"),
    serviceRoleKey: values.get("SERVICE_ROLE_KEY"),
  };
}

async function waitForApp(child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error("Next.js exited before attachment tests started");
    try {
      if ((await fetch(`${origin}/chat/buildpro-cameroon`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Next.js did not become ready for attachment tests");
}

async function json(path, cookie, body, method = "POST") {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function createConversation(cookie = "") {
  const created = await json("/api/conversations", cookie, {
    organizationSlug: "buildpro-cameroon",
    locale: "en",
  });
  assert(created.response.status === 201, "conversation creation failed");
  const setCookie = created.response.headers.get("set-cookie");
  assert(setCookie, "conversation cookie missing");
  return {
    id: created.payload.conversation.id,
    cookie: setCookie.split(";")[0],
  };
}

async function signIn(url, anonKey, email, password) {
  let cookies = [];
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookies,
      setAll: (next) => {
        for (const cookie of next) {
          cookies = cookies.filter((item) => item.name !== cookie.name);
          cookies.push({ name: cookie.name, value: cookie.value });
        }
      },
    },
  });
  const result = await client.auth.signInWithPassword({ email, password });
  assert(!result.error, "employee sign-in failed");
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function run() {
  const environment = localEnvironment();
  assert(
    environment.url && environment.anonKey && environment.serviceRoleKey,
    "local Supabase environment is incomplete",
  );
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/next/dist/bin/next", import.meta.url),
      ),
      "dev",
      "-p",
      "3106",
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: environment.url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: environment.anonKey,
        SUPABASE_SERVICE_ROLE_KEY: environment.serviceRoleKey,
        OPENAI_ENABLED: "false",
        PUBLIC_RATE_LIMIT_SECRET:
          "attachment-route-test-secret-at-least-32-chars",
        ATTACHMENT_ALLOW_UNSCANNED: "true",
      },
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  try {
    await waitForApp(child);
    const first = await createConversation();
    const second = await createConversation();
    const bytes = new TextEncoder().encode("%PDF-1.7\n%%EOF");
    const presign = await json("/api/attachments/presign", first.cookie, {
      target: { kind: "conversation", conversationId: first.id },
      clientUploadId: crypto.randomUUID(),
      filename: "site-plan.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
    });
    assert(
      presign.response.status === 201,
      `presign failed: ${presign.response.status}`,
    );
    assert(
      !JSON.stringify(presign.payload).includes(environment.serviceRoleKey),
      "presign leaked service-role key",
    );
    const storage = createClient(
      environment.url,
      environment.anonKey,
    ).storage.from("private-attachments");
    const uploaded = await storage.uploadToSignedUrl(
      presign.payload.path,
      presign.payload.token,
      bytes,
      { contentType: "application/pdf", upsert: false },
    );
    assert(!uploaded.error, `signed upload failed: ${uploaded.error?.message}`);
    const crossTenant = await json(
      `/api/attachments/${presign.payload.attachment.id}/complete?conversationId=${second.id}`,
      second.cookie,
    );
    assert(
      crossTenant.response.status === 404,
      "another conversation could complete an attachment",
    );
    const complete = await json(
      `/api/attachments/${presign.payload.attachment.id}/complete?conversationId=${first.id}`,
      first.cookie,
    );
    assert(
      complete.response.ok,
      `valid completion failed: ${complete.response.status}`,
    );
    const listed = await json(
      `/api/conversations/${first.id}/attachments`,
      first.cookie,
      undefined,
      "GET",
    );
    assert(
      listed.response.ok && listed.payload.attachments.length === 1,
      "active attachment was not listed",
    );
    assert(
      !JSON.stringify(listed.payload).includes(presign.payload.path),
      "list response leaked storage path",
    );
    const download = await json(
      `/api/attachments/${presign.payload.attachment.id}/download?conversationId=${first.id}`,
      first.cookie,
    );
    assert(
      download.response.ok && typeof download.payload.url === "string",
      "authorized signed download failed",
    );
    assert(
      download.payload.expiresIn === 60,
      "download lifetime is not 60 seconds",
    );
    const downloadToken = new URL(download.payload.url).searchParams.get(
      "token",
    );
    assert(downloadToken, "signed download token is missing");
    const downloadClaims = JSON.parse(
      Buffer.from(downloadToken.split(".")[1], "base64url").toString("utf8"),
    );
    const remainingSeconds = downloadClaims.exp - Math.floor(Date.now() / 1000);
    assert(
      remainingSeconds > 0 && remainingSeconds <= 65,
      "Storage signed URL exceeds the 60-second application policy",
    );

    const invalidBytes = new TextEncoder().encode("<html>");
    const invalidPresign = await json(
      "/api/attachments/presign",
      first.cookie,
      {
        target: { kind: "conversation", conversationId: first.id },
        clientUploadId: crypto.randomUUID(),
        filename: "fake.pdf",
        mimeType: "application/pdf",
        sizeBytes: invalidBytes.length,
      },
    );
    assert(
      invalidPresign.response.status === 201,
      "invalid fixture presign failed unexpectedly",
    );
    const invalidUpload = await storage.uploadToSignedUrl(
      invalidPresign.payload.path,
      invalidPresign.payload.token,
      invalidBytes,
      { contentType: "application/pdf", upsert: false },
    );
    assert(
      !invalidUpload.error,
      "invalid fixture could not reach completion validation",
    );
    const rejected = await json(
      `/api/attachments/${invalidPresign.payload.attachment.id}/complete?conversationId=${first.id}`,
      first.cookie,
    );
    assert(
      rejected.response.status === 400 &&
        rejected.payload.error.code === "invalid_file_content",
      "spoofed PDF content was not rejected",
    );
    const directList = await createClient(environment.url, environment.anonKey)
      .storage.from("private-attachments")
      .list("");
    assert(
      directList.error || directList.data.length === 0,
      "anonymous client could enumerate private bucket objects",
    );

    const admin = createClient(environment.url, environment.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const email = `phase-6-manager-${randomUUID()}@example.test`;
    const password = "Phase-6-attachment-password-42!";
    const employee = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert(!employee.error && employee.data.user, "employee creation failed");
    const member = await admin
      .from("organization_members")
      .insert({
        organization_id: "10000000-0000-4000-8000-000000000001",
        user_id: employee.data.user.id,
        role: "manager",
        department_id: "11000000-0000-4000-8000-000000000001",
        display_name: "Phase 6 Manager",
      })
      .select("id")
      .single();
    assert(!member.error, "employee membership creation failed");
    const customer = await admin
      .from("customers")
      .insert({
        organization_id: "10000000-0000-4000-8000-000000000001",
        full_name: "Phase 6 Customer",
      })
      .select("id")
      .single();
    assert(!customer.error, "employee test customer creation failed");
    const requestId = randomUUID();
    const requestCreated = await admin.from("requests").insert({
      id: requestId,
      organization_id: "10000000-0000-4000-8000-000000000001",
      customer_id: customer.data.id,
      service_id: "12000000-0000-4000-8000-000000000002",
      department_id: "11000000-0000-4000-8000-000000000001",
      request_type: "quotation",
      status: "new",
      title: "Attachment route request",
      description: "Verify employee attachment access",
      location: "Douala",
      idempotency_key: randomUUID(),
      confirmed_at: new Date().toISOString(),
    });
    assert(!requestCreated.error, "employee test request creation failed");
    const employeeCookie = await signIn(
      environment.url,
      environment.anonKey,
      email,
      password,
    );
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0x00, 0x00, 0x00, 0x00,
    ]);
    const employeePresign = await json(
      "/api/attachments/presign",
      employeeCookie,
      {
        target: { kind: "request", requestId },
        clientUploadId: randomUUID(),
        filename: "site-photo.png",
        mimeType: "image/png",
        sizeBytes: png.length,
      },
    );
    assert(employeePresign.response.status === 201, "employee presign failed");
    const employeeUpload = await storage.uploadToSignedUrl(
      employeePresign.payload.path,
      employeePresign.payload.token,
      png,
      { contentType: "image/png", upsert: false },
    );
    assert(!employeeUpload.error, "employee signed upload failed");
    const employeeComplete = await json(
      `/api/attachments/${employeePresign.payload.attachment.id}/complete`,
      employeeCookie,
    );
    assert(employeeComplete.response.ok, "employee completion failed");
    const detail = await json(
      `/api/dashboard/requests/${requestId}`,
      employeeCookie,
      undefined,
      "GET",
    );
    assert(
      detail.response.ok &&
        detail.payload.attachments.some(
          (item) => item.id === employeePresign.payload.attachment.id,
        ),
      "employee request detail did not show the active attachment",
    );
    const employeeDownload = await json(
      `/api/attachments/${employeePresign.payload.attachment.id}/download`,
      employeeCookie,
    );
    assert(employeeDownload.response.ok, "employee signed download failed");

    const otherOrganizationId = randomUUID();
    const otherDepartmentId = randomUUID();
    const otherServiceId = randomUUID();
    const otherCustomerId = randomUUID();
    const otherRequestId = randomUUID();
    const otherOrganization = await admin.from("organizations").insert({
      id: otherOrganizationId,
      name: "Phase 6 Other Tenant",
      slug: `phase-6-other-${randomUUID()}`,
      reference_prefix: `Z${randomUUID().replaceAll("-", "").slice(0, 7).toUpperCase()}`,
    });
    assert(!otherOrganization.error, "other organization creation failed");
    const otherDepartment = await admin.from("departments").insert({
      id: otherDepartmentId,
      organization_id: otherOrganizationId,
      name: "Other Support",
    });
    assert(!otherDepartment.error, "other department creation failed");
    const otherService = await admin.from("services").insert({
      id: otherServiceId,
      organization_id: otherOrganizationId,
      department_id: otherDepartmentId,
      name: "Other Service",
    });
    assert(!otherService.error, "other service creation failed");
    const otherCustomer = await admin.from("customers").insert({
      id: otherCustomerId,
      organization_id: otherOrganizationId,
      full_name: "Other Customer",
    });
    assert(!otherCustomer.error, "other customer creation failed");
    const otherRequest = await admin.from("requests").insert({
      id: otherRequestId,
      organization_id: otherOrganizationId,
      customer_id: otherCustomerId,
      service_id: otherServiceId,
      department_id: otherDepartmentId,
      request_type: "quotation",
      status: "new",
      title: "Other request",
      description: "Cross-tenant attachment test",
      location: "Yaounde",
      idempotency_key: randomUUID(),
      confirmed_at: new Date().toISOString(),
    });
    assert(!otherRequest.error, "other request creation failed");
    const otherEmail = `phase-6-other-${randomUUID()}@example.test`;
    const otherUser = await admin.auth.admin.createUser({
      email: otherEmail,
      password,
      email_confirm: true,
    });
    assert(
      !otherUser.error && otherUser.data.user,
      "other user creation failed",
    );
    const otherMember = await admin
      .from("organization_members")
      .insert({
        organization_id: otherOrganizationId,
        user_id: otherUser.data.user.id,
        role: "manager",
        department_id: otherDepartmentId,
        display_name: "Other Manager",
      })
      .select("id")
      .single();
    assert(!otherMember.error, "other membership creation failed");
    const otherCookie = await signIn(
      environment.url,
      environment.anonKey,
      otherEmail,
      password,
    );
    const crossTenantDownload = await json(
      `/api/attachments/${employeePresign.payload.attachment.id}/download`,
      otherCookie,
    );
    assert(
      crossTenantDownload.response.status === 404,
      "an employee could download another tenant's attachment",
    );
    const deactivated = await admin
      .from("organization_members")
      .update({ is_active: false })
      .eq("id", otherMember.data.id);
    assert(!deactivated.error, "membership deactivation failed");
    const deactivatedPresign = await json(
      "/api/attachments/presign",
      otherCookie,
      {
        target: { kind: "request", requestId: otherRequestId },
        clientUploadId: randomUUID(),
        filename: "blocked.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
      },
    );
    assert(
      deactivatedPresign.response.status === 403,
      "a deactivated employee could initiate an attachment upload",
    );

    const oldAttachmentId = randomUUID();
    const oldPath = `10000000-0000-4000-8000-000000000001/conversation/${first.id}/${oldAttachmentId}.pdf`;
    const oldObject = await admin.storage
      .from("private-attachments")
      .upload(oldPath, bytes, { contentType: "application/pdf" });
    assert(!oldObject.error, "cleanup fixture upload failed");
    const oldMetadata = await admin.from("attachments").insert({
      id: oldAttachmentId,
      organization_id: "10000000-0000-4000-8000-000000000001",
      conversation_id: first.id,
      storage_bucket: "private-attachments",
      storage_path: oldPath,
      original_filename: "old.pdf",
      mime_type: "application/pdf",
      size_bytes: bytes.length,
      upload_status: "pending",
      upload_expires_at: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
      uploaded_by_type: "customer",
      client_upload_id: randomUUID(),
      created_at: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
    });
    assert(!oldMetadata.error, "cleanup fixture metadata failed");
    const recentAttachmentId = randomUUID();
    const recentPath = `10000000-0000-4000-8000-000000000001/conversation/${first.id}/${recentAttachmentId}.pdf`;
    const recentObject = await admin.storage
      .from("private-attachments")
      .upload(recentPath, bytes, { contentType: "application/pdf" });
    assert(!recentObject.error, "recent cleanup fixture upload failed");
    const recentMetadata = await admin.from("attachments").insert({
      id: recentAttachmentId,
      organization_id: "10000000-0000-4000-8000-000000000001",
      conversation_id: first.id,
      storage_bucket: "private-attachments",
      storage_path: recentPath,
      original_filename: "recent.pdf",
      mime_type: "application/pdf",
      size_bytes: bytes.length,
      upload_status: "pending",
      upload_expires_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      uploaded_by_type: "customer",
      client_upload_id: randomUUID(),
      created_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    });
    assert(!recentMetadata.error, "recent cleanup fixture metadata failed");
    execFileSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("./cleanup-abandoned-attachments.mjs", import.meta.url),
        ),
      ],
      {
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: environment.url,
          SUPABASE_SERVICE_ROLE_KEY: environment.serviceRoleKey,
        },
        stdio: "ignore",
      },
    );
    const cleaned = await admin
      .from("attachments")
      .select("upload_status")
      .eq("id", oldAttachmentId)
      .single();
    assert(
      !cleaned.error && cleaned.data.upload_status === "deleted",
      "abandoned attachment cleanup did not close metadata",
    );
    const retained = await admin
      .from("attachments")
      .select("upload_status")
      .eq("id", recentAttachmentId)
      .single();
    assert(
      !retained.error && retained.data.upload_status === "pending",
      "cleanup removed an object inside the provider-token grace period",
    );
    console.log("Phase 6 attachment route and private Storage checks passed");
  } finally {
    child.kill("SIGTERM");
  }
}

await run();
