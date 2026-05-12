// Side-by-side comparison of two dates with a shared scrubber.

import { buildImageUrl, COLLECTIONS, getImagesForDate, imageTimeOfDay } from "./api.js";
import {
  ensureAvailability, findNearestAvailable, getLastCollection,
  latestAvailable, setLastCollection,
} from "./state.js";
import { el, spinner, errorBanner, isoToday, addDays, parseIso, toIso, formatHM, toast } from "./ui.js";

function parseRoute(params) {
  let collection = getLastCollection();
  if (COLLECTIONS.includes(params[0])) {
    collection = params[0];
    params = params.slice(1);
  }
  const dateA = /^\d{4}-\d{2}-\d{2}$/.test(params[0] || "") ? params[0] : null;
  const dateB = /^\d{4}-\d{2}-\d{2}$/.test(params[1] || "") ? params[1] : null;
  return { collection, dateA, dateB };
}

function navUrl(collection, a, b) {
  return `#/compare/${collection}/${a}/${b}`;
}

export async function render(container, params) {
  const route = parseRoute(params);
  let { collection, dateA, dateB } = route;
  setLastCollection(collection);

  container.appendChild(buildHeader(collection, dateA, dateB));

  // Availability for default date pickers if user didn't supply both.
  let available;
  try {
    available = await ensureAvailability(collection);
  } catch (err) {
    container.appendChild(errorBanner(`Failed to fetch availability: ${err.message}`));
    return;
  }

  // Pick sensible defaults: most recent available date for this collection,
  // and the one 7 days prior (snapped to nearest available).
  if (!dateA || !dateB) {
    const anchor = latestAvailable(available) || isoToday();
    const aWeekAgo = toIso(addDays(parseIso(anchor), -7));
    const nearestWeekAgo = findNearestAvailable(available, aWeekAgo);
    if (!dateA) dateA = nearestWeekAgo || anchor;
    if (!dateB) dateB = anchor;
  }

  // Snap to available if needed.
  if (!available.has(dateA)) {
    const snap = findNearestAvailable(available, dateA);
    if (snap) {
      toast(`Snapped left side to nearest available: ${snap}`, "warn");
      dateA = snap;
    }
  }
  if (!available.has(dateB)) {
    const snap = findNearestAvailable(available, dateB);
    if (snap) {
      toast(`Snapped right side to nearest available: ${snap}`, "warn");
      dateB = snap;
    }
  }

  // Date pickers + collection select
  const controls = el("div", { class: "compare-controls" });
  const aInput = el("input", { type: "date", class: "date-input", value: dateA });
  const bInput = el("input", { type: "date", class: "date-input", value: dateB });
  controls.appendChild(el("div", { class: "controls" },
    el("span", { class: "cal-meta" }, "Left"),
    aInput,
  ));
  controls.appendChild(el("div", { class: "controls" },
    el("span", { class: "cal-meta" }, "Right"),
    bInput,
  ));
  container.appendChild(controls);

  const topRow = el("div", { class: "film-controls" },
    collectionSelect(collection, async (next) => {
      setLastCollection(next);
      // Re-anchor to that collection's latest data; otherwise switching cloud
      // (last data 2025-07-15) lands you on dates with no imagery.
      try {
        const nextAvail = await ensureAvailability(next);
        const anchor = latestAvailable(nextAvail);
        if (anchor) {
          const weekAgo = toIso(addDays(parseIso(anchor), -7));
          const left = findNearestAvailable(nextAvail, weekAgo) || anchor;
          toast(`Latest ${next}: ${anchor}`);
          location.hash = navUrl(next, left, anchor);
          return;
        }
      } catch {}
      location.hash = navUrl(next, dateA, dateB);
    }),
    el("button", {
      class: "btn btn-primary",
      onclick: () => {
        location.hash = navUrl(collection, aInput.value, bInput.value);
      },
    }, "Apply"),
    el("a", { class: "btn", href: "#/" }, "← Calendar"),
  );
  container.appendChild(topRow);

  // Stages
  const grid = el("div", { class: "compare-grid" });
  const sideA = makeSide(dateA, collection);
  const sideB = makeSide(dateB, collection);
  grid.appendChild(sideA.root);
  grid.appendChild(sideB.root);
  container.appendChild(grid);

  // Shared scrubber + match-mode toggle
  const shared = el("div", { class: "compare-shared" });
  const scrub = el("input", { type: "range", class: "scrub", min: "0", max: "0", value: "0", style: { flex: "1" } });
  const matchSelect = el("select", { class: "select" },
    el("option", { value: "index" }, "Match by index"),
    el("option", { value: "time" }, "Match by closest time of day"),
  );
  shared.append(scrub, matchSelect);
  container.appendChild(shared);

  // Load both sides in parallel.
  let imagesA, imagesB;
  try {
    [imagesA, imagesB] = await Promise.all([
      getImagesForDate(collection, dateA),
      getImagesForDate(collection, dateB),
    ]);
  } catch (err) {
    container.appendChild(errorBanner(`Failed to load images: ${err.message}`));
    return;
  }

  if (imagesA.length === 0 || imagesB.length === 0) {
    container.appendChild(errorBanner("One side has no imagery; can't compare."));
    return;
  }

  sideA.bind(imagesA);
  sideB.bind(imagesB);

  // Scrubber drives both sides. Max is the SHORTER of the two when matching
  // by index, and the longer when matching by time (we'll map indices).
  function refresh() {
    const mode = matchSelect.value;
    if (mode === "index") {
      const max = Math.min(imagesA.length, imagesB.length) - 1;
      scrub.max = String(Math.max(0, max));
      const i = Math.min(Number(scrub.value), max);
      sideA.showFrame(i);
      sideB.showFrame(i);
    } else {
      // Drive by left side; find nearest time on right side per left frame.
      scrub.max = String(imagesA.length - 1);
      const i = Math.min(Number(scrub.value), imagesA.length - 1);
      sideA.showFrame(i);
      const targetTOD = imageTimeOfDay(imagesA[i]);
      let bestJ = 0;
      let bestDiff = Infinity;
      for (let j = 0; j < imagesB.length; j++) {
        const tod = imageTimeOfDay(imagesB[j]);
        if (!tod || !targetTOD) continue;
        const diff = Math.abs(Number(tod) - Number(targetTOD));
        if (diff < bestDiff) { bestDiff = diff; bestJ = j; }
      }
      sideB.showFrame(bestJ);
    }
  }

  scrub.addEventListener("input", refresh);
  matchSelect.addEventListener("change", refresh);
  refresh();

  // Keyboard: ← → step scrub
  const keyHandler = (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.code === "ArrowLeft") { scrub.value = String(Math.max(0, Number(scrub.value) - 1)); refresh(); }
    if (e.code === "ArrowRight") { scrub.value = String(Math.min(Number(scrub.max), Number(scrub.value) + 1)); refresh(); }
  };
  window.addEventListener("keydown", keyHandler);
  const cleanup = () => {
    window.removeEventListener("keydown", keyHandler);
    window.removeEventListener("hashchange", cleanup);
  };
  window.addEventListener("hashchange", cleanup);
}

function makeSide(date, collection) {
  const wrap = el("div", { class: "day-image-wrap" });
  const img = el("img", { alt: "" });
  img.classList.add("active");
  wrap.appendChild(img);
  const caption = el("div", { class: "cal-meta", style: { marginTop: "0.4rem" } }, `${date} · —`);
  const root = el("section", { class: "compare-side" }, wrap, caption);
  let images = [];

  return {
    root,
    bind(imgs) { images = imgs; },
    showFrame(i) {
      const target = images[i];
      if (!target) return;
      const url = buildImageUrl(collection, target.date, target.image, "png");
      if (img.src !== url) img.src = url;
      caption.textContent = `${date} · frame ${i} · ${formatHM(target.date)}`;
    },
  };
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

function buildHeader(collection, a, b) {
  return el("header", { class: "view-header" },
    el("div", {},
      el("h2", { class: "view-title" },
        "Compare",
        el("small", {}, `${a || "—"} vs ${b || "—"} · ${collection}`),
      ),
    ),
  );
}
