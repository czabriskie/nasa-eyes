// Small UI helpers shared across views.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function isoToday() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

export function isoFromParts(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function parseIso(s) {
  // Treat as UTC midnight for stable arithmetic regardless of viewer TZ.
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export function toIso(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function monthName(monthIndex0) {
  return MONTHS[monthIndex0];
}

export function dowShort(dowIndex) {
  return DOW_SHORT[dowIndex];
}

export function spinner(text = "Loading…") {
  const div = document.createElement("div");
  div.className = "status";
  div.innerHTML = `<span class="spinner"></span>${text}`;
  return div;
}

export function errorBanner(text) {
  const div = document.createElement("div");
  div.className = "status";
  div.style.color = "var(--magenta)";
  div.textContent = text;
  return div;
}

let toastTimer = null;
export function toast(message, kind = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${kind === "info" ? "" : kind}`.trim();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast"; }, 3200);
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k === "html") node.innerHTML = v;
    else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

// Format the API's "YYYY-MM-DD HH:MM:SS" → "HH:MM UTC"
export function formatHM(dateTimeField) {
  if (!dateTimeField) return "";
  const time = dateTimeField.includes(" ") ? dateTimeField.split(" ")[1] : "";
  return time.slice(0, 5) + " UTC";
}

// Yield items in batches, awaiting each. Used for the day animation preloader
// and the range view to throttle requests.
export async function withConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function pump() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, pump));
  return results;
}

// Preload an <img> URL. Resolves with the URL whether or not it succeeded.
export function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ url, ok: true });
    img.onerror = () => resolve({ url, ok: false });
    img.src = url;
  });
}
