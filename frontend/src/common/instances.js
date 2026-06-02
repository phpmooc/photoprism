/*

Copyright (c) 2018 - 2026 PhotoPrism UG. All rights reserved.

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

// Shared, cross-namespace browser-storage directory that lets same-origin
// PhotoPrism instances discover one another for the account-menu instance
// switcher. Each instance records its own {siteUrl, name} under its storage
// namespace (the SHA-256 of its SiteUrl, see config StorageNamespace and
// assets/templates/auth.gohtml). The switcher then renders the directory
// entries that currently hold a live session token (common/storage.js
// listAuthSessions) so a user can jump between instances they are signed in to,
// without relying on any cluster API. On standalone or separate-origin
// instances the directory only ever contains the current instance, so the
// switcher stays hidden.

import { listAuthSessions } from "common/storage";

// DirectoryKey is the raw localStorage key holding the instance directory. It
// is intentionally NOT namespaced (no "pp:<ns>:" prefix) so every same-origin
// instance reads and writes the same map; parseNamespace() ignores it because
// it has no second separator.
export const DirectoryKey = "pp:instances";

// getWindow safely accesses the browser window if it exists.
const getWindow = () => (typeof window === "undefined" ? null : window);

// getLocalStorage returns the explicit storage or the raw window localStorage.
// The directory deliberately uses raw (un-namespaced) storage so it is shared
// across instance namespaces on the same origin.
const getLocalStorage = (storage) => {
  if (storage) {
    return storage;
  }
  const w = getWindow();
  return w ? w.localStorage : null;
};

// readConfigValue reads a string field from a Config-like object, tolerating
// both the live $config (with .values / .get()) and a plain values object.
const readConfigValue = (config, key) => {
  if (!config) {
    return "";
  }
  if (config.values && typeof config.values[key] === "string") {
    return config.values[key];
  }
  if (typeof config.get === "function") {
    const v = config.get(key);
    if (typeof v === "string") {
      return v;
    }
  }
  if (typeof config[key] === "string") {
    return config[key];
  }
  return "";
};

// instanceIdentity extracts {namespace, siteUrl, name} from a Config-like
// object. The name falls back through the site caption/title/app name to the
// SiteUrl so an entry is always labelable.
export const instanceIdentity = (config) => {
  const namespace = readConfigValue(config, "storageNamespace");
  const siteUrl = readConfigValue(config, "siteUrl");
  const name =
    readConfigValue(config, "siteCaption") || readConfigValue(config, "siteTitle") || readConfigValue(config, "name") || siteUrl;
  return { namespace, siteUrl, name };
};

// readDirectory parses the instance directory map; returns {} on any error.
export const readDirectory = (storage) => {
  const store = getLocalStorage(storage);
  if (!store || typeof store.getItem !== "function") {
    return {};
  }
  try {
    const raw = store.getItem(DirectoryKey);
    if (!raw) {
      return {};
    }
    const dir = JSON.parse(raw);
    return dir && typeof dir === "object" ? dir : {};
  } catch {
    return {};
  }
};

// recordInstance upserts an instance identity into the shared directory. A
// missing namespace or siteUrl is a no-op, so it is safe to call during early
// bootstrap before the client config is fully resolved.
export const recordInstance = (identity, storage) => {
  const { namespace, siteUrl, name } = identity || {};
  if (!namespace || !siteUrl) {
    return;
  }
  const store = getLocalStorage(storage);
  if (!store || typeof store.setItem !== "function") {
    return;
  }
  try {
    const dir = readDirectory(store);
    const next = name || siteUrl;
    const existing = dir[namespace];
    if (existing && existing.siteUrl === siteUrl && existing.name === next) {
      return;
    }
    dir[namespace] = { siteUrl, name: next };
    store.setItem(DirectoryKey, JSON.stringify(dir));
  } catch {
    /* ignore quota / serialization errors — the directory is best-effort */
  }
};

// recordInstanceFromConfig records the current instance using its client config.
export const recordInstanceFromConfig = (config, storage) => {
  recordInstance(instanceIdentity(config), storage);
};

// signedInInstances returns the directory entries — excluding the current
// instance — that currently hold a live session token, as the switch-instance
// target list. Each target is {namespace, siteUrl, name}, sorted by name for a
// deterministic menu order.
export const signedInInstances = (config, storage) => {
  const store = getLocalStorage(storage);
  if (!store) {
    return [];
  }
  const dir = readDirectory(store);
  const current = readConfigValue(config, "storageNamespace");
  const live = new Set(listAuthSessions(store).map((s) => s.namespace));
  const out = [];
  for (const namespace of Object.keys(dir)) {
    if (namespace === current || !live.has(namespace)) {
      continue;
    }
    const entry = dir[namespace];
    if (!entry || !entry.siteUrl) {
      continue;
    }
    out.push({ namespace, siteUrl: entry.siteUrl, name: entry.name || entry.siteUrl });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
};
