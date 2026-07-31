import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
type JsonObject = Record<string, unknown>;

export type KashFlowCredentials = {
  username: string;
  apiPassword: string;
};

export class KashFlowSoapError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class KashFlowSoapAdapter {
  private static readonly endpoint =
    "https://securedwebapp.com/api/service.asmx";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: KashFlowCredentials) {
    const result = await this.getVatRegistration(credentials);
    return { reachable: true, vatRegistrationReadable: result.registered };
  }

  async listCurrencies(credentials: KashFlowCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const xml = await this.call(credentials, "GetCurrencies");
    const blocks = [
      ...this.blocks(xml, "Currencies"),
      ...this.blocks(xml, "Currency"),
    ];
    const currencies = blocks
      .map((block) => ({
        code: this.value(block, "Code").toUpperCase(),
        name: this.value(block, "Name"),
        symbol: this.value(block, "Symbol"),
        displaySymbolOnRight:
          this.value(block, "DisplaySymbolOnRight").toLowerCase() === "true",
      }))
      .filter((item) => /^[A-Z]{3}$/.test(item.code))
      .filter(
        (item, index, all) =>
          all.findIndex((candidate) => candidate.code === item.code) === index,
      )
      .slice(0, limit);
    if (!currencies.length)
      throw new KashFlowSoapError(
        "provider_validation_error",
        "KashFlow returned no valid currency summaries.",
      );
    return { currencies, nextPageFollowed: false };
  }

  async getVatRegistration(credentials: KashFlowCredentials) {
    const xml = await this.call(credentials, "isUserVATRegistered");
    const value = this.value(xml, "isUserVATRegisteredResult").toLowerCase();
    if (value !== "true" && value !== "false")
      throw new KashFlowSoapError(
        "provider_validation_error",
        "KashFlow returned an invalid VAT-registration response.",
      );
    return { registered: value === "true" };
  }

  private async call(
    credentials: KashFlowCredentials,
    method: "GetCurrencies" | "isUserVATRegistered",
  ) {
    const validated = this.credentials(credentials);
    const envelope = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:k="KashFlow"><soap:Body><k:${method}><k:UserName>${this.escape(validated.username)}</k:UserName><k:Password>${this.escape(validated.apiPassword)}</k:Password></k:${method}></soap:Body></soap:Envelope>`;
    let response: Response;
    try {
      response = await this.request(KashFlowSoapAdapter.endpoint, {
        method: "POST",
        headers: {
          Accept: "text/xml",
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `"KashFlow/${method}"`,
          "User-Agent": "RelayConsole-KashFlow/1.0",
        },
        body: envelope,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new KashFlowSoapError(
        "provider_unavailable",
        "KashFlow is temporarily unavailable.",
        502,
      );
    }
    const xml = await response.text();
    if (Buffer.byteLength(xml) > 2_000_000)
      throw new KashFlowSoapError(
        "provider_validation_error",
        "KashFlow response exceeded the safe size limit.",
      );
    if (/<!DOCTYPE|<!ENTITY/i.test(xml))
      throw new KashFlowSoapError(
        "provider_validation_error",
        "KashFlow returned unsafe XML.",
      );
    const fault = this.value(xml, "faultstring");
    if (!response.ok || fault)
      throw new KashFlowSoapError(
        response.status === 401 ||
          /auth|password|username|credential/i.test(fault)
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500 && !fault
                ? "provider_unavailable"
                : "provider_validation_error",
        "KashFlow SOAP request failed.",
        response.status || 502,
      );
    return xml;
  }

  private credentials(credentials: KashFlowCredentials) {
    const username = credentials.username.trim();
    const apiPassword = credentials.apiPassword.trim();
    if (
      !username ||
      username.length > 320 ||
      !apiPassword ||
      apiPassword.length > 1024 ||
      /[\r\n\0]/.test(username) ||
      /[\r\n\0]/.test(apiPassword)
    )
      throw new KashFlowSoapError(
        "credential_missing",
        "KashFlow username or separate API password is missing or invalid.",
      );
    return { username, apiPassword };
  }

  private blocks(xml: string, tag: string) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `<(?:[A-Za-z0-9_-]+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${escaped}>`,
      "gi",
    );
    return [...xml.matchAll(pattern)].map((match) => match[1]);
  }

  private value(xml: string, tag: string) {
    const block = this.blocks(xml, tag)[0] ?? "";
    return this.decode(block.replace(/<[^>]*>/g, ""))
      .trim()
      .slice(0, 512);
  }

  private escape(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private decode(value: string) {
    return value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new KashFlowSoapError(
        "provider_validation_error",
        "KashFlow currency limit is outside the supported range.",
      );
    return Number(value);
  }
}
