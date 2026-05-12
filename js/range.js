// Range view: a filmstrip of thumbnails across multiple days, with a scrubber.

import { buildImageUrl, COLLECTIONS, getImagesForDate } from "./api.js";
import { ensureAvailability } from "./state.js";
import {
  el, spinner, errorBanner, isoToday, parseIso, toIso, addDays,
  withConcurrency, formatHM,
} from "./ui.js";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 30;

function parseRoute(params) {
  // [collection?, "YYYY-MM-DD"?, "YYYY-MM-DD"?]
  const today = isoToday();
  let collection = "natural";
  if (COLLECTIONS.includes(params[0])) {
    collection = params[0];
    params = params.slice(1);
  }
  let end = today;
  let start = toIso(addDays(parseIso(today), -(DEFAULT_DAYS - 1)));
  if (/^\d{4}-\d{2}-\d{2}$/.test(params[0] || "")) start = params[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(params[1] || "")) end = params[1];
  return { collection, start, end };
}

function clampRange(start, end) {
  let s = parseIso(start);
  let e = parseIso(end);
  if (s > e) [s, e] = [e, s];
  const days = Math.floor((e - s) / 86400000) + 1;
  if (days > MAX_DAYS) {
    s = addDays(e, -(MAX_DAYS - 1));
  }
  return { start: toIso(s), end: toIso(e) };
}

function navUrl(collection, start, end) {
  return `#/range/${collection}/${start}/${end}`;
}

export async function render(container, params) {
  const route = parseRoute(params);
  const { start, end } = clampRange(route.start, route.end);
  const { collection } = route;

  container.appendChild(buildHeader(collection, start, end));

  // Inline controls (collection + start/end pickers).
  const controls = el("div", { class: "film-controls" });
  controls.appendChild(collectionSelect(collection, (next) => {
    location.hash = navUrl(next, start, end);
  }));
  const startInput = el("input", { type: "date", class: "date-input", value: start });
  const endInput = el("input", { type: "date", class: "date-input", value: end });
  controls.append(
    el("span", { class: "cal-meta" }, "From"),
    startInput,
    el("span", { class: "cal-meta" }, "to"),
    endInput,
    el("button", {
      class: "btn btn-primary",
      onclick: () => {
        location.hash = navUrl(collection, startInput.value, endInput.value);
      },
    }, "Apply"),
  );
  container.appendChild(controls);

  // Filmstrip placeholder
  const strip = el("div", { class: "filmstrip" });
  container.appendChild(strip);

  // Scrubber
  const scrubWrap = el("div", { class: "film-controls" });
  const scrub = el("input", { type: "range", class: "scrub", min: "0", max: "0", value: "0", style: { flex: "1" } });
  const info = el("span", { class: "film-info" }, "Loading…");
  scrubWrap.append(scrub, info);
  container.appendChild(scrubWrap);

  // Resolve which dates in [start, end] are available.
  let available;
  try {
    available = await ensureAvailability(collection);
  } catch (err) {
    strip.replaceWith(errorBanner(`Failed to fetch availability: ${err.message}`));
    return;
  }

  const days = [];
  for (let d = parseIso(start); d <= parseIso(end); d = addDays(d, 1)) {
    const iso = toIso(d);
    days.push({ iso, available: available.has(iso) });
  }
  const presentDays = days.filter((d) => d.available);

  if (presentDays.length === 0) {
    strip.replaceWith(errorBanner(`No ${collection} imagery in ${start} → ${end}. Try a wider range.`));
    info.textContent = "No frames.";
    return;
  }

  // Fetch image lists for available days, capped concurrency.
  info.innerHTML = `<span class="spinner"></span> Fetching ${presentDays.length} day${presentDays.length === 1 ? "" : "s"}…`;
  const dayImages = await withConcurrency(presentDays, 4, async (day) => {
    try {
      const imgs = await getImagesForDate(collection, day.iso);
      return { iso: day.iso, images: imgs };
    } catch (err) {
      return { iso: day.iso, images: [], error: err.message };
    }
  });

  // Build a flat array of frames + day-divider markers for the filmstrip.
  const frames = [];
  for (const dayBlock of dayImages) {
    if (frames.length > 0) frames.push({ divider: true });
    for (const img of dayBlock.images) {
      frames.push({
        iso: dayBlock.iso,
        image: img,
        thumb: buildImageUrl(collection, img.date, img.image, "thumbs"),
        png: buildImageUrl(collection, img.date, img.image, "png"),
      });
    }
  }

  // Render frames lazily with IntersectionObserver.
  const imageFrames = frames.filter((f) => !f.divider);
  scrub.max = String(Math.max(imageFrames.length - 1, 0));
  info.textContent = `${imageFrames.length} frames across ${dayImages.length} day${dayImages.length === 1 ? "" : "s"}`;

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target.querySelector("img");
      if (img && !img.src) {
        img.src = img.dataset.src;
        img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
        io.unobserve(entry.target);
      }
    }
  }, { root: strip, rootMargin: "200px" });

  const frameEls = [];
  let frameCursor = 0;
  for (const f of frames) {
    if (f.divider) {
      strip.appendChild(el("div", { class: "film-day-divider" }));
      continue;
    }
    const i = frameCursor++;
    const node = el("button", {
      class: "film-frame",
      onclick: () => { location.hash = `#/day/${collection}/${f.iso}`; },
      title: `${f.iso} ${formatHM(f.image.date)} — open day view`,
    },
      el("img", { alt: `${f.iso} ${formatHM(f.image.date)}`, "data-src": f.thumb }),
      el("div", { class: "frame-label" }, `${f.iso.slice(5)} ${formatHM(f.image.date)}`),
    );
    strip.appendChild(node);
    frameEls.push(node);
    io.observe(node);
  }

  function highlightFrame(i) {
    const node = frameEls[i];
    if (!node) return;
    for (const n of frameEls) n.classList.remove("active");
    node.classList.add("active");
    node.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  scrub.addEventListener("input", () => highlightFrame(Number(scrub.value)));
  if (frameEls.length > 0) highlightFrame(0);
}

function buildHeader(collection, start, end) {
  const days = Math.floor((parseIso(end) - parseIso(start)) / 86400000) + 1;
  return el("header", { class: "view-header" },
    el("div", {},
      el("h2", { class: "view-title" },
        `${start} → ${end}`,
        el("small", {}, `${days} day${days === 1 ? "" : "s"} · ${collection}`),
      ),
    ),
    el("div", { class: "controls" },
      el("a", { class: "btn", href: "#/" }, "← Calendar"),
    ),
  );
}

function collectionSelect(current, onChange) {
  const sel = el("select", { class: "select", onchange: (e) => onChange(e.target.value) });
  for (const c of COLLECTIONS) {
    const opt = el("option", { value: c }, c);
    if (c === current) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}
