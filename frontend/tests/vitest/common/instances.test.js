import { describe, expect, it } from "vitest";
import { DirectoryKey, instanceIdentity, readDirectory, recordInstance, recordInstanceFromConfig, signedInInstances } from "common/instances";

// FakeStorage mirrors the subset of the Web Storage API that common/storage and
// common/instances rely on (length/key/getItem/setItem/removeItem), with
// insertion-ordered keys so listAuthSessions can enumerate namespaces.
class FakeStorage {
  constructor() {
    this.map = new Map();
  }
  get length() {
    return this.map.size;
  }
  key(i) {
    const keys = Array.from(this.map.keys());
    return i >= 0 && i < keys.length ? keys[i] : null;
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

const NS_PORTAL = "aaaaaaaaaaaa";
const NS_P1 = "bbbbbbbbbbbb";
const NS_P2 = "cccccccccccc";

const seedDirectory = (store) =>
  store.setItem(
    DirectoryKey,
    JSON.stringify({
      [NS_PORTAL]: { siteUrl: "https://x/", name: "Portal" },
      [NS_P1]: { siteUrl: "https://x/i/pro-1", name: "Pro One" },
      [NS_P2]: { siteUrl: "https://x/i/pro-2", name: "Pro Two" },
    })
  );

describe("common/instances instanceIdentity", () => {
  it("derives the name from the distinctive base-path segment", () => {
    const config = { values: { storageNamespace: NS_P1, siteUrl: "https://app.example.com/i/pro-1/", siteCaption: "AI-Powered DAM" } };
    expect(instanceIdentity(config)).toEqual({ namespace: NS_P1, siteUrl: "https://app.example.com/i/pro-1/", name: "pro-1" });
  });
  it("falls back to the site caption when the URL has no base path", () => {
    const config = { values: { storageNamespace: NS_PORTAL, siteUrl: "https://x/", siteCaption: "Portal" } };
    expect(instanceIdentity(config)).toEqual({ namespace: NS_PORTAL, siteUrl: "https://x/", name: "Portal" });
  });
  it("falls back to the siteUrl when nothing else is available", () => {
    expect(instanceIdentity({ values: { storageNamespace: NS_P1, siteUrl: "https://x/" } }).name).toBe("https://x/");
  });
  it("tolerates a missing config", () => {
    expect(instanceIdentity(undefined)).toEqual({ namespace: "", siteUrl: "", name: "" });
  });
});

describe("common/instances readDirectory", () => {
  it("returns an empty map when nothing is stored", () => {
    expect(readDirectory(new FakeStorage())).toEqual({});
  });
  it("returns an empty map for malformed JSON", () => {
    const store = new FakeStorage();
    store.setItem(DirectoryKey, "{not json");
    expect(readDirectory(store)).toEqual({});
  });
});

describe("common/instances recordInstance", () => {
  it("upserts an instance under its namespace", () => {
    const store = new FakeStorage();
    recordInstance({ namespace: NS_P1, siteUrl: "https://x/i/pro-1", name: "Pro One" }, store);
    expect(readDirectory(store)[NS_P1]).toEqual({ siteUrl: "https://x/i/pro-1", name: "Pro One" });
  });
  it("labels with the siteUrl when no name is supplied", () => {
    const store = new FakeStorage();
    recordInstance({ namespace: NS_P1, siteUrl: "https://x/i/pro-1" }, store);
    expect(readDirectory(store)[NS_P1].name).toBe("https://x/i/pro-1");
  });
  it("is a no-op without a namespace or siteUrl", () => {
    const store = new FakeStorage();
    recordInstance({ namespace: "", siteUrl: "https://x/" }, store);
    recordInstance({ namespace: NS_P1, siteUrl: "" }, store);
    expect(readDirectory(store)).toEqual({});
  });
  it("does not rewrite an unchanged entry", () => {
    const store = new FakeStorage();
    recordInstance({ namespace: NS_P1, siteUrl: "https://x/i/pro-1", name: "Pro One" }, store);
    const before = store.getItem(DirectoryKey);
    store.setItem = () => {
      throw new Error("must not write");
    };
    expect(() => recordInstance({ namespace: NS_P1, siteUrl: "https://x/i/pro-1", name: "Pro One" }, store)).not.toThrow();
    expect(store.getItem(DirectoryKey)).toBe(before);
  });
});

describe("common/instances recordInstanceFromConfig", () => {
  it("records the identity derived from a config", () => {
    const store = new FakeStorage();
    recordInstanceFromConfig({ values: { storageNamespace: NS_P2, siteUrl: "https://x/i/pro-2", siteCaption: "Pro Two" } }, store);
    expect(readDirectory(store)[NS_P2]).toEqual({ siteUrl: "https://x/i/pro-2", name: "pro-2" });
  });
});

describe("common/instances signedInInstances", () => {
  it("returns other instances that currently hold a live session, excluding the current one", () => {
    const store = new FakeStorage();
    seedDirectory(store);
    store.setItem(`pp:${NS_PORTAL}:session.token`, "tok-portal");
    store.setItem(`pp:${NS_P1}:session.token`, "tok-p1");
    // pro-2 is in the directory but has no live session token.
    const config = { values: { storageNamespace: NS_PORTAL } };
    expect(signedInInstances(config, store)).toEqual([{ namespace: NS_P1, siteUrl: "https://x/i/pro-1", name: "Pro One" }]);
  });
  it("returns an empty list when no sibling has a live session", () => {
    const store = new FakeStorage();
    seedDirectory(store);
    store.setItem(`pp:${NS_PORTAL}:session.token`, "tok-portal");
    expect(signedInInstances({ values: { storageNamespace: NS_PORTAL } }, store)).toEqual([]);
  });
  it("sorts targets by name", () => {
    const store = new FakeStorage();
    seedDirectory(store);
    store.setItem(`pp:${NS_P1}:session.token`, "tok-p1");
    store.setItem(`pp:${NS_P2}:session.token`, "tok-p2");
    const names = signedInInstances({ values: { storageNamespace: NS_PORTAL } }, store).map((t) => t.name);
    expect(names).toEqual(["Pro One", "Pro Two"]);
  });
});
