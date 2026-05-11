import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import PInputChipSelector from "component/input/chip-selector.vue";

describe("component/file/chip-selector", () => {
  let wrapper;

  const mockItems = [
    { value: "album1", title: "Album 1", mixed: false, action: "none" },
    { value: "album2", title: "Album 2", mixed: true, action: "add" },
    { value: "album3", title: "Album 3", mixed: false, action: "remove" },
  ];

  const mockAvailableItems = [
    { value: "album1", title: "Album 1" },
    { value: "album2", title: "Album 2" },
    { value: "album3", title: "Album 3" },
    { value: "album4", title: "Album 4" },
  ];

  beforeEach(() => {
    const VIconStub = {
      name: "VIcon",
      props: ["icon"],
      template: '<i class="chip__icon"><slot />{{ icon }}</i>',
    };

    const VTooltipStub = {
      name: "VTooltip",
      props: ["text", "location"],
      template: '<div class="v-tooltip-stub"><slot name="activator" :props="{}"></slot><slot /></div>',
    };

    wrapper = mount(PInputChipSelector, {
      props: {
        items: mockItems,
        availableItems: mockAvailableItems,
        allowCreate: true,
        emptyText: "No items",
        inputPlaceholder: "Enter item name...",
      },
      global: {
        stubs: {
          VIcon: VIconStub,
          VTooltip: VTooltipStub,
        },
        mocks: {
          $gettext: (s) => s,
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Component Rendering", () => {
    it("should show empty text and hide input when allowCreate is false and no items", async () => {
      await wrapper.setProps({ items: [], allowCreate: false });

      const emptyDiv = wrapper.find(".chip-selector__empty");
      expect(emptyDiv.exists()).toBe(true);
      expect(emptyDiv.text()).toBe("No items");
      expect(wrapper.find(".chip-selector__input-container").exists()).toBe(false);
    });
  });

  describe("Chip Icons", () => {
    it.each([
      { idx: 0, expectedClass: "chip--gray", expectedIcon: null },
      { idx: 1, expectedClass: "chip--green-light", expectedIcon: "mdi-plus" },
      { idx: 2, expectedClass: "chip--red", expectedIcon: "mdi-minus" },
    ])("should render expected style/icon for chip at index $idx", ({ idx, expectedClass, expectedIcon }) => {
      const chips = wrapper.findAll(".chip");
      const chip = chips[idx];
      expect(chip.find(".chip__text").exists()).toBe(true);
      expect(chip.classes()).toContain(expectedClass);

      const icon = chip.find(".chip__icon");
      if (expectedIcon) {
        expect(icon.exists()).toBe(true);
        expect(icon.text()).toBe(expectedIcon);
      } else {
        expect(icon.exists()).toBe(false);
      }
    });

    it("should show half-circle icon for mixed state without action", async () => {
      const mixedItem = { value: "mixed1", title: "Mixed Item", mixed: true, action: "none" };
      await wrapper.setProps({ items: [mixedItem] });

      const chip = wrapper.find(".chip");
      const icon = chip.find(".chip__icon");
      expect(icon.exists()).toBe(true);
      expect(icon.text()).toBe("mdi-circle-half-full");
    });
  });

  describe("Chip Interactions", () => {
    it("should emit update:items when chip is clicked", async () => {
      const chip = wrapper.findAll(".chip")[0]; // First chip (action: none)
      await chip.trigger("click");

      const emitted = wrapper.emitted("update:items");
      expect(emitted).toBeTruthy();
      expect(emitted[0][0]).toEqual(expect.arrayContaining([expect.objectContaining({ value: "album1", action: "remove" })]));
    });

    it.each(["keydown.enter", "keydown.space"])("should handle keyboard interactions (%s)", async (evt) => {
      const chip = wrapper.findAll(".chip")[0];
      await chip.trigger(evt);
      const emitted = wrapper.emitted("update:items");
      expect(emitted).toBeTruthy();
    });

    it.each([
      { prop: "loading", value: true },
      { prop: "disabled", value: true },
    ])("should not respond to clicks when %s", async ({ prop, value }) => {
      await wrapper.setProps({ [prop]: value });
      const chip = wrapper.findAll(".chip")[0];
      await chip.trigger("click");
      expect(wrapper.emitted("update:items")).toBeFalsy();
    });
  });

  describe("Chip Action Cycling", () => {
    it("should cycle through actions correctly for mixed items", async () => {
      const mixedItem = { value: "mixed1", title: "Mixed Item", mixed: true, action: "none" };
      await wrapper.setProps({ items: [mixedItem] });

      const chip = wrapper.find(".chip");

      // First click: none -> add
      await chip.trigger("click");
      let emitted = wrapper.emitted("update:items");
      expect(emitted[0][0][0].action).toBe("add");

      // Update props to simulate the new state
      await wrapper.setProps({ items: [{ ...mixedItem, action: "add" }] });

      // Second click: add -> remove
      await chip.trigger("click");
      emitted = wrapper.emitted("update:items");
      expect(emitted[1][0][0].action).toBe("remove");

      // Update props again
      await wrapper.setProps({ items: [{ ...mixedItem, action: "remove" }] });

      // Third click: remove -> none
      await chip.trigger("click");
      emitted = wrapper.emitted("update:items");
      expect(emitted[2][0][0].action).toBe("none");
    });

    it("should handle new item removal correctly", async () => {
      const newItem = { value: "", title: "New Item", mixed: false, action: "add", isNew: true };
      await wrapper.setProps({ items: [newItem] });

      const chip = wrapper.find(".chip");
      await chip.trigger("click");

      const emitted = wrapper.emitted("update:items");
      expect(emitted[0][0]).toEqual([]); // Item should be completely removed
    });
  });

  describe("Input Functionality", () => {
    it("should add new item when Enter is pressed with text input", async () => {
      const combobox = wrapper.findComponent({ name: "VCombobox" });

      // Set the input value
      wrapper.vm.newItemTitle = "New Album";
      await nextTick();

      // Trigger enter key
      await combobox.trigger("keydown.enter");

      const emitted = wrapper.emitted("update:items");
      expect(emitted).toBeTruthy();
      expect(emitted[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "New Album",
            action: "add",
            isNew: true,
            mixed: false,
            value: "",
          }),
        ])
      );
    });

    it("should handle combobox selection change", async () => {
      const combobox = wrapper.findComponent({ name: "VCombobox" });
      const selectedItem = { value: "album4", title: "Album 4" };

      await combobox.vm.$emit("update:model-value", selectedItem);

      const emitted = wrapper.emitted("update:items");
      expect(emitted).toBeTruthy();
      expect(emitted[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            value: "album4",
            title: "Album 4",
            action: "add",
            isNew: true,
          }),
        ])
      );
    });

    it("should not add duplicate items", async () => {
      const combobox = wrapper.findComponent({ name: "VCombobox" });

      // Try to add an existing item
      wrapper.vm.newItemTitle = "Album 1"; // This already exists
      await combobox.trigger("keydown.enter");

      // Should not emit update:items for duplicate
      expect(wrapper.emitted("update:items")).toBeFalsy();
    });

    it("should not add empty items", async () => {
      const combobox = wrapper.findComponent({ name: "VCombobox" });

      wrapper.vm.newItemTitle = "   "; // Empty/whitespace string
      await combobox.trigger("keydown.enter");

      expect(wrapper.emitted("update:items")).toBeFalsy();
    });

    // Repros the user-reported regression: typing `ca` and pressing ArrowDown
    // used to commit `ca` as a brand-new chip before the user could pick
    // `Camping` from the dropdown. The trigger is `@blur` firing on the
    // input as Vuetify shifts DOM focus into the teleported v-list-item
    // menu. onInputBlur skips the commit when relatedTarget is a menu item.
    it("skips addNewItem on blur when focus shifts into the dropdown menu (ArrowDown)", () => {
      wrapper.vm.newItemTitle = "ca";

      // relatedTarget mimics the v-list-item Vuetify focuses on ArrowDown.
      const menuItem = document.createElement("div");
      menuItem.className = "v-list-item v-list-item--link";

      wrapper.vm.onInputBlur({ relatedTarget: menuItem });

      expect(wrapper.emitted("update:items")).toBeFalsy();
    });

    it("skips addNewItem on blur when relatedTarget is inside a v-overlay-container", () => {
      wrapper.vm.newItemTitle = "ca";

      // Some Vuetify menu items render under .v-overlay-container without
      // the v-list-item class on the focused descendant; assert the ancestor
      // check catches them too.
      const overlay = document.createElement("div");
      overlay.className = "v-overlay-container";
      const focusableInside = document.createElement("div");
      overlay.appendChild(focusableInside);
      document.body.appendChild(overlay);

      try {
        wrapper.vm.onInputBlur({ relatedTarget: focusableInside });
        expect(wrapper.emitted("update:items")).toBeFalsy();
      } finally {
        document.body.removeChild(overlay);
      }
    });

    it("commits pending text on blur when relatedTarget is outside the dropdown menu", () => {
      wrapper.vm.newItemTitle = "Manually-Typed";

      // Tabbing to a sibling field — relatedTarget has no v-list-item /
      // v-overlay-container ancestry. The blur should still commit.
      const sibling = document.createElement("button");
      sibling.className = "some-other-button";

      wrapper.vm.onInputBlur({ relatedTarget: sibling });

      const emitted = wrapper.emitted("update:items");
      expect(emitted).toBeTruthy();
      expect(emitted[0][0]).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Manually-Typed", action: "add", isNew: true })]));
    });
  });

  describe("Label resolver and normalization", () => {
    it("resolves 'cat' → 'Katze' and sets mixed chip to add", async () => {
      const wrapper = mount(PInputChipSelector, {
        props: {
          items: [{ value: "l1", title: "Katze", mixed: true, action: "none" }],
          availableItems: [{ value: "l1", title: "Katze" }],
          allowCreate: true,
          resolveItemFromText: (txt) => (txt.toLowerCase() === "cat" ? { value: "l1", title: "Katze" } : null),
        },
        global: {
          stubs: { VIcon: true, VTooltip: true },
          mocks: { $gettext: (s) => s },
        },
      });

      wrapper.vm.newItemTitle = "cat";
      await wrapper.vm.addNewItem();

      const emitted = wrapper.emitted("update:items")?.at(-1)?.[0];
      expect(emitted).toBeTruthy();
      const katze = emitted.find((i) => i.title === "Katze");
      expect(katze.action).toBe("add");
      wrapper.unmount();
    });

    it("re-typing existing chip clears input and does not add a duplicate", async () => {
      vi.useFakeTimers();
      const wrapper = mount(PInputChipSelector, {
        props: {
          items: [{ value: "l1", title: "Katze", mixed: false, action: "add" }],
          availableItems: [{ value: "l1", title: "Katze" }],
          allowCreate: true,
        },
        global: {
          stubs: { VIcon: true, VTooltip: true },
          mocks: { $gettext: (s) => s },
        },
      });

      wrapper.vm.newItemTitle = "Katze";
      await wrapper.vm.addNewItem();
      await vi.runAllTimersAsync();
      await nextTick();
      expect(wrapper.vm.newItemTitle).toBeNull();
      expect(wrapper.emitted("update:items")).toBeFalsy();
      wrapper.unmount();
    });

    it("normalizes 'fire+station' → 'Fire Station' via resolver and sets to add", async () => {
      const wrapper = mount(PInputChipSelector, {
        props: {
          items: [{ value: "l2", title: "Fire Station", mixed: true, action: "none" }],
          availableItems: [{ value: "l2", title: "Fire Station" }],
          allowCreate: true,
          resolveItemFromText: (txt) =>
            txt
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, " ")
              .trim() === "fire station"
              ? { value: "l2", title: "Fire Station" }
              : null,
        },
        global: {
          stubs: { VIcon: true, VTooltip: true },
          mocks: { $gettext: (s) => s },
        },
      });

      wrapper.vm.newItemTitle = "fire+station";
      await wrapper.vm.addNewItem();

      const emitted = wrapper.emitted("update:items")?.at(-1)?.[0];
      expect(emitted).toBeTruthy();
      const fs = emitted.find((i) => i.title === "Fire Station");
      expect(fs.action).toBe("add");
      wrapper.unmount();
    });

    it("adds unmatched free text as isNew: true with action 'add'", async () => {
      const wrapper = mount(PInputChipSelector, {
        props: {
          items: [],
          availableItems: [],
          allowCreate: true,
        },
        global: {
          stubs: { VIcon: true, VTooltip: true },
          mocks: { $gettext: (s) => s },
        },
      });

      wrapper.vm.newItemTitle = "Completely New";
      await wrapper.vm.addNewItem();

      const emitted = wrapper.emitted("update:items")?.at(-1)?.[0];
      expect(emitted).toBeTruthy();
      const created = emitted.find((i) => i.title === "Completely New");
      expect(created).toMatchObject({ isNew: true, action: "add" });
      wrapper.unmount();
    });
  });

  describe("Computed Properties", () => {
    it("should process items correctly", () => {
      const processed = wrapper.vm.processedItems;

      expect(processed).toHaveLength(3);
      expect(processed[0]).toMatchObject({
        value: "album1",
        title: "Album 1",
        action: "none",
        selected: false,
      });
      expect(processed[1]).toMatchObject({
        value: "album2",
        title: "Album 2",
        action: "add",
        selected: true,
      });
    });

    it("should determine when to render chips correctly", async () => {
      expect(wrapper.vm.shouldRenderChips).toBe(true);

      // When no items and input is shown, should not render chips container
      await wrapper.setProps({ items: [] });
      expect(wrapper.vm.shouldRenderChips).toBe(false);
    });
  });
});
