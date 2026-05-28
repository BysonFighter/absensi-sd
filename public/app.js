
const app = document.getElementById("app");
const STATUS = [
  { k: "H", l: "Hadir", c: "H" },
  { k: "S", l: "Sakit", c: "S" },
  { k: "I", l: "Izin", c: "I" },
  { k: "A", l: "Alpha", c: "A" },
];

const state = {
  user: null, classes: [], students: [], attendance: {}, date: new Date(),
  query: "", tab: "absensi", sheetOpen: false, loading: true
};

const iso = (d) => d.toISOString().slice(0, 10);
const toDate = (s) => new Date(s + "T00:00:00");
const fmt = (d) => new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(d);
const fmtDay = (d) => new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "2-digit", month: "short" }).format(d);
const esc = (s) => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

async function api(path, options = {}) {
  const headers = options.headers || {};
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || error.message);
  return data;
}

function startWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function render() {
  if (state.loading) {
    app.innerHTML = `<div class="login-wrap"><div class="login-card"><div class="small">Memuat...</div></div></div>`;
    return;
  }

  if (!state.user) {
    app.innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <p class="small" style="text-transform:uppercase;letter-spacing:.18em;font-weight:800;margin:0">Login Wali Kelas</p>
          <h1 style="margin-top:6px">Absensi SD</h1>
          <p class="sub">Masuk dulu untuk kelas 1A sampai 6B.</p>
          <div class="field"><label>Username</label><input id="username" placeholder="Contoh: 1a" autocomplete="username"></div>
          <div class="field"><label>Password</label><input id="password" type="password" placeholder="Contoh: 123456" autocomplete="current-password"></div>
          <div class="toolbar"><button class="btn primary" id="loginBtn">Masuk</button></div>
          <div class="small" style="margin-top:12px">Demo login: username <b>1a</b> sampai <b>6b</b>, password <b>123456</b>.</div>
          <div id="loginMsg" class="small" style="margin-top:8px;color:#e11d48"></div>
        </div>
      </div>
    `;
    document.getElementById("loginBtn").onclick = login;
    document.getElementById("password").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
    return;
  }

  const wk = startWeek(state.date);
  const counts = { H: 0, S: 0, I: 0, A: 0 };
  Object.values(state.attendance || {}).forEach(v => { if (counts[v] !== undefined) counts[v]++; });
  const filtered = state.students.filter(s => {
    const q = state.query.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.nisn.includes(q);
  });
  const dateKey = iso(state.date);

  let body = "";
  if (state.tab === "absensi") {
    body = `
      <div class="card">
        <div class="row">
          <button class="iconbtn" id="prevDay">←</button>
          <div class="datebox">📅 <span>${fmt(state.date)}</span></div>
          <button class="iconbtn" id="nextDay">→</button>
        </div>
        <div class="week">
          ${Array.from({ length: 7 }, (_, i) => {
            const d = new Date(wk); d.setDate(d.getDate() + i);
            const active = iso(d) === dateKey ? "active" : "";
            return `<button class="day ${active}" data-date="${iso(d)}"><div>${fmtDay(d).split(",")[0]}</div><div class="n">${d.getDate()}</div></button>`;
          }).join("")}
        </div>
        <div class="stats">
          <div class="stat s-H"><div class="num">${counts.H}</div><div class="lab">Hadir</div></div>
          <div class="stat s-S"><div class="num">${counts.S}</div><div class="lab">Sakit</div></div>
          <div class="stat s-I"><div class="num">${counts.I}</div><div class="lab">Izin</div></div>
          <div class="stat s-A"><div class="num">${counts.A}</div><div class="lab">Alpha</div></div>
        </div>
      </div>
      <div class="card">
        <div class="search"><span>🔎</span><input id="q" value="${esc(state.query)}" placeholder="Cari nama / NISN"></div>
        <div id="studentList"></div>
      </div>
    `;
  } else if (state.tab === "siswa") {
    body = `
      <div class="card">
        <div class="top">
          <div><h2>${esc(state.user.full_name)}</h2><div class="sub">Kelas ${esc(state.user.class_code)}</div></div>
          <button class="iconbtn" id="openSheet">⚙</button>
        </div>
        <div class="toolbar">
          <button class="btn primary" id="btnImport">Simpan Siswa</button>
          <button class="btn" id="btnTemplate">Contoh CSV</button>
        </div>
        <div class="field">
          <label>Tambah / tempel CSV siswa</label>
          <textarea id="csvArea" rows="8" placeholder="nisn,nama,nomor&#10;3136899923,REVAL RESTU MAULANA,1"></textarea>
        </div>
        <div class="small">Format: <b>nisn,nama,nomor</b>. Baris header boleh ikut ditempel.</div>
      </div>
      <div class="card">
        <div class="search"><span>🔎</span><input id="q" value="${esc(state.query)}" placeholder="Cari siswa"></div>
        <div id="studentList"></div>
      </div>
    `;
  } else {
    body = `
      <div class="card">
        <div class="kpi">
          <div class="box"><div class="n">${state.students.length}</div><div class="t">Jumlah siswa</div></div>
          <div class="box"><div class="n">${counts.H}</div><div class="t">Hadir</div></div>
          <div class="box"><div class="n">${counts.S + counts.I + counts.A}</div><div class="t">Tidak hadir</div></div>
          <div class="box"><div class="n">${dateKey}</div><div class="t">Tanggal</div></div>
        </div>
      </div>
      <div class="card">
        <h2>Rekap singkat</h2>
        <div class="small" style="margin-top:10px">Rekap bulanan dan export Excel bisa ditambah nanti.</div>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="wrap">
      <div class="card">
        <div class="top">
          <div>
            <p class="small" style="text-transform:uppercase;letter-spacing:.18em;font-weight:800;margin:0">Absensi Wali Kelas</p>
            <h1 style="margin-top:6px">SD YPU 2026</h1>
            <p class="sub">Login sebagai <b>${esc(state.user.full_name)}</b> • Kelas <b>${esc(state.user.class_code)}</b></p>
          </div>
          <button class="iconbtn" id="logoutBtn">Keluar</button>
        </div>
      </div>

      <div class="card">
        <div class="tabs">
          <button class="tab ${state.tab === "absensi" ? "active" : ""}" data-tab="absensi">Absensi</button>
          <button class="tab ${state.tab === "siswa" ? "active" : ""}" data-tab="siswa">Siswa</button>
          <button class="tab ${state.tab === "rekap" ? "active" : ""}" data-tab="rekap">Rekap</button>
        </div>
      </div>

      ${body}
    </div>

    <div class="bottom">
      <div class="in">
        <button class="btn" id="optionsBtn" style="flex:1">Options</button>
        <button class="btn primary" id="saveBtn" style="flex:1">Simpan / Export</button>
      </div>
    </div>

    <div class="overlay" id="overlay" style="display:${state.sheetOpen ? "flex" : "none"}">
      <div class="sheet">
        <div class="sheetbar"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div>
            <div style="font-size:18px;font-weight:900">Options</div>
            <div class="small">Aksi cepat untuk kelas ${esc(state.user.class_code)}.</div>
          </div>
          <button class="iconbtn" id="closeSheet">✕</button>
        </div>
        <div class="sheetgrid" style="margin-top:12px">
          <button class="sheetbtn green" id="allH">Semua Hadir</button>
          <button class="sheetbtn amber" id="allS">Semua Sakit</button>
          <button class="sheetbtn blue" id="allI">Semua Izin</button>
          <button class="sheetbtn rose" id="allA">Semua Alpha</button>
          <button class="sheetbtn full" id="clearDay">Kosongkan Absensi Hari Ini</button>
          <button class="sheetbtn full blue" id="exportBtn">Export CSV</button>
        </div>
        <div class="small" style="margin-top:12px">Data tersimpan di database D1, bukan hanya di browser.</div>
      </div>
    </div>
  `;

  document.querySelectorAll("[data-tab]").forEach(btn => btn.onclick = () => { state.tab = btn.dataset.tab; render(); });
  if (state.tab === "absensi" || state.tab === "siswa") {
    document.getElementById("q").oninput = (e) => { state.query = e.target.value; render(); };
    renderStudentList();
  }

  const prev = document.getElementById("prevDay");
  const next = document.getElementById("nextDay");
  if (prev) prev.onclick = () => { state.date.setDate(state.date.getDate() - 1); loadAttendance().then(render); };
  if (next) next.onclick = () => { state.date.setDate(state.date.getDate() + 1); loadAttendance().then(render); };
  document.querySelectorAll(".day[data-date]").forEach(btn => {
    btn.onclick = () => { state.date = toDate(btn.dataset.date); loadAttendance().then(render); };
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;

  const openSheet = document.getElementById("optionsBtn");
  if (openSheet) openSheet.onclick = () => { state.sheetOpen = true; render(); };
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.onclick = (e) => { if (e.target === overlay) { state.sheetOpen = false; render(); } };
  const closeSheet = document.getElementById("closeSheet");
  if (closeSheet) closeSheet.onclick = () => { state.sheetOpen = false; render(); };

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.onclick = exportCSV;

  const allH = document.getElementById("allH");
  const allS = document.getElementById("allS");
  const allI = document.getElementById("allI");
  const allA = document.getElementById("allA");
  if (allH) allH.onclick = () => setAll("H");
  if (allS) allS.onclick = () => setAll("S");
  if (allI) allI.onclick = () => setAll("I");
  if (allA) allA.onclick = () => setAll("A");
  const clearDay = document.getElementById("clearDay");
  if (clearDay) clearDay.onclick = clearToday;
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) exportBtn.onclick = exportCSV;

  const btnImport = document.getElementById("btnImport");
  if (btnImport) btnImport.onclick = importCSV;
  const btnTemplate = document.getElementById("btnTemplate");
  if (btnTemplate) btnTemplate.onclick = () => alert("Format CSV:\nnisn,nama,nomor\n3136899923,REVAL RESTU MAULANA,1");
}

function renderStudentList() {
  const list = document.getElementById("studentList");
  if (!list) return;
  if (!state.students.length) {
    list.innerHTML = `<div class="small" style="padding:16px 4px">Belum ada siswa. Masuk tab <b>Siswa</b> untuk input data.</div>`;
    return;
  }
  const filtered = state.students.filter(s => {
    const q = state.query.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.nisn.includes(q);
  });
  const rec = state.attendance || {};
  list.innerHTML = filtered.map(s => {
    const cur = rec[s.id] || "";
    return `
      <div class="student">
        <div class="head">
          <div>
            <div class="meta">NISN ${esc(s.nisn)} • No ${s.number ?? "-"}</div>
            <div class="name">${esc(s.name)}</div>
          </div>
          <div class="badge">${cur || "Belum"}</div>
        </div>
        <div class="choices">
          ${STATUS.map(st => `<button class="choice ${cur === st.k ? "active " + st.c : ""}" data-id="${s.id}" data-st="${st.k}">${st.l}</button>`).join("")}
        </div>
      </div>
    `;
  }).join("") || `<div class="small" style="padding:16px 4px">Tidak ada data yang cocok.</div>`;

  list.querySelectorAll(".choice").forEach(btn => btn.onclick = async () => {
    await saveAttendance(Number(btn.dataset.id), btn.dataset.st);
    await loadAttendance();
    render();
  });
}

async function loadMe() { const d = await api("/api/me"); state.user = d.user; }
async function loadClasses() { const d = await api("/api/classes"); state.classes = d.classes || []; }
async function loadStudents() { const d = await api(`/api/students?classCode=${encodeURIComponent(state.user.class_code)}`); state.students = d.students || []; }
async function loadAttendance() { const d = await api(`/api/attendance?classCode=${encodeURIComponent(state.user.class_code)}&date=${iso(state.date)}`); state.attendance = d.attendance || {}; }

async function saveAttendance(studentId, status) {
  await api("/api/attendance", { method: "POST", body: JSON.stringify({
    classCode: state.user.class_code, date: iso(state.date), studentId, status
  })});
}

async function setAll(status) {
  for (const s of state.students) {
    await saveAttendance(s.id, status);
  }
  await loadAttendance();
  state.sheetOpen = false;
  render();
}

async function clearToday() {
  if (!confirm("Kosongkan semua status di tanggal ini?")) return;
  const current = state.students.map(s => s.id);
  for (const id of current) {
    await api("/api/attendance", { method: "POST", body: JSON.stringify({
      classCode: state.user.class_code, date: iso(state.date), studentId: id, status: "A"
    })});
  }
  state.sheetOpen = false;
  await loadAttendance();
  render();
}

async function exportCSV() {
  const rows = [["Tanggal", iso(state.date)], ["No", "NISN", "Nama", "Status"]];
  state.students.forEach((s, i) => rows.push([String(i+1), s.nisn, s.name, state.attendance[s.id] || ""]));
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `absensi-${state.user.class_code}-${iso(state.date)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importCSV() {
  const text = document.getElementById("csvArea").value.trim();
  if (!text) return alert("Tempel data CSV dulu.");
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const students = [];
  for (const line of lines) {
    const parts = line.split(",").map(s => s.trim());
    if (!parts[0] || /nisn/i.test(parts[0])) continue;
    students.push({ nisn: parts[0], name: parts[1] || "", number: parts[2] ? Number(parts[2]) : null });
  }
  if (!students.length) return alert("Format CSV belum cocok.");
  await api("/api/students", { method: "POST", body: JSON.stringify({ classCode: state.user.class_code, students }) });
  await loadStudents();
  state.tab = "siswa";
  render();
  alert("Siswa berhasil disimpan.");
}

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMsg");
  try {
    msg.textContent = "Memproses...";
    const d = await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
    localStorage.setItem("token", d.token);
    await boot();
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function logout() {
  try { await api("/api/logout", { method: "POST" }); } catch {}
  localStorage.removeItem("token");
  state.user = null;
  state.students = [];
  state.attendance = {};
  render();
}

async function boot() {
  state.loading = true;
  render();
  try {
    await loadMe();
    if (state.user) {
      await loadClasses();
      await loadStudents();
      await loadAttendance();
      state.date = new Date();
    }
  } catch {
    localStorage.removeItem("token");
    state.user = null;
  } finally {
    state.loading = false;
    render();
  }
}
boot();
