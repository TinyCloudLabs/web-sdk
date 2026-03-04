import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isInteractive } from "../output/formatter.js";
import { createInterface } from "node:readline";

const OPENKEY_BASE = "https://openkey.so";

interface DelegationData {
  delegationHeader: { Authorization: string };
  delegationCid: string;
  spaceId: string;
  [key: string]: unknown;
}

/**
 * Start the browser auth flow.
 * Mode 1 (default): local HTTP callback server
 * Mode 2 (--paste): manual code paste
 */
export async function startAuthFlow(
  did: string,
  options: { paste?: boolean; jwk?: object; host?: string } = {}
): Promise<DelegationData> {
  if (options.paste) {
    return pasteFlow(did, options);
  }

  try {
    return await callbackFlow(did, options);
  } catch {
    // Fallback to paste if browser can't open
    if (isInteractive()) {
      console.error("Could not open browser. Falling back to manual paste mode.");
      return pasteFlow(did, options);
    }
    throw new Error("Cannot open browser in non-interactive mode. Use --paste flag.");
  }
}

function buildAuthUrl(did: string, options: { jwk?: object; host?: string; callback?: string } = {}): string {
  const params = new URLSearchParams();
  params.set("did", did);
  if (options.callback) {
    params.set("callback", options.callback);
  }
  if (options.jwk) {
    // base64url-encode the JWK
    const jwkB64 = Buffer.from(JSON.stringify(options.jwk)).toString("base64url");
    params.set("jwk", jwkB64);
  }
  if (options.host) {
    params.set("host", options.host);
  }
  return `${OPENKEY_BASE}/delegate?${params.toString()}`;
}

async function callbackFlow(did: string, options: { jwk?: object; host?: string } = {}): Promise<DelegationData> {
  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.method === "POST" && req.url === "/callback") {
        let body = "";
        req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        req.on("end", () => {
          try {
            const data = JSON.parse(body) as DelegationData;
            // Send CORS headers and success response
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify({ success: true }));
            clearTimeout(timeout);
            server.close();
            resolve(data);
          } catch (err) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
            reject(new Error("Invalid delegation data received"));
          }
        });
      } else if (req.method === "OPTIONS") {
        // CORS preflight
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, "127.0.0.1", async () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to start callback server"));
        return;
      }
      const port = addr.port;
      const callbackUrl = `http://127.0.0.1:${port}/callback`;
      const authUrl = buildAuthUrl(did, { ...options, callback: callbackUrl });

      if (isInteractive()) {
        console.error(`Opening browser for authentication...`);
        console.error(`If the browser doesn't open, visit: ${authUrl}`);
      }

      try {
        const open = (await import("open")).default;
        await open(authUrl);
      } catch {
        server.close();
        throw new Error("Failed to open browser");
      }
    });

    // Timeout after 5 minutes
    timeout = setTimeout(() => {
      server.close();
      reject(new Error("Authentication timed out after 5 minutes"));
    }, 5 * 60 * 1000);
  });
}

async function pasteFlow(did: string, options: { jwk?: object; host?: string } = {}): Promise<DelegationData> {
  const authUrl = buildAuthUrl(did, options);

  console.error(`\nOpen this URL in a browser to authenticate:\n`);
  console.error(`  ${authUrl}\n`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve, reject) => {
    rl.question("Paste delegation code: ", (input) => {
      rl.close();
      try {
        // Try parsing as JSON directly
        const data = JSON.parse(input.trim()) as DelegationData;
        resolve(data);
      } catch {
        // Try base64 decoding first
        try {
          const decoded = Buffer.from(input.trim(), "base64").toString("utf-8");
          const data = JSON.parse(decoded) as DelegationData;
          resolve(data);
        } catch {
          reject(new Error("Invalid delegation code. Expected JSON or base64-encoded JSON."));
        }
      }
    });
  });
}
