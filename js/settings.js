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
  const modal = document.getElementById("settings-modal");
  if (!btn || !modal) {
    console.warn("[nasa-eyes] settings UI missing elements", { btn: !!btn, modal: !!modal });
    return;
  }

  const input = modal.querySelector("#api-key-input");
  const statusEl = modal.querySelector("#settings-status");
  const currentEl = modal.querySelector("#settings-current");
  const saveBtn = modal.querySelector("#settings-save");
  const clearBtn = modal.querySelector("#settings-clear");

  function open() {
    input.value = "";
    renderStatus(statusEl, currentEl);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => input.focus(), 30);
  }

  function close() {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  btn.addEventListener("click", open);

  // Anything with data-close (backdrop, Close button) dismisses the modal.
  modal.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.dataset.close === "1") close();
  });

  saveBtn.addEventListener("click", () => {
    const value = input.value.trim();
    if (!value) {
      toast("Key field is empty. Paste a key or click 'Use DEMO_KEY'.", "warn");
      return;
    }
    setApiKey(value);
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

  // Escape closes the modal when it's open.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) close();
  });
}
