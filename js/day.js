// Single-day Earth-rotation animation player.

import { buildImageUrl, COLLECTIONS, getImagesForDate } from "./api.js";
import { ensureAvailability, getLastCollection, setLastCollection } from "./state.js";
import { el, spinner, errorBanner, formatHM, preloadImage, withConcurrency } from "./ui.js";

const DEFAULT_FPS = 1.5;
const MIN_FPS = 0.5;
const MAX_FPS = 6;
const FPS_STEP = 0.5;

function parseRoute(params) {
  // [collection, "YYYY-MM-DD"]
  const collection = COLLECTIONS.includes(params[0]) ? params[0] : getLastCollection();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params[1] || "") ? params[1] : null;
  return { collection, date };
}

export async function render(container, params) {
  const { collection, date } = parseRoute(params);
  setLastCollection(collection);
  if (!date) {
    container.appendChild(errorBanner("Missing date in URL. Try #/day/natural/2025-07-10"));
    return;
  }

  container.appendChild(spinner(`Loading ${collection} images for ${date}…`));

  let images;
  try {
    images = await getImagesForDate(collection, date);
  } catch (err) {
    container.replaceChildren(errorBanner(`Failed to fetch images: ${err.message}`));
    return;
  }

  // Also kick off an availability fetch so the calendar back-link feels snappy.
  ensureAvailability(collection).catch(() => {});

  if (!images || images.length === 0) {
    container.replaceChildren(buildHeader(collection, date, 0),
      errorBanner(`No ${collection} images for ${date}.`),
    );
    return;
  }

  container.replaceChildren(buildHeader(collection, date, images.length));

  // Stage
  const stage = el("div", { class: "day-stage" });
  const imageWrap = el("div", { class: "day-image-wrap" });
  const progress = el("div", { class: "day-progress" }, el("span", { style: { width: "0%" } }));
  imageWrap.appendChild(progress);

  // Use two <img> elements to crossfade between frames.
  const imgA = el("img", { alt: "" });
  const imgB = el("img", { alt: "" });
  imageWrap.appendChild(imgA);
  imageWrap.appendChild(imgB);

  const hud = buildHud();
  stage.appendChild(imageWrap);
  stage.appendChild(hud.root);
  container.appendChild(stage);

  // Controls
  const controls = el("div", { class: "day-controls" });
  const playBtn = el("button", { class: "btn btn-primary" }, "▶ Play");
  const prevBtn = el("button", { class: "btn" }, "‹");
  const nextBtn = el("button", { class: "btn" }, "›");
  const scrub = el("input", { type: "range", class: "scrub", min: "0", max: String(images.length - 1), value: "0" });
  const fpsWrap = el("label", { class: "controls", style: { gap: "0.4rem" } },
    el("span", { class: "hud-row", style: { fontSize: "0.75rem", color: "var(--fg-2)" } }, "FPS"),
  );
  const fps = el("input", {
    type: "range", class: "scrub",
    min: String(MIN_FPS), max: String(MAX_FPS), step: String(FPS_STEP),
    value: String(DEFAULT_FPS), style: { width: "120px" },
  });
  fpsWrap.appendChild(fps);
  controls.append(playBtn, prevBtn, scrub, nextBtn, fpsWrap);
  container.appendChild(controls);

  // Preload all images, updating progress as we go.
  const urls = images.map((img) => buildImageUrl(collection, img.date, img.image, "png"));
  let loaded = 0;
  const onProgress = () => {
    loaded++;
    progress.firstElementChild.style.width = `${(loaded / urls.length) * 100}%`;
  };
  // Concurrency limited so the browser doesn't open all sockets at once.
  withConcurrency(urls, 4, async (u) => {
    const r = await preloadImage(u);
    onProgress();
    return r;
  });

  // Show frame N. Crossfade between two <img> elements.
  let currentIndex = -1;
  let useB = false;
  function showFrame(i) {
    i = Math.max(0, Math.min(images.length - 1, i));
    if (i === currentIndex) return;
    currentIndex = i;
    const target = useB ? imgB : imgA;
    const other = useB ? imgA : imgB;
    target.src = urls[i];
    target.classList.add("active");
    other.classList.remove("active");
    useB = !useB;

    scrub.value = String(i);
    hud.update(images[i], i, images.length, collection);
  }

  // Animation
  let playing = false;
  let rafToken = null;
  let lastTick = 0;
  function tick(ts) {
    if (!playing) return;
    const fpsVal = Number(fps.value) || DEFAULT_FPS;
    const interval = 1000 / fpsVal;
    if (ts - lastTick >= interval) {
      lastTick = ts;
      const next = (currentIndex + 1) % images.length;
      showFrame(next);
    }
    rafToken = requestAnimationFrame(tick);
  }
  function play() {
    if (playing) return;
    playing = true;
    playBtn.textContent = "❚❚ Pause";
    lastTick = performance.now();
    rafToken = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    playBtn.textContent = "▶ Play";
    if (rafToken) cancelAnimationFrame(rafToken);
    rafToken = null;
  }

  playBtn.addEventListener("click", () => (playing ? pause() : play()));
  prevBtn.addEventListener("click", () => { pause(); showFrame(currentIndex - 1); });
  nextBtn.addEventListener("click", () => { pause(); showFrame(currentIndex + 1); });
  scrub.addEventListener("input", () => { pause(); showFrame(Number(scrub.value)); });

  // Keyboard
  const keyHandler = (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.code === "Space") { e.preventDefault(); playing ? pause() : play(); }
    if (e.code === "ArrowLeft") { pause(); showFrame(currentIndex - 1); }
    if (e.code === "ArrowRight") { pause(); showFrame(currentIndex + 1); }
  };
  window.addEventListener("keydown", keyHandler);

  // Clean up on hash change.
  const cleanup = () => {
    window.removeEventListener("keydown", keyHandler);
    window.removeEventListener("hashchange", cleanup);
    if (rafToken) cancelAnimationFrame(rafToken);
  };
  window.addEventListener("hashchange", cleanup);

  // Kick off
  showFrame(0);
  // Auto-play once at least a couple of frames are likely ready.
  setTimeout(() => { if (!playing && document.body.contains(playBtn)) play(); }, 500);
}

