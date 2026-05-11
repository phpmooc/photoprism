// Face-marker UI state-machine values. Shared between the lightbox
// (`PLightbox.faceMarkerMode`), the face-marker overlay (`mode` prop), and
// the sidebar info panel (which derives `markersVisible` / `addingMarker`
// booleans from these). `null` represents the inactive state; we don't
// give it a name because `null` is meaningful in itself.

// FaceMarkerDisplay shows read-only face boxes over the slide.
export const FaceMarkerDisplay = "display";

// FaceMarkerDraw enables drag-to-draw new face regions.
export const FaceMarkerDraw = "draw";

// FaceMarkerModes enumerates the non-null states the lightbox can be in.
// Useful for prop validators and exhaustive switches.
export const FaceMarkerModes = [FaceMarkerDisplay, FaceMarkerDraw];

// isFaceMarkerMode reports whether the given value is a valid non-null
// face-marker mode. Treats null/undefined as "inactive", not invalid.
export function isFaceMarkerMode(value) {
  return value === FaceMarkerDisplay || value === FaceMarkerDraw;
}
