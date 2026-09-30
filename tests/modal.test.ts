import { expect, test } from "bun:test";
import { initEventModal } from "../src/lib/event-modal";
test("modal controller traps focus, handles native cancel and returns focus", () => {
  // Simulate the browser's dialog cancel event. This proves controller behavior,
  // not browser rendering or the browser's native Escape implementation.
  let active: ElementDouble | null = null;
  const getActive = (): ElementDouble | null => active;
  class ElementDouble extends EventTarget {
    dataset: Record<string, string> = {};
    style = { overflow: "" };
    textContent = "";
    className = "";
    hidden = false;
    isConnected = true;
    scrollTop = 0;
    open = false;
    href = "";
    src = "";
    alt = "";
    children: ElementDouble[] = [];
    focus() {
      active = this;
    }
    getClientRects() {
      return [1];
    }
    toggleAttribute() {
      return true;
    }
    replaceChildren(...items: ElementDouble[]) {
      this.children = items;
    }
    querySelectorAll() {
      return [close, link];
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    }
  }
  const ids = new Map<string, ElementDouble>();
  for (const id of [
    "event-modal",
    "modal-content",
    "close-modal",
    "modal-backdrop",
    "modal-title",
    "modal-desc",
    "modal-city",
    "modal-date",
    "modal-price",
    "modal-instructions-title",
    "modal-instructions-list",
    "modal-btn-text",
    "modal-img",
    "modal-image-container",
    "modal-details",
    "modal-link",
  ])
    ids.set(id, new ElementDouble());
  const modal = ids.get("event-modal")!,
    close = ids.get("close-modal")!,
    link = ids.get("modal-link")!,
    opener = new ElementDouble(),
    body = new ElementDouble();
  opener.dataset = {
    title: "<img src=x onerror=alert(1)>",
    desc: "Details",
    kind: "COURSE",
    priceStatus: "UNKNOWN",
    price: "Check price",
    url: "https://www.coursera.org/learn/test",
  };
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document"),
    oldLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body,
      get activeElement() {
        return active;
      },
      getElementById: (id: string) => ids.get(id),
      querySelector: (selector: string) => ids.get(selector.slice(1)),
      querySelectorAll: () => [opener],
      createElement: () => new ElementDouble(),
    },
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { pathname: "/en/" },
  });
  try {
    initEventModal();
    opener.dispatchEvent(new Event("click"));
    expect(modal.open).toBe(true);
    expect(getActive()).toBe(close);
    expect(body.style.overflow).toBe("hidden");
    expect(ids.get("modal-title")!.textContent).toBe(opener.dataset.title);
    expect(ids.get("modal-image-container")!.hidden).toBe(true);
    expect(ids.get("modal-instructions-title")!.textContent).toBe(
      "How to join the course",
    );
    link.focus();
    const tab = Object.assign(new Event("keydown", { cancelable: true }), {
      key: "Tab",
      shiftKey: false,
    });
    modal.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(getActive()).toBe(close);
    const shiftTab = Object.assign(new Event("keydown", { cancelable: true }), {
      key: "Tab",
      shiftKey: true,
    });
    modal.dispatchEvent(shiftTab);
    expect(getActive()).toBe(link);
    modal.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(modal.open).toBe(false);
    expect(getActive()).toBe(opener);
    expect(body.style.overflow).toBe("");
  } finally {
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (oldLocation) Object.defineProperty(globalThis, "location", oldLocation);
    else Reflect.deleteProperty(globalThis, "location");
  }
});
