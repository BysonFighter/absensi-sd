import { json, hashPassword } from "../../_shared.js";

export async function onRequestPost({ env }) {
  const classes = [
    ["1A",1,"A","Kelas 1A"],["1B",1,"B","Kelas 1B"],
    ["2A",2,"A","Kelas 2A"],["2B",2,"B","Kelas 2B"],
    ["3A",3,"A","Kelas 3A"],["3B",3,"B","Kelas 3B"],
    ["4A",4,"A","Kelas 4A"],["4B",4,"B","Kelas 4B"],
    ["5A",5,"A","Kelas 5A"],["5B",5,"B","Kelas 5B"],
    ["6A",6,"A","Kelas 6A"],["6B",6,"B","Kelas 6B"],
  ];
  for (const c of classes) {
    await env.DB.prepare(`INSERT OR IGNORE INTO classes(code, grade, section, name) VALUES (?, ?, ?, ?)`).bind(...c).run();
  }
  const pass = await hashPassword("123456");
  for (const c of classes) {
    const code = c[0];
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users(username, password_hash, full_name, class_code, role)
       VALUES (?, ?, ?, ?, 'wali_kelas')`
    ).bind(code.toLowerCase(), pass, `Wali Kelas ${code}`, code).run();
  }
  return json({ ok: true, note: "Akun demo dibuat: username 1a-6b, password 123456" });
}
