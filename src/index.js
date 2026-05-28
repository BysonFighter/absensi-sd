const PASSWORD_HASH_123456 = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function getUser(request, env) {
  const token = getToken(request);
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT s.token, s.expires_at, u.id, u.username, u.full_name, u.class_code, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`
  ).bind(token).first();

  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return null;
  }

  return row;
}

function pageHtml() {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Absensi SD</title>
<style>
body{margin:0;font-family:Arial,sans-serif;background:#f4f7fb;color:#111}
.wrap{max-width:900px;margin:0 auto;padding:16px 12px 90px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:16px;box-shadow:0 6px 20px rgba(0,0,0,.04);margin-bottom:12px}
h1,h2,p{margin:0}
.small{font-size:12px;color:#64748b}
input,button{font:inherit}
input{width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:14px;box-sizing:border-box;margin-top:10px}
button{padding:12px 14px;border:0;border-radius:14px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}
button.gray{background:#e2e8f0;color:#111}
button.green{background:#16a34a}
button.amber{background:#d97706}
button.red{background:#dc2626}
button.blue{background:#2563eb}
.row{display:flex;gap:8px;flex-wrap:wrap}
.top{display:flex;justify-content:space-between;gap:10px;align-items:center}
.list{display:grid;gap:10px;margin-top:12px}
.student{border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:#f8fafc}
.meta{font-size:12px;color:#64748b;margin-bottom:4px}
.name{font-weight:700;margin-bottom:10px}
.badge{display:inline-block;padding:5px 10px;border-radius:999px;background:#eef2ff;color:#1d4ed8;font-size:12px;font-weight:700}
.statuses{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.statuses button{width:100%}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.tab{border:1px solid #cbd5e1;background:#fff;color:#111}
.tab.active{background:#2563eb;color:#fff;border-color:#2563eb}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
.stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px;text-align:center}
.stat .n{font-size:22px;font-weight:800}
.stat .t{font-size:12px;color:#64748b}
.error{color:#dc2626;font-size:13px;margin-top:10px}
.ok{color:#16a34a;font-size:13px;margin-top:10px}
</style>
</head>
<body>
<div id="app"></div>
<script>
const STATUS = [
  {k:"H", label:"Hadir", cls:"green"},
  {k:"S", label:"Sakit", cls:"amber"},
  {k:"I", label:"Izin", cls:"blue"},
  {k:"A", label:"Alpha", cls:"red"},
];

const app = document.getElementById("app");
const state = {
  user: null,
  students: [],
  attendance: {},
  date: new Date().toISOString().slice(0,10),
  loading: true,
  message: "",
};

async function api(path, options = {}) {
  const headers = options.headers || {};
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = "Bearer " + token;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data.error || data.message || text || "Error system");
  return data;
}

function fmtDate(d){
  return new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date(d+"T00:00:00"));
}

function renderLogin() {
  app.innerHTML = \`
    <div class="wrap">
      <div class="card" style="max-width:420px;margin:40px auto">
        <h2>Login Wali Kelas</h2>
        <p class="small" style="margin-top:6px">Masuk untuk absensi kelas.</p>
        <input id="username" placeholder="Username, contoh: 1a">
        <input id="password" type="password" placeholder="Password, contoh: 123456">
        <div class="row" style="margin-top:12px">
          <button id="loginBtn">Masuk</button>
        </div>
        <div id="loginMsg" class="error"></div>
      </div>
    </div>
  \`;
  document.getElementById("loginBtn").onclick = login;
  document.getElementById("password").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
}

function renderApp() {
  const counts = { H: 0, S: 0, I: 0, A: 0 };
  Object.values(state.attendance).forEach(v => { if (counts[v] !== undefined) counts[v]++; });

  app.innerHTML = \`
    <div class="wrap">
      <div class="card">
        <div class="top">
          <div>
            <h2>Absensi SD</h2>
            <p class="small" style="margin-top:4px">Login sebagai <b>\${state.user.full_name}</b> • Kelas <b>\${state.user.class_code}</b></p>
          </div>
          <button class="gray" id="logoutBtn">Keluar</button>
        </div>

        <div class="stats">
          <div class="stat"><div class="n">\${counts.H}</div><div class="t">Hadir</div></div>
          <div class="stat"><div class="n">\${counts.S}</div><div class="t">Sakit</div></div>
          <div class="stat"><div class="n">\${counts.I}</div><div class="t">Izin</div></div>
          <div class="stat"><div class="n">\${counts.A}</div><div class="t">Alpha</div></div>
        </div>

        <div class="tabs">
          <button class="tab active">Absensi Hari Ini</button>
          <button class="tab" id="reloadBtn">Muat Ulang</button>
        </div>
      </div>

      <div class="card">
        <h2>\${fmtDate(state.date)}</h2>
        <div class="list" id="studentList"></div>
        <div id="msg" class="ok">\${state.message || ""}</div>
      </div>
    </div>
  \`;

  document.getElementById("logoutBtn").onclick = logout;
  document.getElementById("reloadBtn").onclick = async () => {
    await loadData();
    renderApp();
  };

  const list = document.getElementById("studentList");
  if (!state.students.length) {
    list.innerHTML = '<div class="small">Belum ada siswa di tabel students.</div>';
    return;
  }

  list.innerHTML = state.students.map((s, idx) => {
    const cur = state.attendance[s.id] || "";
    return \`
      <div class="student">
        <div class="meta">No \${s.number || idx + 1} • NISN \${s.nisn}</div>
        <div class="name">\${s.name}</div>
        <div class="badge">Status: \${cur || "Belum"}</div>
        <div class="statuses" style="margin-top:10px">
          \${STATUS.map(st => \`<button class="\${st.cls}" data-id="\${s.id}" data-status="\${st.k}">\${st.label}</button>\`).join("")}
        </div>
      </div>
    \`;
  }).join("");

  list.querySelectorAll("button[data-id]").forEach(btn => {
    btn.onclick = async () => {
      await api("/api/attendance", {
        method: "POST",
        body: JSON.stringify({
          classCode: state.user.class_code,
          date: state.date,
          studentId: Number(btn.dataset.id),
          status: btn.dataset.status,
        })
      });
      await loadData();
      renderApp();
    };
  });
}

async function loadData() {
  const me = await api("/api/me");
  state.user = me.user;
  if (!state.user) return;

  const st = await api("/api/students?classCode=" + encodeURIComponent(state.user.class_code));
  state.students = st.students || [];

  const at = await api("/api/attendance?classCode=" + encodeURIComponent(state.user.class_code) + "&date=" + encodeURIComponent(state.date));
  state.attendance = at.attendance || {};
}

async function login() {
  const msg = document.getElementById("loginMsg");
  msg.textContent = "Memproses...";

  try {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (!data.token) throw new Error("Token kosong");

    localStorage.setItem("token", data.token);
    state.user = data.user;
    await loadData();
    renderApp();
  } catch (e) {
    msg.textContent = e.message || String(e);
  }
}

async function logout() {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (e) {}
  localStorage.removeItem("token");
  state.user = null;
  state.students = [];
  state.attendance = {};
  renderLogin();
}

async function boot() {
  try {
    const me = await api("/api/me");
    state.user = me.user;
    if (state.user) {
      await loadData();
      renderApp();
      return;
    }
  } catch (e) {}
  renderLogin();
}

boot();
</script>
</body>
</html>`;
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (url.pathname === "/api/test") {
    const users = await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
    const students = await env.DB.prepare("SELECT COUNT(*) AS total FROM students").first();
    const attendance = await env.DB.prepare("SELECT COUNT(*) AS total FROM attendance").first();
    return json({
      ok: true,
      users: users?.total ?? 0,
      students: students?.total ?? 0,
      attendance: attendance?.total ?? 0,
    });
  }

  if (url.pathname === "/api/me" && method === "GET") {
    const user = await getUser(request, env);
    return json({ user });
  }

  if (url.pathname === "/api/login" && method === "POST") {
    try {
      const body = await request.json();
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");

      const user = await env.DB.prepare(
        "SELECT id, username, password_hash, full_name, class_code, role FROM users WHERE username = ?"
      ).bind(username).first();

      if (!user) return json({ success: false, message: "User tidak ditemukan" }, 401);

      const hash = await sha256(password);
      if (hash !== user.password_hash) return json({ success: false, message: "Password salah" }, 401);

      const token = crypto.randomUUID().replaceAll("-", "");
      const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await env.DB.prepare(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
      ).bind(token, user.id, expires_at).run();

      return json({
        success: true,
        token,
        user: {
          username: user.username,
          full_name: user.full_name,
          class_code: user.class_code,
          role: user.role,
        },
      });
    } catch (e) {
      return json({ success: false, message: e.message || String(e) }, 500);
    }
  }

  if (url.pathname === "/api/logout" && method === "POST") {
    const token = getToken(request);
    if (token) {
      await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    }
    return json({ success: true });
  }

  if (url.pathname === "/api/students" && method === "GET") {
    const user = await getUser(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const classCode = String(url.searchParams.get("classCode") || user.class_code).trim();

    const rows = await env.DB.prepare(
      `SELECT id, nisn, name, number, class_code
       FROM students
       WHERE class_code = ?
       ORDER BY COALESCE(number, 99999), name`
    ).bind(classCode).all();

    return json({ students: rows.results || [] });
  }

  if (url.pathname === "/api/attendance" && method === "GET") {
    const user = await getUser(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const classCode = String(url.searchParams.get("classCode") || user.class_code).trim();
    const date = String(url.searchParams.get("date") || "").trim();
    if (!date) return json({ error: "Tanggal wajib diisi" }, 400);

    const rows = await env.DB.prepare(
      `SELECT student_id, status
       FROM attendance
       WHERE class_code = ? AND attendance_date = ?`
    ).bind(classCode, date).all();

    const attendance = {};
    for (const row of rows.results || []) {
      attendance[row.student_id] = row.status;
    }

    return json({ attendance });
  }

  if (url.pathname === "/api/attendance" && method === "POST") {
    const user = await getUser(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const classCode = String(body.classCode || user.class_code).trim();
    const date = String(body.date || "").trim();
    const studentId = Number(body.studentId);
    const status = String(body.status || "").trim().toUpperCase();

    if (!date || !studentId || !["H", "S", "I", "A"].includes(status)) {
      return json({ error: "Data absensi tidak valid" }, 400);
    }

    await env.DB.prepare(
      `INSERT INTO attendance (class_code, attendance_date, student_id, status)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(class_code, attendance_date, student_id)
       DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP`
    ).bind(classCode, date, studentId, status).run();

    return json({ success: true });
  }

  if (url.pathname === "/api/attendance" && method === "DELETE") {
    const user = await getUser(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const classCode = String(body.classCode || user.class_code).trim();
    const date = String(body.date || "").trim();

    if (!date) return json({ error: "Tanggal wajib diisi" }, 400);

    await env.DB.prepare(
      "DELETE FROM attendance WHERE class_code = ? AND attendance_date = ?"
    ).bind(classCode, date).run();

    return json({ success: true });
  }

  if (url.pathname === "/api/seed" && method === "POST") {
    const classes = [
      ["1a", "Wali Kelas 1A"], ["1b", "Wali Kelas 1B"],
      ["2a", "Wali Kelas 2A"], ["2b", "Wali Kelas 2B"],
      ["3a", "Wali Kelas 3A"], ["3b", "Wali Kelas 3B"],
      ["4a", "Wali Kelas 4A"], ["4b", "Wali Kelas 4B"],
      ["5a", "Wali Kelas 5A"], ["5b", "Wali Kelas 5B"],
      ["6a", "Wali Kelas 6A"], ["6b", "Wali Kelas 6B"],
    ];

    for (const [username, fullName] of classes) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO users (username, password_hash, full_name, class_code, role)
         VALUES (?, ?, ?, ?, 'wali_kelas')`
      ).bind(username, PASSWORD_HASH_123456, fullName, username).run();
    }

    return json({ success: true });
  }

  return null;
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname.startsWith("/api/")) {
        const result = await handleApi(request, env);
        return result || json({ error: "Not found" }, 404);
      }

      return new Response(pageHtml(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } catch (e) {
      return json({ error: e.message || String(e), stack: e.stack || "" }, 500);
    }
  },
};
