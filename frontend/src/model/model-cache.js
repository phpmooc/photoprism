/*

Copyright (c) 2018 - 2025 PhotoPrism UG. All rights reserved.

    This program is free software: you can redistribute it and/or modify
    it under Version 3 of the GNU Affero General Public License (the "AGPL"):
    <https://docs.photoprism.app/license/agpl>

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    The AGPL is supplemented by our Trademark and Brand Guidelines,
    which describe how our Brand Assets may be used:
    <https://www.photoprism.app/trademark>

Feel free to send an email to hello@photoprism.app if you have questions,
want to support our work, or just want to say hello.

Additional information can be found in our Developer Guide:
<https://docs.photoprism.app/developer-guide/>

*/

// Deep-clones a plain object via JSON. Used at both ends of the cache
// lifecycle (set + hydrate) so callers can never share refs with cached
// values — see "isolation contract" in
// specs/proposals/frontend-model-lru-cache.md.
function deepClone(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

// ModelCache is a small in-memory LRU for full-entity model snapshots. It
// is model-layer infrastructure: a subclass (e.g. Photo) supplies snapshot
// and hydrate hooks so the cache can stay neutral about model shape.
//
// Contract (see specs/proposals/frontend-model-lru-cache.md):
//   - Stores plain value snapshots, never live model instances.
//   - Returns a fresh hydrated instance for every cache hit so callers
//     can mutate freely without aliasing the cached source of truth.
//   - Coalesces concurrent fetch() calls for the same key behind one
//     in-flight Promise, then hydrates each waiter independently.
//   - LRU ordering: every read or refresh moves the entry to the most-
//     recent slot; size is capped at `max` and the oldest entry is
//     evicted when the cap is exceeded.
//   - Optional TTL (`ttl` ms). 0 / null / negative means "disabled" —
//     the recommended default for full-entity caches that lean on the
//     websocket update channel for freshness.
//   - clear() empties items and the pending-request map but does NOT
//     abort in-flight loader Promises. A loader that resolves after
//     clear() will call set() on its key and re-seed the cache. This
//     mirrors the behavior of the original Photo cache and is tracked
//     as Open Question #1 in the proposal.
export class ModelCache {
  // Constructs a ModelCache with the given options:
  //   - max:      hard size cap; oldest entry is evicted on overflow.
  //   - ttl:      optional millisecond expiration; 0/null/negative disables.
  //   - snapshot: (model) => plain values to store. Required.
  //   - hydrate:  (values) => instantiated model. Required.
  //   - now:      () => epoch ms; injectable for deterministic TTL tests.
  constructor({ max = 50, ttl = 0, snapshot, hydrate, now = () => Date.now() } = {}) {
    if (typeof snapshot !== "function") {
      throw new Error("ModelCache: `snapshot` callback is required");
    }
    if (typeof hydrate !== "function") {
      throw new Error("ModelCache: `hydrate` callback is required");
    }
    this.max = max > 0 ? max : 0;
    this.ttl = typeof ttl === "number" && ttl > 0 ? ttl : 0;
    this.snapshot = snapshot;
    this.hydrate = hydrate;
    this.now = now;
    this.items = new Map();
    this.pending = new Map();
  }

  // Returns true if the key has a non-expired entry. Side-effect free
  // (does not move the entry in the LRU order).
  has(key) {
    if (!this.items.has(key)) {
      return false;
    }
    const entry = this.items.get(key);
    if (entry.expiresAt > 0 && entry.expiresAt <= this.now()) {
      return false;
    }
    return true;
  }

  // Returns a freshly hydrated model for the given key, or null on miss
  // or expiration. Touching the entry promotes it to the most-recent LRU
  // slot. Hydration always happens against a deep clone of the snapshot
  // so the returned instance can be safely mutated.
  get(key) {
    const entry = this.items.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt > 0 && entry.expiresAt <= this.now()) {
      this.items.delete(key);
      return null;
    }
    // LRU promotion: re-insert at the tail.
    this.items.delete(key);
    this.items.set(key, entry);
    return this.hydrate(deepClone(entry.value));
  }

  // Stores or refreshes the entry for `key`. The snapshot is deep-cloned
  // before being stored so future caller-side mutations on `value` cannot
  // bleed into the cache. LRU ordering and size cap are enforced.
  set(key, value) {
    if (this.max <= 0) {
      return;
    }
    if (this.items.has(key)) {
      this.items.delete(key);
    } else if (this.items.size >= this.max) {
      const oldest = this.items.keys().next().value;
      this.items.delete(oldest);
    }
    this.items.set(key, {
      value: deepClone(value),
      expiresAt: this.ttl > 0 ? this.now() + this.ttl : 0,
    });
  }

  // Returns a hydrated model for `key`, fetching via `loader` on miss.
  // Concurrent fetches for the same key share a single in-flight Promise;
  // each waiter receives an isolated hydrated instance. The loader is
  // expected to return a model whose values flow through `snapshot`.
  fetch(key, loader) {
    const cached = this.get(key);
    if (cached) {
      return Promise.resolve(cached);
    }
    if (this.pending.has(key)) {
      return this.pending.get(key).then((snapshot) => this.hydrate(deepClone(snapshot)));
    }
    const request = Promise.resolve()
      .then(loader)
      .then((model) => {
        const snapshot = this.snapshot(model);
        this.set(key, snapshot);
        return snapshot;
      })
      .finally(() => {
        this.pending.delete(key);
      });
    this.pending.set(key, request);
    return request.then((snapshot) => this.hydrate(deepClone(snapshot)));
  }

  // Refreshes an entry only if it is already cached. Used by background
  // event handlers (e.g. websocket "updated" payloads) so the cache
  // doesn't grow from traffic the user hasn't actively browsed. Returns
  // true when an entry was refreshed.
  refreshIfPresent(key, value) {
    if (!this.items.has(key)) {
      return false;
    }
    this.set(key, value);
    return true;
  }

  // Drops the entry (and any pending request) for the given key.
  evict(key) {
    this.items.delete(key);
    this.pending.delete(key);
  }

  // Empties the cache and the pending-request map. Does NOT abort
  // in-flight loader promises (see class-level note + Open Question #1
  // in the proposal); a loader that resolves after clear() will call
  // set() on its own key and re-seed the cache.
  clear() {
    this.items.clear();
    this.pending.clear();
  }

  // Returns the current entry count. Primarily useful for tests and
  // optional debug instrumentation.
  size() {
    return this.items.size;
  }
}

export default ModelCache;
