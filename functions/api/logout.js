import { json } from "../../_shared.js";
export async function onRequestPost({ request, env }) {
  const header = request.headers.get("Authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (m) await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(m[1]).run();
  return json({ ok: true }, {
    headers: { "Set-Cookie": "token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" },
  });
}
