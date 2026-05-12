// Hash-based router. Each path delegates to a view module.

import * as Calendar from "./calendar.js";
import * as Day from "./day.js";
import * as Range from "./range.js";
import * as Compare from "./compare.js";
import { toast } from "./ui.js";

const VIEW = () => document.getElementById("view");

function setActiveNav(mode) {
  const nav = document.getElementById("topnav");
  if (!nav) return;
  for (const a of nav.querySelectorAll("a")) {
    if (a.dataset.mode === mode) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

function setSourceLink() {
  const a = document.getElementById("source-link");
  if (a) a.href = "https://github.com/" + (window.NASA_EYES_REPO || "czabriskie/nasa-eyes");
}

async function dispatch() {
  setSourceLink();
  const view = VIEW();
  view.replaceChildren();

  const hash = location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);
  const head = parts[0];

  try {
    if (!head || head === "cal") {
      setActiveNav("cal");
      await Calendar.render(view, parts.slice(1));
      return;
    }
    if (head === "day") {
      setActiveNav("cal");
      await Day.render(view, parts.slice(1));
      return;
    }
    if (head === "range") {
      setActiveNav("range");
      await Range.render(view, parts.slice(1));
      return;
    }
    if (head === "compare") {
      setActiveNav("compare");
      await Compare.render(view, parts.slice(1));
      return;
    }
    // Unknown route — fall through to calendar.
    setActiveNav("cal");
    await Calendar.render(view, []);
  } catch (err) {
    console.error(err);
    toast(err.message || String(err), "error");
    view.innerHTML = `<div class="status" style="color:var(--magenta)">Something went wrong: ${escapeHtml(err.message || String(err))}</div>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

window.addEventListener("hashchange", dispatch);
window.addEventListener("DOMContentLoaded", dispatch);
