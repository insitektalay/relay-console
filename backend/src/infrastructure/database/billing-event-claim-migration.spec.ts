import { readFileSync } from "fs";
import { join } from "path";

describe("billing event claim migration", () => {
  const source = readFileSync(
    join(__dirname, "../../migrations/071_add_billing_event_claim_lease.ts"),
    "utf8",
  );

  it("adds bounded Stripe and Apple processing claims and a stale-lease index", () => {
    expect(source).toContain('"claimToken" uuid');
    expect(source).toContain('"claimExpiresAt" timestamptz');
    expect(source).toContain('"attemptCount" integer NOT NULL DEFAULT 0');
    expect(source).toContain("CHK_billing_processing_claim");
    expect(source).toContain("provider IN ('stripe', 'apple')");
    expect(source).toContain("IDX_relay_billing_event_stale_claim");
    expect(source).toContain("INTERVAL '10 minutes'");
  });

  it("has an explicit reverse migration", () => {
    expect(source).toContain("AddBillingEventClaimLease1785186000071");
    expect(source).toContain(
      'DROP INDEX IF EXISTS "IDX_relay_billing_event_stale_claim"',
    );
    expect(source).toContain('DROP COLUMN IF EXISTS "claimToken"');
  });
});
