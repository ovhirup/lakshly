// QA B9: google.accounts.id.initialize() ran on every button mount. It must run once per client id.
import { describe, expect, it, vi } from "vitest";
import { initGsiOnce, resetGsiForTests } from "../components/GoogleConnect";
import { GOOGLE_CLIENT_ID } from "../lib/edition";
import { GOOGLE_CLIENT_ID_DEFAULT } from "../lib/gmail";

function fakeGis() {
  const initialize = vi.fn();
  return { initialize, gis: { accounts: { id: { initialize, renderButton: vi.fn(), disableAutoSelect: vi.fn() }, oauth2: { initTokenClient: vi.fn(), hasGrantedAllScopes: vi.fn(), revoke: vi.fn() } } } };
}

describe("Google sign-in init", () => {
  it("initialises once, however many buttons mount", () => {
    resetGsiForTests();
    const { gis, initialize } = fakeGis();
    expect(initGsiOnce(gis, "cid")).toBe(true);
    expect(initGsiOnce(gis, "cid")).toBe(false);
    expect(initGsiOnce(gis, "cid")).toBe(false);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize.mock.calls[0][0]).toMatchObject({ client_id: "cid", ux_mode: "popup", use_fedcm_for_button: false });
  });
  it("a cancelled popup (no credential) is ignored quietly", () => {
    resetGsiForTests();
    const { gis, initialize } = fakeGis();
    initGsiOnce(gis, "cid");
    const cb = initialize.mock.calls[0][0].callback as (r: { credential?: string }) => void;
    expect(() => cb({})).not.toThrow();
  });
  it("client id: env when set, else the owner's id (one source)", () => {
    expect(GOOGLE_CLIENT_ID).toBe(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID_DEFAULT);
    expect(GOOGLE_CLIENT_ID).toMatch(/^285824172297-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  });
});
