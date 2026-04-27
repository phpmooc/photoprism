import { describe, it, expect, vi } from "vitest";
import "../fixtures";
import ModelCache from "model/model-cache";

// Minimal model-shaped object the tests can use without pulling in any
// real subclass. Snapshots store only `values`; hydrate returns a wrapper
// so callers can still distinguish "snapshot" from "hydrated instance".
function buildCache(overrides = {}) {
  return new ModelCache({
    max: 3,
    ttl: 0,
    snapshot: (model) => ({ ...model.values }),
    hydrate: (values) => ({ hydrated: true, values }),
    ...overrides,
  });
}

function fakeModel(uid, extra = {}) {
  return { values: { UID: uid, ...extra } };
}

// Lets the suite drive tick-by-tick. flushMicrotasks waits for all
// queued .then() callbacks; flushAndTick advances the manual clock too
// for TTL tests.
const flushMicrotasks = () => Promise.resolve();

describe("model/model-cache", () => {
  describe("constructor", () => {
    it("requires a snapshot callback", () => {
      expect(() => new ModelCache({ hydrate: (v) => v })).toThrow(/snapshot/);
    });

    it("requires a hydrate callback", () => {
      expect(() => new ModelCache({ snapshot: (m) => m.values })).toThrow(/hydrate/);
    });

    it("accepts numeric max and clamps non-positive values to 0", () => {
      const a = new ModelCache({ max: 5, snapshot: (m) => m, hydrate: (v) => v });
      const b = new ModelCache({ max: -1, snapshot: (m) => m, hydrate: (v) => v });
      expect(a.max).toBe(5);
      expect(b.max).toBe(0);
    });

    it("treats ttl <= 0 as disabled", () => {
      const a = new ModelCache({ ttl: 0, snapshot: (m) => m, hydrate: (v) => v });
      const b = new ModelCache({ ttl: -100, snapshot: (m) => m, hydrate: (v) => v });
      expect(a.ttl).toBe(0);
      expect(b.ttl).toBe(0);
    });
  });

  describe("set + get", () => {
    it("stores a deep clone so caller-side mutations don't bleed into the cache", () => {
      const cache = buildCache();
      const model = fakeModel("a", { Title: "Original" });
      cache.set("a", cache.snapshot(model));
      // Mutate the source after set: the cache must hold the snapshot.
      model.values.Title = "Tampered";
      const hit = cache.get("a");
      expect(hit.values.Title).toBe("Original");
    });

    it("hydrates from a clone so caller-side mutations don't bleed back into the cache", () => {
      const cache = buildCache();
      cache.set("a", { UID: "a", Title: "Original" });
      const first = cache.get("a");
      first.values.Title = "Mutated";
      const second = cache.get("a");
      expect(second.values.Title).toBe("Original");
      // Different hydrated instances, no aliasing.
      expect(first).not.toBe(second);
    });

    it("returns null on miss without throwing", () => {
      const cache = buildCache();
      expect(cache.get("missing")).toBeNull();
    });

    it("get() promotes the entry to the most-recent LRU slot", () => {
      const cache = buildCache({ max: 3 });
      cache.set("a", { UID: "a" });
      cache.set("b", { UID: "b" });
      cache.set("c", { UID: "c" });
      // Touching "a" should move it to the tail.
      cache.get("a");
      const keys = [...cache.items.keys()];
      expect(keys[keys.length - 1]).toBe("a");
    });

    it("set() refresh moves the entry to the most-recent LRU slot", () => {
      const cache = buildCache({ max: 3 });
      cache.set("a", { UID: "a" });
      cache.set("b", { UID: "b" });
      cache.set("c", { UID: "c" });
      cache.set("a", { UID: "a", Title: "Refreshed" });
      const keys = [...cache.items.keys()];
      expect(keys[keys.length - 1]).toBe("a");
    });

    it("evicts the oldest entry when max is exceeded", () => {
      const cache = buildCache({ max: 3 });
      cache.set("a", { UID: "a" });
      cache.set("b", { UID: "b" });
      cache.set("c", { UID: "c" });
      cache.set("d", { UID: "d" });
      expect(cache.size()).toBe(3);
      expect(cache.has("a")).toBe(false);
      expect(cache.has("d")).toBe(true);
    });

    it("set() is a no-op when max <= 0", () => {
      const cache = buildCache({ max: 0 });
      cache.set("a", { UID: "a" });
      expect(cache.size()).toBe(0);
      expect(cache.get("a")).toBeNull();
    });
  });

  describe("has", () => {
    it("returns true for live entries and false after expiration", () => {
      let now = 1000;
      const cache = buildCache({ ttl: 500, now: () => now });
      cache.set("a", { UID: "a" });
      expect(cache.has("a")).toBe(true);
      now += 600;
      expect(cache.has("a")).toBe(false);
    });

    it("does not promote the entry to the most-recent slot", () => {
      const cache = buildCache({ max: 3 });
      cache.set("a", { UID: "a" });
      cache.set("b", { UID: "b" });
      cache.has("a");
      const keys = [...cache.items.keys()];
      // "b" should still be the most-recent because has() is read-only.
      expect(keys[keys.length - 1]).toBe("b");
    });
  });

  describe("ttl", () => {
    it("expires entries after ttl ms and returns null on get", () => {
      let now = 1000;
      const cache = buildCache({ ttl: 500, now: () => now });
      cache.set("a", { UID: "a", Title: "Fresh" });
      now += 100;
      expect(cache.get("a").values.Title).toBe("Fresh");
      now += 500;
      expect(cache.get("a")).toBeNull();
    });

    it("with ttl disabled (0) entries never expire on their own", () => {
      let now = 1000;
      const cache = buildCache({ ttl: 0, now: () => now });
      cache.set("a", { UID: "a", Title: "Forever" });
      now += 1_000_000_000;
      expect(cache.get("a").values.Title).toBe("Forever");
    });
  });

  describe("fetch", () => {
    it("returns a hydrated model on miss and stores a snapshot", async () => {
      const cache = buildCache();
      const loader = vi.fn().mockResolvedValue(fakeModel("a", { Title: "Loaded" }));
      const result = await cache.fetch("a", loader);
      expect(result.hydrated).toBe(true);
      expect(result.values.Title).toBe("Loaded");
      expect(cache.has("a")).toBe(true);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("returns a hydrated model from cache on hit without invoking the loader", async () => {
      const cache = buildCache();
      cache.set("a", { UID: "a", Title: "Cached" });
      const loader = vi.fn();
      const result = await cache.fetch("a", loader);
      expect(result.values.Title).toBe("Cached");
      expect(loader).not.toHaveBeenCalled();
    });

    it("coalesces concurrent fetches behind a single in-flight request", async () => {
      const cache = buildCache();
      const loader = vi.fn().mockResolvedValue(fakeModel("a", { Title: "Loaded" }));
      const [r1, r2, r3] = await Promise.all([cache.fetch("a", loader), cache.fetch("a", loader), cache.fetch("a", loader)]);
      expect(loader).toHaveBeenCalledTimes(1);
      // Each waiter receives an isolated hydrated instance.
      expect(r1).not.toBe(r2);
      expect(r2).not.toBe(r3);
      expect(r1.values.Title).toBe("Loaded");
      expect(r2.values.Title).toBe("Loaded");
      expect(r3.values.Title).toBe("Loaded");
    });

    it("clears the pending entry after the loader resolves", async () => {
      const cache = buildCache();
      const loader = vi.fn().mockResolvedValue(fakeModel("a"));
      await cache.fetch("a", loader);
      expect(cache.pending.has("a")).toBe(false);
    });

    it("clears the pending entry even when the loader rejects", async () => {
      const cache = buildCache();
      const loader = vi.fn().mockRejectedValue(new Error("boom"));
      await expect(cache.fetch("a", loader)).rejects.toThrow("boom");
      expect(cache.pending.has("a")).toBe(false);
      expect(cache.has("a")).toBe(false);
    });

    it("hands waiters isolated clones when piggy-backing on an in-flight request", async () => {
      const cache = buildCache();
      // Use a deferred loader so the second fetch lands while the first is in flight.
      let resolveLoader;
      const loader = vi.fn().mockImplementation(() => new Promise((res) => (resolveLoader = res)));
      const p1 = cache.fetch("a", loader);
      const p2 = cache.fetch("a", loader);
      // fetch() invokes the loader inside a microtask, so wait one tick
      // before resolving — otherwise resolveLoader hasn't been assigned yet.
      await flushMicrotasks();
      resolveLoader(fakeModel("a", { Title: "Loaded" }));
      const [r1, r2] = await Promise.all([p1, p2]);
      // Mutating one waiter must not affect the other.
      r1.values.Title = "Mutated by r1";
      expect(r2.values.Title).toBe("Loaded");
    });
  });

  describe("refreshIfPresent", () => {
    it("updates an existing entry and returns true", () => {
      const cache = buildCache();
      cache.set("a", { UID: "a", Title: "Old" });
      const ok = cache.refreshIfPresent("a", { UID: "a", Title: "New" });
      expect(ok).toBe(true);
      expect(cache.get("a").values.Title).toBe("New");
    });

    it("does not seed a new entry and returns false when key is absent", () => {
      const cache = buildCache();
      const ok = cache.refreshIfPresent("a", { UID: "a", Title: "New" });
      expect(ok).toBe(false);
      expect(cache.has("a")).toBe(false);
    });

    it("promotes the refreshed entry to the most-recent LRU slot", () => {
      const cache = buildCache({ max: 3 });
      cache.set("a", { UID: "a" });
      cache.set("b", { UID: "b" });
      cache.set("c", { UID: "c" });
      cache.refreshIfPresent("a", { UID: "a", Title: "Refreshed" });
      const keys = [...cache.items.keys()];
      expect(keys[keys.length - 1]).toBe("a");
    });
  });

  describe("evict", () => {
    it("removes the entry and any pending request for the given key", async () => {
      const cache = buildCache();
      cache.set("a", { UID: "a" });
      // Start a pending fetch on a different key so we can confirm evict
      // only touches the targeted key.
      let resolveLoader;
      const loader = () => new Promise((res) => (resolveLoader = res));
      const inFlight = cache.fetch("b", loader);
      await flushMicrotasks();
      cache.evict("a");
      expect(cache.has("a")).toBe(false);
      expect(cache.pending.has("b")).toBe(true);
      resolveLoader(fakeModel("b"));
      await inFlight;
    });
  });

  describe("clear", () => {
    it("empties items and the pending-request map", () => {
      const cache = buildCache();
      cache.set("a", { UID: "a" });
      cache.set("b", { UID: "b" });
      // Seed a pending entry without resolving.
      cache.fetch("c", () => new Promise(() => {}));
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.pending.size).toBe(0);
    });

    it("does NOT abort in-flight loader Promises (documented behavior; Open Question #1)", async () => {
      // A loader resolving after clear() repopulates the cache under its
      // own key. This is the same race the original Photo cache had and
      // is preserved deliberately so the extraction does not regress
      // current behavior. Tracked in
      // specs/proposals/frontend-model-lru-cache.md "Open Questions".
      const cache = buildCache();
      let resolveLoader;
      const loader = () => new Promise((res) => (resolveLoader = res));
      const inFlight = cache.fetch("a", loader);
      await flushMicrotasks();
      cache.clear();
      expect(cache.size()).toBe(0);
      resolveLoader(fakeModel("a", { Title: "Late" }));
      await inFlight;
      // The cache repopulates because the loader's .then chain still ran.
      expect(cache.has("a")).toBe(true);
      expect(cache.get("a").values.Title).toBe("Late");
    });
  });

  describe("size", () => {
    it("reports the current item count", () => {
      const cache = buildCache();
      expect(cache.size()).toBe(0);
      cache.set("a", { UID: "a" });
      cache.set("b", { UID: "b" });
      expect(cache.size()).toBe(2);
      cache.evict("a");
      expect(cache.size()).toBe(1);
    });
  });
});
