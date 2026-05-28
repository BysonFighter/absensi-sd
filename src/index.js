export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // TEST DATABASE
    if (url.pathname === "/api/test") {
      const result = await env.DB.prepare(
        "SELECT COUNT(*) as total FROM users"
      ).first();

      return Response.json(result);
    }

    // LOGIN
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

        const hashPassword = await sha256(password);

        if (hashPassword !== user.password_hash) {
          return Response.json({
            success: false,
            message: "Password salah",
          });
        }

        return Response.json({
          success: true,
          user,
        });

      } catch (e) {
        return Response.json({
          success: false,
          message: e.toString(),
        });
      }
    }

    // HALAMAN LOGIN
    return new Response(`
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Login Absensi</title>
<style>
body{
font-family:Arial;
background:#f5f5f5;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
}
.box{
background:white;
padding:30px;
border-radius:10px;
width:300px;
box-shadow:0 0 10px rgba(0,0,0,0.1);
}
input{
width:100%;
padding:10px;
margin-top:10px;
}
button{
width:100%;
padding:10px;
margin-top:10px;
background:blue;
color:white;
border:none;
}
#error{
color:red;
margin-top:10px;
}
</style>
</head>
<body>

<div class="box">
<h2>Login</h2>

<input id="username" placeholder="Username">
<input id="password" type="password" placeholder="Password">

<button onclick="login()">Masuk</button>

<div id="error"></div>
</div>

<script>
async function login(){

const username = document.getElementById("username").value;
const password = document.getElementById("password").value;

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

if(data.success){
alert("Login berhasil");
document.body.innerHTML = "<h1>Selamat datang "+data.user.username+"</h1>";
}else{
document.getElementById("error").innerText = data.message;
}
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

// SHA256
async function sha256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
