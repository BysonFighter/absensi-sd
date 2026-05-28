import { json, requireUser, readJson } from "../../_shared.js";

export async function onRequestGet({ request, env }) {
  const user = await requireUser(request, env);
  const url = new URL(request.url);
  const classCode = (url.searchParams.get("classCode") || user.class_code).toUpperCase();
  const date = url.searchParams.get("date");
  if (!date) return json({ error: "Tanggal wajib diisi." }, { status: 400 });

  const rows = await env.DB.prepare(
    `SELECT a.student_id, a.status
     FROM attendance a
     JOIN students s ON s.id = a.student_id
     WHERE a.class_code = ? AND a.attendance_date = ?`
  ).bind(classCode, date).all();

  const attendance = {};
  for (const r of rows.results || []) attendance[r.student_id] = r.status;
  return json({ attendance });
}

export async function onRequestPost({ request, env }) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const classCode = String(body?.classCode || user.class_code).toUpperCase();
  const date = String(body?.date || "").trim();
  const studentId = Number(body?.studentId);
  const status = String(body?.status || "").trim().toUpperCase();

  if (!date || !studentId || !["H","S","I","A"].includes(status)) {
    return json({ error: "Data absensi tidak valid." }, { status: 400 });
  }

  await env.DB.prepare(
    `INSERT INTO attendance (class_code, attendance_date, student_id, status)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(class_code, attendance_date, student_id)
     DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP`
  ).bind(classCode, date, studentId, status).run();

  return json({ ok: true });
}
