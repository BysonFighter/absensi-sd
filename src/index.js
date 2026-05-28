export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // LOGIN
    // =========================
    if (url.pathname === "/api/login" && request.method === "POST") {
      try {
        const body = await request.json();

        const username = body.username;
        const password = body.password;

        const user = await env.DB.prepare(
          "SELECT * FROM users WHERE username = ?"
        )
          .bind(username)
          .first();

        if (!user) {
          return Response.json({
            success: false,
            message: "User tidak ditemukan",
          });
        }

        // password default: 123456
        if (password !== "123456") {
          return Response.json({
            success: false,
            message: "Password salah",
          });
        }

        return Response.json({
          success: true,
          user: {
            username: user.username,
            class_code: user.class_code,
          },
        });
      } catch (e) {
        return Response.json({
          success: false,
          message: e.toString(),
        });
      }
    }

    // =========================
    // GET STUDENTS
    // =========================
    if (url.pathname === "/api/students") {
      try {
        const classCode = url.searchParams.get("class");

        const students = await env.DB.prepare(
          "SELECT * FROM students WHERE class_code = ? ORDER BY number ASC"
        )
          .bind(classCode)
          .all();

        return Response.json({
          success: true,
          students: students.results,
        });
      } catch (e) {
        return Response.json({
          success: false,
          message: e.toString(),
        });
      }
    }

    // =========================
    // SAVE ATTENDANCE
    // =========================
    if (url.pathname === "/api/attendance" && request.method === "POST") {
      try {
        const body = await request.json();

        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            date TEXT,
            status TEXT
          )
        `).run();

        await env.DB.prepare(
          `
          INSERT INTO attendance (student_id, date, status)
          VALUES (?, ?, ?)
        `
        )
          .bind(body.student_id, body.date, body.status)
          .run();

        return Response.json({
          success: true,
        });
      } catch (e) {
        return Response.json({
          success: false,
          message: e.toString(),
        });
      }
    }

    // =========================
    // FRONTEND
    // =========================
    return new Response(`
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<title>Absensi SD</title>

<style>
body{
  margin:0;
  font-family:Arial;
  background:#eef2f7;
}

.container{
  max-width:900px;
  margin:auto;
  padding:20px;
}

.card{
  background:white;
  border-radius:20px;
  padding:20px;
  margin-bottom:20px;
  box-shadow:0 2px 10px rgba(0,0,0,0.08);
}

input{
  width:100%;
  padding:14px;
  border-radius:12px;
  border:1px solid #ccc;
  margin-bottom:12px;
  box-sizing:border-box;
}

button{
  border:none;
  border-radius:12px;
  padding:14px;
  font-size:16px;
  font-weight:bold;
  cursor:pointer;
}

.btn-login{
  background:#2563eb;
  color:white;
  width:100%;
}

.student{
  background:#f8fafc;
  border-radius:16px;
  padding:16px;
  margin-bottom:16px;
}

.student-name{
  font-size:20px;
  font-weight:bold;
}

.row{
  display:flex;
  gap:10px;
}

.row button{
  flex:1;
  color:white;
}

.hadir{background:#16a34a;}
.sakit{background:#d97706;}
.izin{background:#2563eb;}
.alpha{background:#dc2626;}

.topbar{
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.date-slider{
  display:flex;
  align-items:center;
  gap:10px;
  margin:20px 0;
}

.date-box{
  flex:1;
  background:white;
  padding:14px;
  border-radius:14px;
  text-align:center;
  font-weight:bold;
}

.bottom-menu{
  position:fixed;
  bottom:0;
  left:0;
  right:0;
  background:white;
  padding:10px;
  display:flex;
  justify-content:space-around;
  box-shadow:0 -2px 10px rgba(0,0,0,0.1);
}

.bottom-menu button{
  background:#e5e7eb;
}

.hidden{
  display:none;
}
</style>
</head>

<body>

<div class="container">

  <!-- LOGIN -->
  <div id="loginPage" class="card">
    <h1>Absensi SD</h1>

    <input id="username" placeholder="Username">
    <input id="password" type="password" placeholder="Password">

    <button class="btn-login" onclick="login()">Masuk</button>

    <p id="loginError" style="color:red"></p>
  </div>

  <!-- APP -->
  <div id="appPage" class="hidden">

    <div class="card">

      <div class="topbar">
        <div>
          <h1>Absensi SD</h1>
          <div id="kelasInfo"></div>
        </div>

        <button onclick="logout()">Keluar</button>
      </div>

      <div class="date-slider">
        <button onclick="prevDate()">◀</button>

        <div class="date-box" id="dateText"></div>

        <button onclick="nextDate()">▶</button>
      </div>

    </div>

    <div id="studentList"></div>

  </div>

</div>

<div class="bottom-menu hidden" id="bottomMenu">
  <button>Beranda</button>
  <button>Rekap</button>
  <button>Pengaturan</button>
</div>

<script>

let currentDate = new Date();
let currentClass = "";

function formatDate(date){
  return date.toLocaleDateString("id-ID",{
    weekday:"long",
    day:"numeric",
    month:"long",
    year:"numeric"
  });
}

function updateDate(){
  document.getElementById("dateText").innerText =
    formatDate(currentDate);
}

function prevDate(){
  currentDate.setDate(currentDate.getDate()-1);
  updateDate();
}

function nextDate(){
  currentDate.setDate(currentDate.getDate()+1);
  updateDate();
}

async function login(){

  const username =
    document.getElementById("username").value;

  const password =
    document.getElementById("password").value;

  const res = await fetch("/api/login",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      username,
      password
    })
  });

  const data = await res.json();

  if(!data.success){
    document.getElementById("loginError").innerText =
      data.message;
    return;
  }

  currentClass = data.user.class_code;

  document.getElementById("loginPage")
    .classList.add("hidden");

  document.getElementById("appPage")
    .classList.remove("hidden");

  document.getElementById("bottomMenu")
    .classList.remove("hidden");

  document.getElementById("kelasInfo")
    .innerText = "Kelas " + currentClass;

  updateDate();

  loadStudents();
}

async function loadStudents(){

  const res = await fetch(
    "/api/students?class=" + currentClass
  );

  const data = await res.json();

  let html = "";

  data.students.forEach(student=>{

    html += \`
      <div class="card student">

        <div>
          No \${student.number}
        </div>

        <div style="color:#666">
          NISN \${student.nisn}
        </div>

        <div class="student-name">
          \${student.name}
        </div>

        <br>

        <div class="row">
          <button class="hadir"
            onclick="saveAttendance(\${student.id},'Hadir')">
            Hadir
          </button>

          <button class="sakit"
            onclick="saveAttendance(\${student.id},'Sakit')">
            Sakit
          </button>

          <button class="izin"
            onclick="saveAttendance(\${student.id},'Izin')">
            Izin
          </button>

          <button class="alpha"
            onclick="saveAttendance(\${student.id},'Alpha')">
            Alpha
          </button>
        </div>

      </div>
    \`;
  });

  document.getElementById("studentList").innerHTML =
    html;
}

async function saveAttendance(studentId,status){

  const date =
    currentDate.toISOString().split("T")[0];

  await fetch("/api/attendance",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      student_id:studentId,
      status,
      date
    })
  });

  alert("Absensi tersimpan");
}

function logout(){
  location.reload();
}

</script>

</body>
</html>
`, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  },
};