function buildHeader(collection, date, count) {
  return el("header", { class: "view-header" },
    el("div", {},
      el("h2", { class: "view-title" },
        date,
        el("small", {}, `${count || "—"} frames · ${collection}`),
      ),
    ),
    el("div", { class: "controls" },
      el("a", { class: "btn", href: "#/" }, "← Calendar"),
    ),
  );
}

function buildHud() {
  const root = el("aside", { class: "hud" });
  const rows = {};
  const addRow = (key, label) => {
    const k = el("span", { class: "k" }, label);
    const v = el("span", { class: "v" }, "—");
    root.appendChild(el("div", { class: "hud-row" }, k, v));
    rows[key] = v;
  };
  addRow("frame", "Frame");
  addRow("time", "Time");
  addRow("lat", "Centroid lat");
  addRow("lon", "Centroid lon");
  addRow("version", "Version");
  const caption = el("div", { class: "hud-caption" }, "—");
  const openLink = el("a", { class: "btn", href: "#", target: "_blank", rel: "noopener", style: { marginTop: "0.5rem" } }, "Open original PNG ↗");
  root.appendChild(caption);
  root.appendChild(openLink);

  return {
    root,
    update(img, index, total, collection) {
      rows.frame.textContent = `${index + 1} / ${total}`;
      rows.time.textContent = formatHM(img.date);
      rows.lat.textContent = img.centroid_coordinates ? img.centroid_coordinates.lat.toFixed(2) : "—";
      rows.lon.textContent = img.centroid_coordinates ? img.centroid_coordinates.lon.toFixed(2) : "—";
      rows.version.textContent = img.version || "—";
      caption.textContent = img.caption || "—";
      openLink.href = buildImageUrl(collection, img.date, img.image, "png");
    },
  };
}
