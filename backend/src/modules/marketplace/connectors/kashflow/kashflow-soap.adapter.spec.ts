import { KashFlowSoapAdapter } from "./kashflow-soap.adapter";

const credentials = {
  username: "relay-api-user",
  apiPassword: "fixture-separate-api-password",
};
const soap = (body: string, status = 200) =>
  new Response(
    `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${body}</soap:Body></soap:Envelope>`,
    { status, headers: { "Content-Type": "text/xml" } },
  );

describe("KashFlowSoapAdapter", () => {
  it("pins the endpoint, actions, escaped credentials, fields, and bounds", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses = [
      soap(
        `<GetCurrenciesResponse xmlns="KashFlow"><GetCurrenciesResult><Currencies><Code>GBP</Code><Name>British Pounds</Name><Symbol>£</Symbol><ExchangeRate>1.0</ExchangeRate><DisplaySymbolOnRight>false</DisplaySymbolOnRight></Currencies><Currencies><Code>EUR</Code><Name>Euros</Name><Symbol>€</Symbol><ExchangeRate>1.2</ExchangeRate><DisplaySymbolOnRight>true</DisplaySymbolOnRight></Currencies></GetCurrenciesResult></GetCurrenciesResponse>`,
      ),
      soap(
        `<isUserVATRegisteredResponse xmlns="KashFlow"><isUserVATRegisteredResult>true</isUserVATRegisteredResult></isUserVATRegisteredResponse>`,
      ),
    ];
    const adapter = new KashFlowSoapAdapter(async (url, init) => {
      calls.push({ url, init });
      return responses.shift()!;
    });
    const currencies = await adapter.listCurrencies(
      { ...credentials, username: "relay&api" },
      { limit: 1 },
    );
    const vat = await adapter.getVatRegistration(credentials);
    expect(calls.map((call) => call.url)).toEqual([
      "https://securedwebapp.com/api/service.asmx",
      "https://securedwebapp.com/api/service.asmx",
    ]);
    expect(
      calls.map(
        (call) => (call.init.headers as Record<string, string>).SOAPAction,
      ),
    ).toEqual(['"KashFlow/GetCurrencies"', '"KashFlow/isUserVATRegistered"']);
    expect(String(calls[0].init.body)).toContain("relay&amp;api");
    expect(currencies.currencies).toEqual([
      {
        code: "GBP",
        name: "British Pounds",
        symbol: "£",
        displaySymbolOnRight: false,
      },
    ]);
    expect(currencies.currencies[0]).not.toHaveProperty("exchangeRate");
    expect(currencies.nextPageFollowed).toBe(false);
    expect(vat).toEqual({ registered: true });
  });

  it("rejects invalid credentials and limits before network access", async () => {
    const request = jest.fn();
    const adapter = new KashFlowSoapAdapter(request);
    await expect(
      adapter.getVatRegistration({ ...credentials, apiPassword: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.listCurrencies(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on unsafe XML and redacts provider faults", async () => {
    const unsafe = new KashFlowSoapAdapter(
      async () =>
        new Response(
          "<!DOCTYPE x [<!ENTITY y SYSTEM 'file:///etc/passwd'>]><x>&y;</x>",
        ),
    );
    await expect(unsafe.getVatRegistration(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
    const denied = new KashFlowSoapAdapter(async () =>
      soap(
        `<soap:Fault><faultcode>soap:Client</faultcode><faultstring>invalid password ${credentials.apiPassword}</faultstring></soap:Fault>`,
        500,
      ),
    );
    await expect(denied.getVatRegistration(credentials)).rejects.toMatchObject({
      code: "credential_missing",
      message: "KashFlow SOAP request failed.",
    });
  });
});
