// Sign-in helper for the site editor (Decap CMS) on Cloudflare Workers.
//
// GitHub sign-in needs a secret that can't live in a public website, so this tiny
// worker holds it. It sends the editor to GitHub, swaps the code GitHub returns
// for a token, and hands that token back to the editor window. It stores nothing.
//
//   /auth      starts sign-in (the editor opens it in a popup)
//   /callback  where GitHub sends people back
//
// Settings: GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (secrets) and
// ALLOWED_ORIGIN (in wrangler.toml), the only site allowed to receive the token.

const GITHUB = "https://github.com/login/oauth";
const SCOPES = ["public_repo", "repo"];
const STATE_COOKIE = "lssq_cms_state";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/auth") return start(url, env);
    if (url.pathname === "/callback") return finish(request, url, env);
    return new Response("Sign-in helper for the LSSQ site editor.", { status: 404 });
  },
};

function start(url, env) {
  if (url.searchParams.get("provider") && url.searchParams.get("provider") !== "github") {
    return new Response("Only GitHub sign-in is supported.", { status: 400 });
  }
  const asked = url.searchParams.get("scope");
  const scope = SCOPES.includes(asked) ? asked : "public_repo";
  const state = crypto.randomUUID();

  const github = new URL(`${GITHUB}/authorize`);
  github.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  github.searchParams.set("redirect_uri", new URL("/callback", url).href);
  github.searchParams.set("scope", scope);
  github.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: github.href,
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}

async function finish(request, url, env) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = request.headers.get("Cookie") || "";
  const saved = cookies.split(/;\s*/).find((c) => c.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1);

  if (!code || !state || !saved || saved !== state) {
    return reply(env, "error", { message: "That sign-in expired. Close this window and try again." });
  }

  let data = {};
  try {
    const res = await fetch(`${GITHUB}/access_token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "lssq-cms-auth" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: new URL("/callback", url).href,
      }),
    });
    data = await res.json();
  } catch {
    return reply(env, "error", { message: "Couldn't reach GitHub. Try again in a minute." });
  }

  if (!data.access_token) {
    return reply(env, "error", { message: data.error_description || "GitHub didn't sign you in. Try again." });
  }
  return reply(env, "success", { token: data.access_token, provider: "github" });
}

// The page GitHub lands on. It does Decap's handshake with the editor window:
// say "authorizing", wait for the editor to answer from the allowed site, then send
// the result to that site only.
function reply(env, status, content) {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  // Escape "<" so nothing in the message can close the script tag.
  const js = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signing in</title>
<body style="font: 16px system-ui, sans-serif; padding: 24px; background: #141818; color: #FFF6E8">
<p>${status === "success" ? "Signed in. This window will close on its own." : "Sign-in didn't work. Close this window and try again."}</p>
<script>
(function () {
  var origin = ${js(env.ALLOWED_ORIGIN)};
  var message = ${js(message)};
  if (!window.opener) return;
  function answer(e) {
    if (e.origin !== origin) return;
    window.removeEventListener("message", answer);
    window.opener.postMessage(message, origin);
    setTimeout(function () { window.close(); }, 300);
  }
  window.addEventListener("message", answer);
  window.opener.postMessage("authorizing:github", origin);
})();
</script>
</body>
</html>`;
  return new Response(html, {
    status: status === "success" ? 200 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}
