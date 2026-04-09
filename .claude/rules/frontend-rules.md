## Frontend Focus Management

- Dialogs must follow the shared focus pattern documented in `frontend/src/common/README.md`.
- Always expose `ref="dialog"` on `<v-dialog>` overlays, call `$view.enter/leave` in `@after-enter` / `@after-leave`, and avoid positive `tabindex` values.
- Persistent dialogs (those with the `persistent` prop) must handle Escape via `@keydown.esc.exact` so Vuetify's default rejection animation is suppressed; keep other shortcuts on `@keyup` so inner inputs can cancel them first.
- Global shortcuts run through `onShortCut(ev)` in `common/view.js`; it only forwards Escape and `ctrl`/`meta` combinations, so do not rely on it for arbitrary keys.
- When a dialog opens nested menus (e.g., combobox suggestion lists), ensure they work with the global trap; see the README for troubleshooting tips.

## Frontend Translations

- Frontend translation extraction source of truth is root `make gettext-extract` (runs `scripts/gettext-extract.sh`), which scans `frontend/src` plus available private overlays in `plus/frontend`, `pro/frontend`, and `portal/frontend`.
- Avoid punctuation-only gettext keys (e.g. `$gettext("—")`), as they create noisy/unhelpful entries in `frontend/src/locales/translations.pot`.

## Web Templates & Shared Assets

- HTML entrypoints live under `assets/templates/`; key files are `index.gohtml`, `app.gohtml`, `app.js.gohtml`, and `splash.gohtml`.
- Browser check logic: `assets/static/js/browser-check.js` is included via `app.js.gohtml`; it performs capability checks before the main bundle executes.
- OIDC login completion for the web UI is bridged through `assets/templates/auth.gohtml`, which writes the session into namespaced browser storage. Must stay aligned with `frontend/src/common/session.js`, `frontend/src/common/storage.js`, and the login form toggle in `frontend/src/page/auth/login.vue`.
- When touching frontend session bootstrap, verify that `frontend/src/common/session.js` resolves `storageNamespace` from the real client config shape (`window.__CONFIG__` / `config.values`), not only from simplified mocks.
- Keep the script order in `app.js.gohtml` so `browser-check.js` loads before the bundle script. Do not add `defer` or `async` to the bundle tag unless you reintroduce a guarded loader.
- The same loader partial is reused in private packages (`pro/assets/templates/index.gohtml`, `plus/assets/templates/index.gohtml`, `portal/assets/templates/index.gohtml`). Mirror updates when touching `app.js.gohtml`.
- Splash styles: `frontend/src/css/splash.css`. Add new splash elements there for visual consistency across editions.
- Browser baseline: Safari 13 / iOS 13 or current Chrome, Edge, or Firefox.
