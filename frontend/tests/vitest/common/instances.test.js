import { describe, it, expect } from "vitest";
import StorageShim from "node-storage-shim";
import { buildNamespace, createNamespacedStorage } from "common/storage";
import { persistInstanceIdentity, listReachableInstances, InstanceIdentityKeys, instanceLabel, instancePath } from "common/instances";

// seedInstance writes a peer instance's session token and identity into a shared store.
const seedInstance = (store, namespace, { token = "tok", url, title, icon } = {}) => {
  const prefix = buildNamespace(namespace);
  if (token) {
    store.setItem(prefix + "session.token", token);
  }
  if (url) {
    store.setItem(prefix + "instance.url", url);
  }
  if (title) {
    store.setItem(prefix + "instance.title", title);
  }
  if (icon) {
    store.setItem(prefix + "instance.icon", icon);
  }
};

describe("common/instances", () => {
  describe("instanceLabel", () => {
    it("derives the last base-path segment as a distinctive label", () => {
      expect(instanceLabel("https://app.example.com/i/pro-1/")).toBe("pro-1");
      expect(instanceLabel("https://app.example.com/i/pro-2")).toBe("pro-2");
    });
    it("returns an empty string for a root-path or unparseable url", () => {
      expect(instanceLabel("https://app.example.com/")).toBe("");
      expect(instanceLabel("not a url")).toBe("");
      expect(instanceLabel("")).toBe("");
      expect(instanceLabel(null)).toBe("");
    });
  });

  describe("instancePath", () => {
    it("returns the base path of a SiteUrl without a trailing slash", () => {
      expect(instancePath("https://app.example.com/i/pro-1/")).toBe("/i/pro-1");
      expect(instancePath("https://app.example.com/i/pro-2")).toBe("/i/pro-2");
    });
    it("returns / for a root install and '' for an unparseable url", () => {
      expect(instancePath("https://app.example.com/")).toBe("/");
      expect(instancePath("not a url")).toBe("");
      expect(instancePath("")).toBe("");
      expect(instancePath(null)).toBe("");
    });
  });

  describe("persistInstanceIdentity", () => {
    it("writes url, title, and icon under the namespace", () => {
      const store = new StorageShim();
      const ns = createNamespacedStorage(store, "ns-pro-1");
      persistInstanceIdentity(ns, { url: "https://pro-1.example.com/", title: "Pro One", icon: "/static/icons/logo.svg" });
      const prefix = buildNamespace("ns-pro-1");
      expect(store.getItem(prefix + "instance.url")).toBe("https://pro-1.example.com/");
      expect(store.getItem(prefix + "instance.title")).toBe("Pro One");
      expect(store.getItem(prefix + "instance.icon")).toBe("/static/icons/logo.svg");
    });
    it("clears a stale title or icon when none is provided", () => {
      const store = new StorageShim();
      const ns = createNamespacedStorage(store, "ns-pro-1");
      persistInstanceIdentity(ns, { url: "https://pro-1.example.com/", title: "Pro One", icon: "/static/icons/logo.svg" });
      persistInstanceIdentity(ns, { url: "https://pro-1.example.com/" });
      const prefix = buildNamespace("ns-pro-1");
      expect(store.getItem(prefix + "instance.title")).toBeNull();
      expect(store.getItem(prefix + "instance.icon")).toBeNull();
    });
    it("is a no-op without a url", () => {
      const store = new StorageShim();
      const ns = createNamespacedStorage(store, "ns-pro-1");
      persistInstanceIdentity(ns, { title: "Pro One" });
      expect(store.length).toBe(0);
    });
    it("is a no-op without a usable store", () => {
      expect(() => persistInstanceIdentity(null, { url: "https://pro-1.example.com/" })).not.toThrow();
    });
    it("exposes the identity suffix keys for cleanup", () => {
      expect(InstanceIdentityKeys).toContain("instance.url");
      expect(InstanceIdentityKeys).toContain("instance.title");
      expect(InstanceIdentityKeys).toContain("instance.icon");
    });
  });

  describe("listReachableInstances", () => {
    it("returns peer instances excluding the current namespace", () => {
      const store = new StorageShim();
      seedInstance(store, "ns-pro-1", { url: "https://pro-1.example.com/", title: "Pro One" });
      seedInstance(store, "ns-pro-2", { url: "https://pro-2.example.com/", title: "Pro Two", icon: "/i/pro-2/static/icons/logo.svg" });
      const result = listReachableInstances({ currentNamespace: "ns-pro-1", storage: store });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ namespace: "ns-pro-2", url: "https://pro-2.example.com/", title: "Pro Two", icon: "/i/pro-2/static/icons/logo.svg" });
    });
    it("falls back to the url when no title is recorded", () => {
      const store = new StorageShim();
      seedInstance(store, "ns-pro-1", { url: "https://pro-1.example.com/" });
      seedInstance(store, "ns-pro-2", { url: "https://pro-2.example.com/" });
      const result = listReachableInstances({ currentNamespace: "ns-pro-1", storage: store });
      expect(result[0].title).toBe("https://pro-2.example.com/");
    });
    it("ignores namespaces that have a session but no recorded identity", () => {
      const store = new StorageShim();
      seedInstance(store, "ns-pro-1", { url: "https://pro-1.example.com/" });
      seedInstance(store, "ns-pro-2", { token: "tok2" }); // session only, no identity
      const result = listReachableInstances({ currentNamespace: "ns-pro-1", storage: store });
      expect(result).toHaveLength(0);
    });
    it("ignores namespaces that have an identity but no live session", () => {
      const store = new StorageShim();
      seedInstance(store, "ns-pro-1", { url: "https://pro-1.example.com/" });
      seedInstance(store, "ns-pro-2", { token: "", url: "https://pro-2.example.com/" }); // identity only
      const result = listReachableInstances({ currentNamespace: "ns-pro-1", storage: store });
      expect(result).toHaveLength(0);
    });
    it("returns an empty array for a standalone deployment", () => {
      const store = new StorageShim();
      seedInstance(store, "ns-pro-1", { url: "https://pro-1.example.com/" });
      const result = listReachableInstances({ currentNamespace: "ns-pro-1", storage: store });
      expect(result).toEqual([]);
    });
    it("excludes peers whose stored url is not http(s)", () => {
      // Instance URLs cross a shared same-origin-storage trust boundary, so a peer
      // that recorded a javascript:/data: url must never become a switcher entry.
      const store = new StorageShim();
      seedInstance(store, "ns-pro-1", { url: "https://pro-1.example.com/" });
      seedInstance(store, "ns-evil", { url: "javascript:alert(1)" });
      const result = listReachableInstances({ currentNamespace: "ns-pro-1", storage: store });
      expect(result).toHaveLength(0);
    });
    it("de-duplicates a namespace seen more than once", () => {
      const store = new StorageShim();
      seedInstance(store, "ns-pro-1", { url: "https://pro-1.example.com/" });
      seedInstance(store, "ns-pro-2", { url: "https://pro-2.example.com/", title: "Pro Two" });
      store.setItem(buildNamespace("ns-pro-2") + "session.token", "tok-dup");
      const result = listReachableInstances({ currentNamespace: "ns-pro-1", storage: store });
      expect(result).toHaveLength(1);
    });
    it("discovers ephemeral peers from sessionStorage as well as localStorage", () => {
      const local = new StorageShim();
      const session = new StorageShim();
      seedInstance(local, "ns-pro-1", { url: "https://pro-1.example.com/", title: "Pro One" });
      seedInstance(session, "ns-pro-2", { url: "https://pro-2.example.com/", title: "Pro Two" });
      const result = listReachableInstances({ currentNamespace: "ns-pro-1", stores: [local, session] });
      expect(result.map((i) => i.namespace)).toEqual(["ns-pro-2"]);
    });
    it("de-duplicates a namespace present in both storage backends", () => {
      const local = new StorageShim();
      const session = new StorageShim();
      seedInstance(local, "ns-pro-1", { url: "https://pro-1.example.com/" });
      seedInstance(local, "ns-pro-2", { url: "https://pro-2.example.com/", title: "Pro Two" });
      seedInstance(session, "ns-pro-2", { url: "https://pro-2.example.com/", title: "Pro Two" });
      const result = listReachableInstances({ currentNamespace: "ns-pro-1", stores: [local, session] });
      expect(result).toHaveLength(1);
    });
  });
});
