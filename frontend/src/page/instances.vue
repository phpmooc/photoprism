<template>
  <div class="p-page p-page-instances"></div>
</template>

<script>
// PPageInstances is a Community Edition stub for the Portal instance selector,
// which only exists as an overlay. CE has no cluster instances, so this base
// redirects to the default route instead of rendering a blank page.
export default {
  name: "PPageInstances",
  created() {
    this.$router.replace({ name: "home" });
  },
  mounted() {
    this.$view.enter(this);
  },
  unmounted() {
    this.$view.leave(this);
  },
  methods: {},
};
</script>
