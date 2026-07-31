import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { test } from "node:test"

const repoRoot = resolve(import.meta.dirname, "..")
const backendRequire = createRequire(resolve(repoRoot, "backend/package.json"))
const webRequire = createRequire(resolve(repoRoot, "web/package.json"))
const sentryNextRequire = createRequire(webRequire.resolve("@sentry/nextjs"))
const sentryWebpackRequire = createRequire(
  sentryNextRequire.resolve("@sentry/webpack-plugin"),
)

const { SseStream } = backendRequire("@nestjs/core/router/sse-stream.js")
const webpack = sentryWebpackRequire("webpack")

function transformSse(message) {
  return new Promise((resolveOutput, reject) => {
    const stream = new SseStream()
    const chunks = []
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on("error", reject)
    stream.on("end", () =>
      resolveOutput(Buffer.concat(chunks).toString("utf8")),
    )
    stream.end(message)
  })
}

test("the Nest 10 backport strips SSE field delimiters", async () => {
  const output = await transformSse({
    type: "progress\nevent: forged",
    id: "real\r\nid: forged",
    retry: "1000\n\ndata: forged",
    data: "safe",
  })

  assert.equal(
    output,
    [
      "event: progressevent: forged",
      "id: realid: forged",
      "retry: 1000data: forged",
      "data: safe",
      "",
      "",
    ].join("\n"),
  )
  assert.doesNotMatch(output, /\n(?:event|id|retry): forged/)
  assert.doesNotMatch(output, /\n\ndata: forged/)
})

async function compileRemoteEntry(entry, allowedUris, onGet) {
  const http = await import("node:http")
  const originalGet = http.default.get
  const proxyVariables = [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
  ]
  const originalProxyEnvironment = Object.fromEntries(
    proxyVariables.map((name) => [name, process.env[name]]),
  )
  for (const name of proxyVariables) delete process.env[name]
  http.default.get = onGet

  try {
    const compiler = webpack({
      mode: "production",
      context: repoRoot,
      entry,
      experiments: {
        buildHttp: {
          allowedUris,
          cacheLocation: false,
          frozen: false,
          lockfileLocation: resolve(tmpdir(), "clawchat-webpack-security.lock"),
          upgrade: true,
        },
      },
      output: {
        path: resolve(tmpdir(), "clawchat-webpack-security-output"),
        filename: "bundle.js",
      },
    })

    return await new Promise((resolveResult) => {
      compiler.run((error, stats) => {
        const messages = error
          ? [error.message]
          : (stats?.toJson({ all: false, errors: true }).errors ?? []).map(
              (entryError) =>
                typeof entryError === "string"
                  ? entryError
                  : entryError.message,
            )
        compiler.close(() => resolveResult(messages.join("\n")))
      })
    })
  } finally {
    http.default.get = originalGet
    for (const name of proxyVariables) {
      const value = originalProxyEnvironment[name]
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

test("the webpack backport rejects userinfo before any build-time request", async () => {
  let requests = 0
  const errors = await compileRemoteEntry(
    "http://allowed.example@blocked.example/secret.js",
    ["http://allowed.example/"],
    () => {
      requests += 1
      throw new Error("network must not be reached")
    },
  )

  assert.equal(requests, 0)
  assert.match(errors, /doesn't match the allowedUris policy/)
})

test("the webpack backport re-authorizes redirects before following them", async () => {
  let requests = 0
  const errors = await compileRemoteEntry(
    "http://allowed.example/source.js",
    ["http://allowed.example/"],
    (_url, _options, callback) => {
      requests += 1
      const request = new EventEmitter()
      process.nextTick(() =>
        callback({
          headers: {
            location: "http://blocked.example/internal.js",
          },
          statusCode: 302,
        }),
      )
      return request
    },
  )

  assert.equal(requests, 1, errors)
  assert.match(errors, /redirect does not match the allowedUris policy/)
})
