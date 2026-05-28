import { json, requireUser } from "../../_shared.js";
export async function onRequestGet({ request, env }) {
  await requireUser(request, env);
  const rows = await env.DB.prepare(`SELECT code, grade, section, name FROM classes ORDER BY grade, section`).all();
  return json({ classes: rows.results || [] });
}
