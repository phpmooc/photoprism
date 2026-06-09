import { describe, it, expect } from "vitest";
import { Roles, Providers, RoleLabel, RoleOptions, ProviderLabel, ProviderOptions } from "options/auth";

describe("options/auth RoleLabel", () => {
  it("resolves mapped roles from the shared Roles map", () => {
    expect(RoleLabel("admin")).toBe(Roles()["admin"]);
    expect(RoleLabel("cluster_admin")).toBe(Roles()["cluster_admin"]);
  });
  it("falls back to the raw key when unmapped", () => {
    expect(RoleLabel("does-not-exist")).toBe("does-not-exist");
  });
});

describe("options/auth RoleOptions", () => {
  it("builds {value, text} options in the given order with shared labels", () => {
    expect(RoleOptions(["admin", "guest"])).toEqual([
      { value: "admin", text: Roles()["admin"] },
      { value: "guest", text: Roles()["guest"] },
    ]);
  });
  it("uses the requested label key (title for Vuetify item-title)", () => {
    const [opt] = RoleOptions(["viewer"], "title");
    expect(opt).toEqual({ value: "viewer", title: Roles()["viewer"] });
  });
});

describe("options/auth ProviderLabel", () => {
  it("resolves mapped providers from the shared Providers map", () => {
    expect(ProviderLabel("oidc")).toBe(Providers()["oidc"]);
    expect(ProviderLabel("ldap")).toBe(Providers()["ldap"]);
  });
  it("falls back to the raw key when unmapped", () => {
    expect(ProviderLabel("does-not-exist")).toBe("does-not-exist");
  });
});

describe("options/auth ProviderOptions", () => {
  it("builds {value, text} options with shared labels", () => {
    expect(ProviderOptions(["local", "oidc"])).toEqual([
      { value: "local", text: Providers()["local"] },
      { value: "oidc", text: Providers()["oidc"] },
    ]);
  });
});

describe("options/auth standardized identifiers stay untranslated", () => {
  it("keeps OIDC and Client Credentials as literal labels", () => {
    expect(Providers()["oidc"]).toBe("OIDC");
    expect(Providers()["client_credentials"]).toBe("Client Credentials");
  });
});
