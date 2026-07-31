const test = require("node:test");
const assert = require("node:assert/strict");

const { RailwayClient } = require("../dist/railway-client.js");

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authenticationResponse(deviceToken = "rotated-device-token") {
  return {
    device: { id: "device-1", workspaceId: "workspace-1", label: "Runtime" },
    credentials: {
      devicePublicId: "bdev_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      deviceToken,
    },
    tokens: {
      accessToken: "short-lived-access-token",
      wsToken: "short-lived-websocket-token",
      accessExpiresIn: 900,
      wsExpiresIn: 300,
    },
  };
}

test("device authentication single-flights rotation, persists the replacement, and separates token families", async () => {
  const originalFetch = global.fetch;
  const requests = [];
  const persisted = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(authenticationResponse());
  };

  try {
    const client = new RailwayClient(
      "https://runtime-production.up.railway.app/api/v1",
      "workspace-1",
      {
        devicePublicId: "bdev_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        deviceToken: "initial-device-token",
      },
      async (devicePublicId, deviceToken) => {
        persisted.push({ devicePublicId, deviceToken });
      },
    );

    const [accessToken, websocketToken] = await Promise.all([
      client.ensureAccessToken(),
      client.ensureWebSocketToken(),
    ]);

    assert.equal(requests.length, 1);
    assert.equal(accessToken, "short-lived-access-token");
    assert.equal(websocketToken, "short-lived-websocket-token");
    assert.deepEqual(persisted, [
      {
        devicePublicId: "bdev_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        deviceToken: "rotated-device-token",
      },
    ]);
    const sent = JSON.parse(requests[0].options.body);
    assert.equal(sent.deviceToken, "initial-device-token");
    assert.deepEqual(
      {
        runtimeType: sent.runtimeType,
        hostType: sent.hostType,
        pluginVersion: sent.pluginVersion,
        openCoreVersion: sent.openCoreVersion,
        apiContractVersion: sent.apiContractVersion,
        websocketContractVersion: sent.websocketContractVersion,
      },
      {
        runtimeType: "claude_code",
        hostType: "macos-launchd",
        pluginVersion: "1.0.0",
        openCoreVersion: "1.0.0",
        apiContractVersion: "v2",
        websocketContractVersion: "bridge.v1",
      },
    );
    assert.equal(
      JSON.stringify(requests).includes("rotated-device-token"),
      false,
      "the replacement credential must never be sent before the next refresh",
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("a transient durable-store failure retries persistence without replaying the consumed credential", async () => {
  const originalFetch = global.fetch;
  let fetchCount = 0;
  let persistenceAttempts = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return jsonResponse(authenticationResponse("replacement-after-failure"));
  };

  try {
    const client = new RailwayClient(
      "https://runtime-production.up.railway.app/api/v1",
      "workspace-1",
      {
        devicePublicId: "bdev_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        deviceToken: "initial-device-token",
      },
      async () => {
        persistenceAttempts += 1;
        if (persistenceAttempts === 1) {
          throw new Error("keychain temporarily unavailable");
        }
      },
    );

    await assert.rejects(
      client.authenticateDevice(),
      /keychain temporarily unavailable/,
    );
    await client.authenticateDevice();

    assert.equal(fetchCount, 1);
    assert.equal(persistenceAttempts, 2);
    assert.equal(await client.ensureAccessToken(), "short-lived-access-token");
  } finally {
    global.fetch = originalFetch;
  }
});

test("rotation is refused before network use when no durable credential store is configured", async () => {
  const originalFetch = global.fetch;
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return jsonResponse(authenticationResponse());
  };

  try {
    const client = new RailwayClient(
      "https://runtime-production.up.railway.app/api/v1",
      "workspace-1",
      {
        devicePublicId: "bdev_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        deviceToken: "initial-device-token",
      },
    );
    await assert.rejects(
      client.authenticateDevice(),
      /durable device credential persistence callback/,
    );
    assert.equal(fetchCount, 0);
  } finally {
    global.fetch = originalFetch;
  }
});
