<template>
  <div class="p-sidebar-inline-toolbar d-flex">
    <v-btn
      v-if="editing && canUndo"
      icon="mdi-undo-variant"
      density="compact"
      variant="plain"
      size="x-small"
      class="meta-inline-undo"
      :title="$gettext('Undo')"
      @mousedown.prevent
      @click.stop="$emit('undo')"
    ></v-btn>
    <v-btn
      v-if="editing"
      icon="mdi-content-save"
      density="compact"
      variant="plain"
      size="x-small"
      class="meta-inline-confirm"
      :title="$gettext('Save')"
      @mousedown.prevent
      @click.stop="$emit('confirm')"
    ></v-btn>
    <v-btn
      v-else
      icon="mdi-pencil-outline"
      density="compact"
      variant="plain"
      size="x-small"
      :title="$gettext('Edit')"
      class="meta-inline-pencil"
      @click.stop="$emit('start')"
    ></v-btn>
  </div>
</template>

<script>
export default {
  name: "PSidebarInlineToolbar",
  props: {
    editing: {
      type: Boolean,
      default: false,
    },
    // Shows an Undo icon when true and `editing` is also true.
    canUndo: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["confirm", "start", "undo"],
};
</script>
