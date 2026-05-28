import { json, requireUser, readJson } from "../../_shared.js";

export async function onRequestGet({ request, env }) {
  const user = await requireUser(request, env);
  const url = new URL(request.url);
  const classCode = (url.searchParams.get("classCode") || user.class_code).toUpperCase();
  const rows = await env.DB.prepare(
    `SELECT id, nisn, name, number, class_code
     FROM students WHERE class_code = ?
     ORDER BY COALESCE(number, 99999), name`
  ).bind(classCode).all();
  return json({ students: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const classCode = String(body?.classCode || user.class_code).toUpperCase();
  const items = Array.isArray(body?.students) ? body.students : [];
  if (!items.length) return json({ error: "Tidak ada data siswa." }, { status: 400 });

  for (const s of items) {
    const nisn = String(s.nisn || "").trim();
    const name = String(s.name || "").trim();
    const number = s.number === "" || s.number == null ? null : Number(s.number);
    if (!nisn || !name) continue;
    await env.DB.prepare(
      `INSERT INTO students (class_code, nisn, name, number)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(nisn) DO UPDATE SET
         class_code=excluded.class_code,
         name=excluded.name,
         number=excluded.number`
    ).bind(classCode, nisn, name, number).run();
  }

  return json({ ok: true });
}
