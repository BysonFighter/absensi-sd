import { json, hashPassword, randomToken, readJson } from "../../_shared.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body?.username || !body?.password) {
    return json({ error: "Username dan password wajib diisi." }, { status: 400 });
  }

  const username = String(body.username).trim().toLowerCase();
  const user = await env.DB.prepare(
    `SELECT id, username, password_hash, full_name, class_code, role
     FROM users WHERE username = ?`
  ).bind(username).first();

  if (!user) return json({ error: "Login gagal." }, { status: 401 });

  const hash = await hashPassword(String(body.password));
  if (hash !== user.password_hash) return json({ error: "Login gagal." }, { status: 401 });

  const token = randomToken();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
  ).bind(token, user.id, expires).run();

  return json({
    ok: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      class_code: user.class_code,
      role: user.role,
    },
  }, {
    headers: { "Set-Cookie": `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7*24*60*60}` },
  });
}
