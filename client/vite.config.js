import { Buffer } from "node:buffer";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function createApiResponse(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    json(payload) {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json");
      }
      res.end(JSON.stringify(payload));
    },
    send(payload) {
      res.end(payload);
    }
  };
}

function localApiPlugin() {
  return {
    name: "tripable-local-api",
    configureServer(server) {
      server.middlewares.use("/api/delete-account", async (req, res) => {
        try {
          const body = await readRequestBody(req);
          const routePath = path.join(__dirname, "api", "delete-account.js");
          const routeUrl = `${pathToFileURL(routePath).href}?t=${Date.now()}`;
          const { default: handler } = await import(routeUrl);
          await handler({
            method: req.method,
            headers: req.headers,
            body
          }, createApiResponse(res));
        } catch (error) {
          server.config.logger.error(error);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              error: "Local API route failed.",
              details: error?.message || "unknown_error"
            }));
          }
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.entries(env).forEach(([key, value]) => {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });

  return {
    plugins: [react(), localApiPlugin()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      watch: {
        usePolling: true
      },
      proxy: {
        "/api": "http://localhost:3001"
      }
    }
  };
});
