// Month-grid calendar with gap-aware day cells.

import { COLLECTIONS } from "./api.js";
import { ensureAvailability } from "./state.js";
import {
  spinner, errorBanner, el, isoToday, parseIso, toIso,
  pad2, monthName, dowShort,
} from "./ui.js";

function defaultMonth() {
  const d = new Date();
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, collection: "natural" };
}

function parseRouteParams(params) {
  // params: [collection?, "YYYY-MM"?]
  const out = defaultMonth();
  if (params.length === 0) return out;
  if (COLLECTIONS.includes(params[0])) {
    out.collection = params[0];
    params = params.slice(1);
  }
  if (params[0] && /^\d{4}-\d{2}$/.test(params[0])) {
    const [y, m] = params[0].split("-").map(Number);
    out.y = y;
    out.m = m;
  }
  return out;
}

function navUrl(collection, y, m) {
  return `#/cal/${collection}/${y}-${pad2(m)}`;
}

function shiftMonth(y, m, delta) {
  let nm = m + delta;
  let ny = y;
  while (nm < 1) { nm += 12; ny -= 1; }
  while (nm > 12) { nm -= 12; ny += 1; }
  return [ny, nm];
}

export async function render(container, params) {
  const { collection, y, m } = parseRouteParams(params);

  container.appendChild(spinner(`Loading ${collection} availability…`));
  let available;
  try {
    available = await ensureAvailability(collection);
  } catch (err) {
    container.replaceChildren(errorBanner(`Failed to load availability: ${err.message}`));
    return;
  }
  container.replaceChildren();

  // Header
  const today = isoToday();
  const monthFirst = new Date(Date.UTC(y, m - 1, 1));
  const startDow = monthFirst.getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  // Count availability for the month
  let presentCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (available.has(`${y}-${pad2(m)}-${pad2(d)}`)) presentCount++;
  }

  const header = el("header", { class: "view-header" },
    el("div", {},
      el("h2", { class: "view-title" },
        `${monthName(m - 1)} ${y}`,
        el("small", {}, `${presentCount} / ${daysInMonth} days with imagery · ${collection}`),
      ),
    ),
    el("div", { class: "controls" },
      collectionSelect(collection, (next) => location.hash = navUrl(next, y, m)),
      el("button", {
        class: "btn",
        onclick: () => {
          const [ny, nm] = shiftMonth(y, m, -1);
          location.hash = navUrl(collection, ny, nm);
        },
      }, "← Prev"),
      el("button", {
        class: "btn",
        onclick: () => {
          const t = new Date();
          location.hash = navUrl(collection, t.getUTCFullYear(), t.getUTCMonth() + 1);
        },
      }, "Today"),
      el("button", {
        class: "btn",
        onclick: () => {
          const [ny, nm] = shiftMonth(y, m, 1);
          location.hash = navUrl(collection, ny, nm);
        },
      }, "Next →"),
    ),
  );
  container.appendChild(header);

  // Grid
  const grid = el("div", { class: "cal-grid", role: "grid" });
  for (let i = 0; i < 7; i++) {
    grid.appendChild(el("div", { class: "cal-dow", role: "columnheader" }, dowShort(i)));
  }

  // Leading blanks for days from the previous month (visual padding)
  for (let i = 0; i < startDow; i++) {
    grid.appendChild(el("div", { class: "cal-cell outside" }));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${pad2(m)}-${pad2(d)}`;
    const isAvail = available.has(iso);
    const isToday = iso === today;
    const cellClass = ["cal-cell"];
    if (isAvail) cellClass.push("available");
    else cellClass.push("gap");
    if (isToday) cellClass.push("today");

    const cell = el(isAvail ? "button" : "div", {
      class: cellClass.join(" "),
      role: "gridcell",
      "aria-label": `${iso}${isAvail ? "" : " (no imagery)"}${isToday ? " (today)" : ""}`,
      ...(isAvail
        ? { onclick: () => { location.hash = `#/day/${collection}/${iso}`; } }
        : {}),
    },
      el("div", { class: "day-num" }, String(d)),
      el("div", { class: "day-tag" }, isAvail ? "imagery" : "—"),
    );
    grid.appendChild(cell);
  }

  // Trailing blanks
  const cells = startDow + daysInMonth;
  const trailing = (7 - (cells % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    grid.appendChild(el("div", { class: "cal-cell outside" }));
  }

  container.appendChild(grid);

  // Footer hint
  container.appendChild(el("p", { class: "cal-meta", style: { marginTop: "1.2rem" } },
    "Tip: gray cells are days NASA EPIC did not capture imagery. Click any colored cell to play that day as an Earth-rotation animation.",
  ));
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
