import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const rootDir = resolve(__dirname, "..");
const env = {
  ...loadEnv(resolve(rootDir, ".env")),
  ...loadEnv(resolve(rootDir, ".env.local")),
};

const port = Number(process.env.ADMIN_DASHBOARD_PORT || env.ADMIN_DASHBOARD_PORT || 8090);
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  if (url.pathname === "/config.js") {
    sendText(
      response,
      `window.ADMIN_CONFIG = ${JSON.stringify({
        supabaseUrl,
        supabaseKey,
      })};`,
      "application/javascript; charset=utf-8",
    );
    return;
  }

  if (url.pathname === "/vendor/supabase.js") {
    streamFile(response, resolve(rootDir, "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js"));
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = resolve(__dirname, `.${requestedPath}`);

  if (!filePath.startsWith(__dirname)) {
    sendText(response, "Forbidden", "text/plain; charset=utf-8", 403);
    return;
  }

  streamFile(response, filePath);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AquaSense admin dashboard is running at http://127.0.0.1:${port}`);
});

function loadEnv(path) {
  if (!existsSync(path)) return {};

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) return acc;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
}

function streamFile(response, filePath) {
  if (!existsSync(filePath)) {
    sendText(response, "Not found", "text/plain; charset=utf-8", 404);
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
}

function sendText(response, text, contentType, status = 200) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(text);
}
