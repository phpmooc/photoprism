<template>
  <div
    ref="root"
    class="p-face-markers"
    :class="{ 'is-drawing': isDrawMode, 'is-display': !isDrawMode }"
    :style="rootStyle"
    @pointerdown="onPointerDown"
    @pointermove="onHoverMove"
    @pointerleave="onHoverLeave"
  >
    <svg v-if="bounds" class="p-face-markers__svg" :style="svgStyle" :viewBox="`0 0 ${bounds.width} ${bounds.height}`">
      <g v-for="m in markers" :key="m.UID || m.CropID">
        <rect
          class="p-face-markers__rect"
          :class="{ 'p-face-markers__rect--named': !!m.Name }"
          :x="m.X * bounds.width"
          :y="m.Y * bounds.height"
          :width="m.W * bounds.width"
          :height="m.H * bounds.height"
        >
          <title v-if="m.Name">{{ m.Name }}</title>
        </rect>
        <text
          v-if="m.Name && !isDrawMode"
          class="p-face-markers__label"
          text-anchor="middle"
          :x="m.X * bounds.width + (m.W * bounds.width) / 2"
          :y="m.Y * bounds.height + m.H * bounds.height + 16"
        >
          {{ m.Name }}
        </text>
      </g>
      <rect
        v-if="activeDraft"
        class="p-face-markers__rect p-face-markers__rect--draft"
        :x="activeDraft.x"
        :y="activeDraft.y"
        :width="activeDraft.w"
        :height="activeDraft.h"
      ></rect>
      <g v-if="pending && !interaction">
        <circle class="p-face-markers__handle p-face-markers__handle--tl" :cx="pending.x" :cy="pending.y" r="6"></circle>
        <circle class="p-face-markers__handle p-face-markers__handle--tr" :cx="pending.x + pending.w" :cy="pending.y" r="6"></circle>
        <circle class="p-face-markers__handle p-face-markers__handle--bl" :cx="pending.x" :cy="pending.y + pending.h" r="6"></circle>
        <circle class="p-face-markers__handle p-face-markers__handle--br" :cx="pending.x + pending.w" :cy="pending.y + pending.h" r="6"></circle>
      </g>
    </svg>
    <div v-if="pending && bounds && !interaction" class="p-face-markers__confirm" :style="confirmStyle" @pointerdown.stop @pointerup.stop>
      <button
        type="button"
        class="p-face-markers__btn p-face-markers__btn--confirm"
        :class="{ 'is-disabled': busy }"
        :disabled="busy"
        :title="$gettext('Confirm')"
        @click.stop="onConfirmPending"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
        </svg>
      </button>
      <button type="button" class="p-face-markers__btn p-face-markers__btn--cancel" :title="$gettext('Cancel')" @click.stop="onCancelPending">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
        </svg>
      </button>
    </div>
    <button
      type="button"
      class="p-face-markers__btn p-face-markers__btn--back"
      :title="$gettext('Back')"
      :aria-label="$gettext('Back')"
      @click.stop="onBackClick"
      @pointerdown.stop
      @pointerup.stop
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path v-if="$isRtl" fill="currentColor" d="M4 11h12.17l-5.59-5.59L12 4l8 8-8 8-1.41-1.41L16.17 13H4z"></path>
        <path v-else fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z"></path>
      </svg>
    </button>
  </div>
</template>

<script>
import { FaceMarkerDisplay, FaceMarkerDraw, isFaceMarkerMode } from "options/face-marker";

// Minimum side length of a drawable square, in screen pixels.
const MIN_DRAW_SIZE = 16;

// Internal pointer-interaction kinds used by the overlay's draw / move /
// resize gestures. Named separately from the public face-marker mode
// constants so the same word "draw" can carry distinct semantics in each
// scope without confusion.
const InteractionDraw = "draw";
const InteractionMove = "move";
const InteractionResize = "resize";

