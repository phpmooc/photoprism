<template>
  <v-icon
    v-if="editing && canUndo"
    icon="mdi-undo-variant"
    size="small"
    class="meta-inline-undo"
    :title="$gettext('Undo')"
    @mousedown.prevent
    @click.stop="$emit('undo')"
  ></v-icon>
  <v-icon v-if="editing" icon="mdi-check" size="small" class="meta-inline-confirm" @mousedown.prevent @click.stop="$emit('confirm')"></v-icon>
  <v-icon v-else icon="mdi-pencil-outline" size="small" class="meta-inline-pencil" @click.stop="$emit('start')"></v-icon>
</template>

<script>
export default {
  name: "PSidebarInlineToolbar",
  props: {
    editing: {
      type: Boolean,
      default: false,
    },
    // Show an Undo icon next to the confirm check when true. Only takes
    // effect while `editing` is also true. Consumers that batch staged
    // mutations (e.g., chip-section removals) pass `canUndo` so users can
    // revert before the parent commits.
    canUndo: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["confirm", "start", "undo"],
};
</script>
