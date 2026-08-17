import { createServer } from "node:http";

const port = 3010;
const upstream = "http://127.0.0.1:3000/api/webhooks/whatsapp";

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  if (
    url.pathname !== "/api/webhooks/whatsapp" ||
    !["GET", "POST"].includes(request.method ?? "")
  ) {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
    return;
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 262_144) {
      response.writeHead(413, { "Content-Type": "text/plain" });
      response.end("Payload too large");
      return;
    }
    chunks.push(chunk);
  }
  try {
    const target = `${upstream}${url.search}`;
    const forwarded = await fetch(target, {
      method: request.method,
      headers: {
        ...(request.headers["content-type"]
          ? { "content-type": request.headers["content-type"] }
          : {}),
        ...(request.headers["x-hub-signature-256"]
          ? {
              "x-hub-signature-256": request.headers["x-hub-signature-256"],
            }
          : {}),
      },
      body: request.method === "POST" ? Buffer.concat(chunks) : undefined,
    });
    response.writeHead(forwarded.status, {
      "Content-Type":
        forwarded.headers.get("content-type") ?? "text/plain; charset=utf-8",
    });
    response.end(Buffer.from(await forwarded.arrayBuffer()));
  } catch {
    response.writeHead(502, { "Content-Type": "text/plain" });
    response.end("Webhook unavailable");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `Restricted WhatsApp webhook proxy listening on http://127.0.0.1:${port}`,
  );
});