export default {
  name: "PFaceMarkerOverlay",
  props: {
    markers: {
      type: Array,
      default: () => [],
    },
    pswp: {
      type: Object,
      default: null,
    },
    mode: {
      type: String,
      default: FaceMarkerDisplay,
      validator: isFaceMarkerMode,
    },
    busy: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["create", "cancel"],
  data() {
    return {
      bounds: null,
      draft: null,
      pending: null,
      interaction: null, // null | InteractionDraw | InteractionMove | InteractionResize
      resizeCorner: null,
      hoverCursor: null,
      pointerId: null,
      dragStart: null,
      rafHandle: null,
      resizeObserver: null,
    };
  },
  computed: {
    isDrawMode() {
      return this.mode === FaceMarkerDraw;
    },
    svgStyle() {
      if (!this.bounds) return { display: "none" };
      return {
        position: "absolute",
        left: `${this.bounds.left}px`,
        top: `${this.bounds.top}px`,
        width: `${this.bounds.width}px`,
        height: `${this.bounds.height}px`,
      };
    },
    activeDraft() {
      return this.draft || this.pending;
    },
    rootStyle() {
      return this.hoverCursor ? { cursor: this.hoverCursor } : {};
    },
    confirmStyle() {
      if (!this.pending || !this.bounds) return { display: "none" };
      const left = this.bounds.left + this.pending.x + this.pending.w / 2;
      const top = this.bounds.top + this.pending.y + this.pending.h;
      return {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        transform: "translate(-50%, 8px)",
      };
    },
  },
  watch: {
    mode(newVal) {
      if (newVal !== FaceMarkerDraw) {
        this.cancelActiveDraft();
      }
    },
  },
  mounted() {
    this.attachPswpListeners();
    this.attachImageLoadListener();
    this.scheduleUpdate();

    this.onWindowResize = () => this.scheduleUpdate();
    window.addEventListener("resize", this.onWindowResize);

    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => this.scheduleUpdate());
      if (this.$refs.root) {
        this.resizeObserver.observe(this.$refs.root);
      }
    }
  },
  beforeUnmount() {
    this.detachPswpListeners();
    this.detachImageLoadListener();
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);

    if (this.rafHandle) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  },
  methods: {
    imageElement() {
      const el = this.pswp?.currSlide?.content?.element;
      if (el instanceof HTMLImageElement) return el;
      if (el && typeof el.querySelector === "function") {
        return el.querySelector("img.pswp__image");
      }
      return null;
    },
    // Subscribes to the image's `load` event so updateBounds is called once
    // `naturalWidth/naturalHeight` become available. The letterbox math
    // relies on those intrinsic dimensions, and the <img> for video / live
    // slides is added without explicit dims — so bounds computed before
    // `load` would fall back to the box rect.
    attachImageLoadListener() {
      const img = this.imageElement();
      if (!img) {
        this._loadListenedImg = null;
        return;
      }
      if (this._loadListenedImg === img) return;
      this.detachImageLoadListener();
      this._loadListenedImg = img;
      this._onImgLoad = () => this.scheduleUpdate();
      img.addEventListener("load", this._onImgLoad);
    },
    detachImageLoadListener() {
      if (this._loadListenedImg && this._onImgLoad) {
        this._loadListenedImg.removeEventListener("load", this._onImgLoad);
      }
      this._loadListenedImg = null;
      this._onImgLoad = null;
    },
    attachPswpListeners() {
      if (!this.pswp || typeof this.pswp.on !== "function") return;
      this._onZoomPan = () => this.scheduleUpdate();
      this._onChange = () => {
        this.attachImageLoadListener();
        this.scheduleUpdate();
      };
      this._onResize = () => this.scheduleUpdate();
      this.pswp.on("zoomPanUpdate", this._onZoomPan);
      this.pswp.on("change", this._onChange);
      this.pswp.on("resize", this._onResize);
      this.pswp.on("imageClickAction", this._onChange);
    },
    detachPswpListeners() {
      if (!this.pswp || typeof this.pswp.off !== "function") return;
      if (this._onZoomPan) this.pswp.off("zoomPanUpdate", this._onZoomPan);
      if (this._onChange) {
        this.pswp.off("change", this._onChange);
        this.pswp.off("imageClickAction", this._onChange);
      }
      if (this._onResize) this.pswp.off("resize", this._onResize);
    },
    scheduleUpdate() {
      if (this.rafHandle) return;
      this.rafHandle = requestAnimationFrame(() => {
        this.rafHandle = null;
        this.updateBounds();
      });
    },
    updateBounds() {
      const img = this.imageElement();
      if (!img || !this.$refs.root) {
        if (this.bounds !== null) this.bounds = null;
        return;
      }
      const imgRect = img.getBoundingClientRect();
      const parentRect = this.$refs.root.getBoundingClientRect();
      if (imgRect.width <= 0 || imgRect.height <= 0) {
        if (this.bounds !== null) this.bounds = null;
        return;
      }
      // For video / live / animated slides, the <img class="pswp__image">
      // takes the slide container's box (e.g. 980×900) via CSS
      // `width: auto; height: 100%; max-width: 100%; max-height: 100vh;
      // object-fit: contain`. The pixel content is letterboxed inside that
      // box but `getBoundingClientRect()` returns the BOX, not the inscribed
      // image rect. Face-marker X/Y/W/H are normalized against the original
      // image aspect ratio, so applying them to the box height would stretch
      // the markers across the letterbox bars (faces look TALL).
      //
      // Compute the inscribed rect from the natural aspect ratio. For image
      // slides where PhotoSwipe sizes the <img> exactly to the displayed
      // dimensions, this math is a no-op (boxRatio matches naturalRatio).
      let left = imgRect.left - parentRect.left;
      let top = imgRect.top - parentRect.top;
      let width = imgRect.width;
      let height = imgRect.height;
      const nW = img.naturalWidth || 0;
      const nH = img.naturalHeight || 0;
      if (nW > 0 && nH > 0) {
        const naturalRatio = nW / nH;
        const boxRatio = width / height;
        const tol = 0.001;
        if (Math.abs(naturalRatio - boxRatio) > tol) {
          if (naturalRatio > boxRatio) {
            // image wider than box → letterbox top + bottom
            const inscribedH = width / naturalRatio;
            top += (height - inscribedH) / 2;
            height = inscribedH;
          } else {
            // image taller than box → pillarbox left + right
            const inscribedW = height * naturalRatio;
            left += (width - inscribedW) / 2;
            width = inscribedW;
          }
        }
      }
      // Skip the assignment when nothing changed so Vue does not rerender the
      // SVG children on every zoomPanUpdate tick while the image is idle.
      const b = this.bounds;
      if (b && b.left === left && b.top === top && b.width === width && b.height === height) {
        return;
      }
      this.bounds = { left, top, width, height };
    },
    onPointerDown(ev) {
      if (!this.isDrawMode) return;

      if (!this.bounds) {
        this.updateBounds();
        if (!this.bounds) return;
      }

      if (ev.button !== undefined && ev.button !== 0) return;

      const local = this.toLocal(ev.clientX, ev.clientY);
      if (!this.insideBounds(local)) return;

      if (this.pending) {
        const corner = this.hitTestCorner(local, this.pending);
        if (corner) {
          this.beginResize(corner, ev);
          return;
        }
        if (this.insidePending(local, this.pending)) {
          this.beginMove(local, ev);
          return;
        }
      }

      this.stopEventFromPswp(ev);
      this.pending = null;
      this.interaction = InteractionDraw;
      this.pointerId = ev.pointerId;
      this.dragStart = { clientX: ev.clientX, clientY: ev.clientY, local };
      this.draft = { x: local.x, y: local.y, w: 0, h: 0 };

      this.attachWindowPointerListeners();
    },
    onPointerMove(ev) {
      if (!this.interaction || !this.dragStart || !this.bounds) return;
      if (this.pointerId !== null && ev.pointerId !== this.pointerId) return;

      const local = this.toLocal(ev.clientX, ev.clientY);
      const cx = Math.max(0, Math.min(this.bounds.width, local.x));
      const cy = Math.max(0, Math.min(this.bounds.height, local.y));

      if (this.interaction === InteractionMove) {
        const origin = this.dragStart.pending;
        if (!origin) return;
        const dx = local.x - this.dragStart.local.x;
        const dy = local.y - this.dragStart.local.y;
        let nx = origin.x + dx;
        let ny = origin.y + dy;
        if (nx < 0) nx = 0;
        if (ny < 0) ny = 0;
        if (nx + origin.w > this.bounds.width) nx = this.bounds.width - origin.w;
        if (ny + origin.h > this.bounds.height) ny = this.bounds.height - origin.h;
        this.pending = { x: nx, y: ny, w: origin.w, h: origin.h };
        return;
      }

      // Square-from-anchor math shared by draw (anchor = pointerdown) and
      // resize (anchor = opposite corner). The larger axis wins so the
      // rect stays visually square regardless of drag direction.
      const dx = cx - this.dragStart.local.x;
      const dy = cy - this.dragStart.local.y;

      let side = Math.max(Math.abs(dx), Math.abs(dy));
      const signX = dx < 0 ? -1 : 1;
      const signY = dy < 0 ? -1 : 1;

      if (this.interaction === InteractionResize && side < MIN_DRAW_SIZE) {
        side = MIN_DRAW_SIZE;
      }

      let sx = this.dragStart.local.x;
      let sy = this.dragStart.local.y;
      let sw = side;
      let sh = side;

      if (signX < 0) sx = this.dragStart.local.x - side;
      if (signY < 0) sy = this.dragStart.local.y - side;

      if (sx < 0) {
        sw += sx;
        sh += sx;
        sx = 0;
      }
      if (sy < 0) {
        sw += sy;
        sh += sy;
        sy = 0;
      }
      if (sx + sw > this.bounds.width) {
        const over = sx + sw - this.bounds.width;
        sw -= over;
        sh -= over;
      }
      if (sy + sh > this.bounds.height) {
        const over = sy + sh - this.bounds.height;
        sw -= over;
        sh -= over;
      }

      if (sw < 0) sw = 0;
      if (sh < 0) sh = 0;

      if (this.interaction === InteractionResize) {
        this.pending = { x: sx, y: sy, w: sw, h: sh };
      } else {
        this.draft = { x: sx, y: sy, w: sw, h: sh };
      }
    },
    onPointerUp(ev) {
      if (!this.interaction) return;
      if (this.pointerId !== null && ev && ev.pointerId !== this.pointerId) return;

      this.detachWindowPointerListeners();

      const wasInteraction = this.interaction;
      const draft = this.draft;

      this.interaction = null;
      this.resizeCorner = null;
      this.pointerId = null;
      this.dragStart = null;
      this.draft = null;

      // Move/resize have already written the up-to-date `pending`; only
      // the draw path needs to promote its draft into pending.
      if (wasInteraction !== InteractionDraw) return;

      if (!draft || !this.bounds || draft.w < MIN_DRAW_SIZE || draft.h < MIN_DRAW_SIZE) {
        return;
      }

      this.pending = draft;
    },
    onConfirmPending() {
      if (this.busy) return;

      const pending = this.pending;
      const bounds = this.bounds;
      if (!pending || !bounds) return;

      const nx = pending.x / bounds.width;
      const ny = pending.y / bounds.height;
      const nw = pending.w / bounds.width;
      const nh = pending.h / bounds.height;

      this.$emit("create", {
        X: this.clamp01(nx),
        Y: this.clamp01(ny),
        W: this.clamp01(nw),
        H: this.clamp01(nh),
      });
    },
    onCancelPending() {
      this.pending = null;
      this.hoverCursor = null;
    },
    // Back-button click. Signals the parent lightbox to exit face-marker
    // mode entirely (display or draw). Uses the existing `cancel` emit
    // so the lightbox's `@cancel="exitFaceMarkerMode"` wiring catches
    // it without a new listener. Distinct from `onCancelPending` —
    // that one discards a draft rect without exiting draw mode.
    onBackClick() {
      this.cancelActiveDraft();
      this.$emit("cancel");
    },
    // Called by the parent only after a successful save — on failure the
    // parent leaves the rect on screen so the user can retry.
    clearPending() {
      this.pending = null;
      this.hoverCursor = null;
    },
    cancelActiveDraft() {
      if (this.interaction) {
        this.detachWindowPointerListeners();
      }
      this.interaction = null;
      this.resizeCorner = null;
      this.pointerId = null;
      this.dragStart = null;
      this.draft = null;
      this.pending = null;
      this.hoverCursor = null;
    },
    // Cancels in-progress draw / move / resize interactions and clears any
    // unconfirmed pending rectangle without exiting draw mode. Returns
    // true when the overlay consumed the Escape (caller should NOT also
    // exit draw mode or close the lightbox); false when the overlay had
    // nothing pending, leaving the caller free to decide. Called by the
    // lightbox's `onEscapeKey()` via the `faceMarkerOverlay` ref — see
    // `frontend/src/common/README.md` for the documented keyboard
    // pattern (Vuetify v-dialog `@keydown.esc.exact` + `onShortCut`).
    handleEscape() {
      if (this.interaction === InteractionDraw) {
        this.interaction = null;
        this.pointerId = null;
        this.dragStart = null;
        this.draft = null;
        this.detachWindowPointerListeners();
        return true;
      }
      if (this.interaction === InteractionMove || this.interaction === InteractionResize) {
        const snapshot = this.dragStart && this.dragStart.pending;
        if (snapshot) this.pending = { ...snapshot };
        this.interaction = null;
        this.resizeCorner = null;
        this.pointerId = null;
        this.dragStart = null;
        this.detachWindowPointerListeners();
        return true;
      }
      if (this.pending) {
        this.pending = null;
        return true;
      }
      return false;
    },
    stopEventFromPswp(ev) {
      if (typeof ev.stopPropagation === "function") ev.stopPropagation();
      if (typeof ev.preventDefault === "function" && ev.cancelable !== false) ev.preventDefault();
    },
    attachWindowPointerListeners() {
      window.addEventListener("pointermove", this.onPointerMove);
      window.addEventListener("pointerup", this.onPointerUp);
      window.addEventListener("pointercancel", this.onPointerUp);
    },
    detachWindowPointerListeners() {
      window.removeEventListener("pointermove", this.onPointerMove);
      window.removeEventListener("pointerup", this.onPointerUp);
      window.removeEventListener("pointercancel", this.onPointerUp);
    },
    hitTestCorner(p, rect) {
      const r = 14;
      const corners = {
        tl: { x: rect.x, y: rect.y },
        tr: { x: rect.x + rect.w, y: rect.y },
        bl: { x: rect.x, y: rect.y + rect.h },
        br: { x: rect.x + rect.w, y: rect.y + rect.h },
      };
      for (const key of Object.keys(corners)) {
        const c = corners[key];
        if (Math.hypot(p.x - c.x, p.y - c.y) <= r) return key;
      }
      return null;
    },
    insidePending(p, rect) {
      return p.x >= rect.x && p.y >= rect.y && p.x <= rect.x + rect.w && p.y <= rect.y + rect.h;
    },
    // The opposite corner becomes the fixed anchor so the square-from-anchor
    // math in onPointerMove works the same way as for the draw path.
    beginResize(corner, ev) {
      const p = this.pending;
      if (!p) return;
      let anchor;
      if (corner === "tl") anchor = { x: p.x + p.w, y: p.y + p.h };
      else if (corner === "tr") anchor = { x: p.x, y: p.y + p.h };
      else if (corner === "bl") anchor = { x: p.x + p.w, y: p.y };
      else anchor = { x: p.x, y: p.y };

      this.stopEventFromPswp(ev);
      this.interaction = InteractionResize;
      this.resizeCorner = corner;
      this.pointerId = ev.pointerId;
      this.dragStart = {
        clientX: ev.clientX,
        clientY: ev.clientY,
        local: anchor,
        pending: { ...p },
      };
      this.attachWindowPointerListeners();
    },
    onHoverMove(ev) {
      if (!this.isDrawMode || this.interaction) return;
      if (!this.pending || !this.bounds) {
        if (this.hoverCursor !== null) this.hoverCursor = null;
        return;
      }
      const local = this.toLocal(ev.clientX, ev.clientY);
      if (!this.insideBounds(local)) {
        if (this.hoverCursor !== null) this.hoverCursor = null;
        return;
      }
      const corner = this.hitTestCorner(local, this.pending);
      if (corner) {
        const c = corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize";
        if (this.hoverCursor !== c) this.hoverCursor = c;
        return;
      }
      if (this.insidePending(local, this.pending)) {
        if (this.hoverCursor !== "move") this.hoverCursor = "move";
        return;
      }
      if (this.hoverCursor !== null) this.hoverCursor = null;
    },
    onHoverLeave() {
      if (this.hoverCursor !== null) this.hoverCursor = null;
    },
    beginMove(local, ev) {
      const p = this.pending;
      if (!p) return;
      this.stopEventFromPswp(ev);
      this.interaction = InteractionMove;
      this.resizeCorner = null;
      this.pointerId = ev.pointerId;
      this.dragStart = {
        clientX: ev.clientX,
        clientY: ev.clientY,
        local,
        pending: { ...p },
      };
      this.attachWindowPointerListeners();
    },
    toLocal(clientX, clientY) {
      if (!this.bounds || !this.$refs.root) return { x: 0, y: 0 };
      const rect = this.$refs.root.getBoundingClientRect();
      return {
        x: clientX - rect.left - this.bounds.left,
        y: clientY - rect.top - this.bounds.top,
      };
    },
    insideBounds(p) {
      return this.bounds && p.x >= 0 && p.y >= 0 && p.x <= this.bounds.width && p.y <= this.bounds.height;
    },
    clamp01(v) {
      if (v < 0) return 0;
      if (v >= 1) return 0.999999;
      return v;
    },
  },
};
</script>
