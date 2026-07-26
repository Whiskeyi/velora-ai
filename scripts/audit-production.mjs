import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { request as requestHttps } from "node:https";
import {
  brotliDecompressSync,
  gunzipSync,
  inflateSync,
} from "node:zlib";

const MAX_ATTEMPTS = 3;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const NPM_REGISTRY = new URL("https://registry.npmjs.org");
const RETRYABLE_FAILURE =
  /audit endpoint returned an error|invalid json response body|EAI_AGAIN|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket hang up|\b(?:429|502|503|504)\b/i;

function decodeRegistryResponse(buffer, contentEncoding) {
  const encoding = contentEncoding?.toLowerCase();
  if (encoding === "br") return brotliDecompressSync(buffer);
  if (encoding === "deflate") return inflateSync(buffer);
  if (
    encoding === "gzip" ||
    (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b)
  ) {
    return gunzipSync(buffer);
  }
  return buffer;
}

function isAuditPath(pathname) {
  return pathname.startsWith("/-/npm/v1/security/");
}

function createAuditProxy() {
  const server = createServer((request, response) => {
    const target = new URL(request.url ?? "/", NPM_REGISTRY);
    if (request.method !== "POST" || !isAuditPath(target.pathname)) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end('{"error":"Unsupported audit proxy request"}');
      return;
    }

    const headers = {
      ...request.headers,
      "accept-encoding": "identity",
      connection: "close",
      host: NPM_REGISTRY.host,
    };
    const upstream = requestHttps(
      {
        hostname: NPM_REGISTRY.hostname,
        method: request.method,
        path: `${target.pathname}${target.search}`,
        headers,
      },
      (upstreamResponse) => {
        const chunks = [];
        let size = 0;
        upstreamResponse.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_OUTPUT_BYTES) {
            upstreamResponse.destroy(
              new Error("Audit registry response exceeded 10 MB"),
            );
            return;
          }
          chunks.push(chunk);
        });
        upstreamResponse.on("end", () => {
          try {
            const body = decodeRegistryResponse(
              Buffer.concat(chunks),
              upstreamResponse.headers["content-encoding"],
            );
            response.writeHead(upstreamResponse.statusCode ?? 502, {
              "content-length": body.length,
              "content-type":
                upstreamResponse.headers["content-type"] ??
                "application/json",
            });
            response.end(body);
          } catch (error) {
            response.writeHead(502, { "content-type": "application/json" });
            response.end(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : "Unable to decode audit response",
              }),
            );
          }
        });
      },
    );
    upstream.on("error", (error) => {
      if (!response.headersSent) {
        response.writeHead(502, { "content-type": "application/json" });
      }
      response.end(JSON.stringify({ error: error.message }));
    });
    request.pipe(upstream);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to resolve local audit proxy address"));
        return;
      }
      resolve({
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) =>
              error ? closeReject(error) : closeResolve(),
            );
          }),
        registry: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function runAudit(registry) {
  return new Promise((resolve) => {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(
      npmCommand,
      [
        "audit",
        "--omit=dev",
        "--audit-level=high",
        `--registry=${registry}`,
        "--json",
      ],
      {
        env: {
          ...process.env,
          npm_config_fetch_retries: "3",
          npm_config_fetch_retry_maxtimeout: "20000",
          npm_config_fetch_retry_mintimeout: "1000",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let overflowError;

    const append = (target, chunk) => {
      const next = target + chunk;
      if (Buffer.byteLength(next) > MAX_OUTPUT_BYTES) {
        overflowError = new Error("npm audit output exceeded 10 MB");
        child.kill();
      }
      return next;
    };

    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    child.once("error", (error) => {
      resolve({ error, status: null, stderr, stdout });
    });
    child.once("close", (status) => {
      resolve({
        error: overflowError,
        status,
        stderr,
        stdout,
      });
    });
  });
}

function parseAuditReport(output) {
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function countBlockingVulnerabilities(report) {
  const vulnerabilities = report?.metadata?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== "object") return null;
  return Number(vulnerabilities.high ?? 0) + Number(vulnerabilities.critical ?? 0);
}

const auditProxy = await createAuditProxy();
let finalExitCode = 1;

try {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await runAudit(auditProxy.registry);
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    const report = parseAuditReport(stdout);
    const blockingCount = countBlockingVulnerabilities(report);

    if (blockingCount !== null) {
      process.stdout.write(stdout);
      process.stderr.write(stderr);
      if (blockingCount > 0) {
        process.stderr.write(
          `Production audit found ${blockingCount} high or critical vulnerabilit${
            blockingCount === 1 ? "y" : "ies"
          }.\n`,
        );
        finalExitCode = 1;
      } else {
        finalExitCode = 0;
      }
      break;
    }

    const failure = `${stderr}\n${stdout}\n${result.error?.message ?? ""}`;
    const canRetry =
      attempt < MAX_ATTEMPTS && RETRYABLE_FAILURE.test(failure);
    if (!canRetry) {
      process.stdout.write(stdout);
      process.stderr.write(stderr);
      if (result.error) process.stderr.write(`${result.error.message}\n`);
      finalExitCode = result.status && result.status > 0 ? result.status : 1;
      break;
    }

    const delayMs = 1_000 * 2 ** (attempt - 1);
    process.stderr.write(
      `Production audit service failed on attempt ${attempt}; retrying in ${
        delayMs / 1_000
      }s.\n`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
} finally {
  await auditProxy.close();
}

process.exitCode = finalExitCode;
