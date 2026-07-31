import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = "com.clawchat.claude-runtime.device";

type CredentialCommand = (
  file: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

export class DeviceCredentialStore {
  constructor(
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly run: CredentialCommand = async (file, args) =>
      execFileAsync(file, args, {
        encoding: "utf8",
        maxBuffer: 64 * 1024,
        timeout: 10_000,
      }),
  ) {}

  async save(devicePublicId: string, deviceToken: string): Promise<void> {
    assertCredentialPart(devicePublicId, "devicePublicId");
    assertCredentialPart(deviceToken, "deviceToken");
    this.assertSupported();
    await this.run("/usr/bin/security", [
      "add-generic-password",
      "-U",
      "-s",
      KEYCHAIN_SERVICE,
      "-a",
      devicePublicId,
      "-w",
      deviceToken,
    ]);
  }

  async read(devicePublicId: string): Promise<string> {
    assertCredentialPart(devicePublicId, "devicePublicId");
    this.assertSupported();
    const result = await this.run("/usr/bin/security", [
      "find-generic-password",
      "-s",
      KEYCHAIN_SERVICE,
      "-a",
      devicePublicId,
      "-w",
    ]);
    const token = result.stdout.trim();
    assertCredentialPart(token, "stored deviceToken");
    return token;
  }

  private assertSupported() {
    if (this.platform !== "darwin") {
      throw new Error(
        "Claude runtime device credentials require the macOS Keychain",
      );
    }
  }
}

function assertCredentialPart(value: string, label: string) {
  if (!value || value.length > 4096 || /[\0\r\n]/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
}
