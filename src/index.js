export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API LOGIN
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

        // Password default: 123456
        const defaultHash =
          "8d969eef6ecad3c29a3a629280e686cff8ca12020c923adc6c92f6fbbf621";

        if (user.password_hash !== defaultHash) {
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

    // API TEST
    if (url.pathname === "/api/test") {
      const result = await env.DB.prepare(
        "SELECT COUNT(*) as total FROM users"
      ).first();

      return Response.json(result);
    }

    // FILE STATIC
    return env.ASSETS.fetch(request);
  },
};
