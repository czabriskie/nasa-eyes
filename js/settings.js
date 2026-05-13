// Wire up the API-key settings dialog.

import { getApiKey, hasCustomApiKey, setApiKey } from "./api.js";
import { clearAvailabilityCache } from "./state.js";
import { toast } from "./ui.js";

function maskKey(key) {
  if (!key || key === "DEMO_KEY") return "DEMO_KEY";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function renderStatus(statusEl, currentEl) {
  const custom = hasCustomApiKey();
  const key = getApiKey();
  currentEl.textContent = custom ? maskKey(key) : "DEMO_KEY (shared, rate-limited)";
  statusEl.classList.toggle("custom", custom);
}

export function initSettingsUI() {
  const btn = document.getElementById("settings-btn");
  const dialog = document.getElementById("settings-dialog");
  if (!btn || !dialog) return;

  const input = dialog.querySelector("#api-key-input");
  const statusEl = dialog.querySelector("#settings-status");
  const currentEl = dialog.querySelector("#settings-current");
  const saveBtn = dialog.querySelector("#settings-save");
  const clearBtn = dialog.querySelector("#settings-clear");
  const closeBtn = dialog.querySelector("#settings-close");

  function open() {
    input.value = "";
    renderStatus(statusEl, currentEl);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    // Focus the input after the modal animates in.
    setTimeout(() => input.focus(), 50);
  }

  function close() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  saveBtn.addEventListener("click", () => {
    const value = input.value.trim();
    if (!value) {
      toast("Key field is empty. Paste a key or click 'Use DEMO_KEY'.", "warn");
      return;
    }
    setApiKey(value);
    // The new key changes our quota; clear availability cache so the next
    // request actually re-fetches via the new identity.
    clearAvailabilityCache();
    toast("Saved your personal NASA key.");
    renderStatus(statusEl, currentEl);
    close();
  });

  clearBtn.addEventListener("click", () => {
    setApiKey(null);
    clearAvailabilityCache();
    toast("Switched back to DEMO_KEY.");
    renderStatus(statusEl, currentEl);
  });

  // Close on Escape (native <dialog> already supports this, but kept for fallback).
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
}
