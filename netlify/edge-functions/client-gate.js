// CLIENT RESOURCES PASSWORD GATE
//
// Everything under /clients/ is only shown to people who type the client password.
// Netlify runs this before serving any file in that folder.
//
// The password is NOT stored in this code (the GitHub repo is public). It lives in
// Netlify: Site configuration → Environment variables → CLIENT_RESOURCES_PASSWORD.
//
// To change the password (e.g. when a client finishes coaching):
//   1. Change CLIENT_RESOURCES_PASSWORD in Netlify.
//   2. Deploys → Trigger deploy → Deploy site.
//   3. Send the new password to your current clients.
// Everyone who logged in with the old password is logged out automatically.

const COOKIE_NAME = "fwj_clients";
const COOKIE_DAYS = 30; // how long a client stays logged in on their device

export default async (request, context) => {
  const password = Netlify.env.get("CLIENT_RESOURCES_PASSWORD");
  const url = new URL(request.url);

  // No password set in Netlify yet: keep everything locked.
  if (!password) {
    return loginPage("Client resources aren't set up yet. Please check back soon.", 503);
  }

  const expected = await sessionToken(password);

  if (url.pathname === "/clients/logout") {
    return new Response(null, {
      status: 303,
      headers: { Location: "/clients/", "Set-Cookie": cookie("", 0) },
    });
  }

  if (request.method === "POST") {
    const form = await request.formData();
    const attempt = String(form.get("password") || "");
    if (await sessionToken(attempt) === expected) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: url.pathname,
          "Set-Cookie": cookie(expected, COOKIE_DAYS * 24 * 60 * 60),
        },
      });
    }
    // Small pause makes guessing passwords slow.
    await new Promise((r) => setTimeout(r, 1000));
    return loginPage("That password didn't work. Please try again.", 401);
  }

  if (context.cookies.get(COOKIE_NAME) === expected) {
    const response = await context.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  return loginPage("", 401);
};

export const config = { path: ["/clients", "/clients/*"] };

// The cookie holds a fingerprint of the password, not the password itself.
// Changing the password changes the fingerprint, which logs everyone out.
async function sessionToken(password) {
  const data = new TextEncoder().encode("fuel-with-jess-clients:" + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cookie(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/clients; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function loginPage(message, status) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Client Login | Fuel with Jess</title>
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Allura&family=Lora:ital,wght@0,400;0,600;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/styles.css" />
</head>
<body>
<main class="client-login">
  <form class="client-login-card" method="POST">
    <a href="/index.html"><img src="/images/Fuel-Logo-Full-Color.png" alt="Fuel with Jess logo, go to home page" class="client-login-logo" /></a>
    <h1>Client <em>Resources</em></h1>
    <p>Enter the client password Jess sent you to see your guides.</p>
    ${message ? `<p class="client-login-error" role="alert">${message}</p>` : ""}
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autocomplete="current-password" required autofocus />
    <button type="submit" class="btn-primary">View Resources</button>
    <p class="client-login-help">Don't have the password? <a href="mailto:fuelwithjess@gmail.com">Email Jess</a></p>
  </form>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
