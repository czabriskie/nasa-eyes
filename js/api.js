// NASA EPIC API wrapper.
//
// We hit `api.nasa.gov/EPIC/api/*` instead of `epic.gsfc.nasa.gov/api/*`
// because the gsfc origin only sets `Access-Control-Allow-Origin` on the
// `natural` endpoints — enhanced/aerosol/cloud have no CORS header and
// browsers refuse to expose the JSON. The api.nasa.gov mirror returns the
// same payloads with `Access-Control-Allow-Origin: *` on every collection,
// but requires an `api_key` query param (DEMO_KEY is fine for casual use,
// 30 req/hr per IP).
//
// Image PNG/JPG URLs still come from epic.gsfc.nasa.gov/archive — those
// load via <img> tags and aren't subject to CORS for display.

export const API_BASE = "https://api.nasa.gov/EPIC/api";
export const ARCHIVE_BASE = "https://epic.gsfc.nasa.gov/archive";

export const COLLECTIONS = ["natural", "enhanced", "aerosol", "cloud"];

const API_KEY_STORAGE = "nasa-eyes:apiKey";

export function isCollection(name) {
  return COLLECTIONS.includes(name);
}

// Keys are base64-encoded in storage so they aren't plain-readable in
// DevTools at a glance. This is obfuscation, not encryption — a determined
// user can decode it. For true protection you'd need a passphrase or a
// server-side proxy.
export function getApiKey() {
  try {
    const raw = localStorage.getItem(API_KEY_STORAGE);
    if (!raw) return "DEMO_KEY";
    const decoded = atob(raw);
    return decoded || "DEMO_KEY";
  } catch {
    return "DEMO_KEY";
  }
}

export function setApiKey(key) {
  try {
    if (key && key.trim()) localStorage.setItem(API_KEY_STORAGE, btoa(key.trim()));
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch {}
}

export function hasCustomApiKey() {
  try {
    return Boolean(localStorage.getItem(API_KEY_STORAGE));
  } catch {
    return false;
  }
}

function withKey(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}api_key=${encodeURIComponent(getApiKey())}`;
}

async function fetchJson(url) {
  const res = await fetch(withKey(url), { mode: "cors" });
  if (res.status === 429) {
    throw new Error(
      "Rate limited by api.nasa.gov (DEMO_KEY allows 30 requests/hour). " +
      "Get a free key at https://api.nasa.gov and set it via " +
      "localStorage.setItem('nasa-eyes:apiKey', 'YOUR_KEY').",
    );
  }
  if (!res.ok) throw new Error(`NASA API ${res.status}: ${url}`);
  return res.json();
}

// Returns array of { date: "YYYY-MM-DD" }
export async function getAvailableDates(collection) {
  if (!isCollection(collection)) throw new Error(`Bad collection: ${collection}`);
  return fetchJson(`${API_BASE}/${collection}/all`);
}

// Returns the raw image list for a date.
export async function getImagesForDate(collection, isoDate) {
  if (!isCollection(collection)) throw new Error(`Bad collection: ${collection}`);
  return fetchJson(`${API_BASE}/${collection}/date/${isoDate}`);
}

// Build a full PNG or thumbnail URL from an API image entry.
//   collection: "natural" | …
//   dateField:  the API's "YYYY-MM-DD HH:MM:SS" string from the image record
//   imageName:  the API's "image" field (no extension)
//   format:     "png" | "thumbs"
export function buildImageUrl(collection, dateField, imageName, format = "png") {
  const datePart = dateField.includes(" ") ? dateField.split(" ")[0] : dateField;
  const [y, m, d] = datePart.split("-");
  const ext = format === "png" ? "png" : "jpg";
  return `${ARCHIVE_BASE}/${collection}/${y}/${m}/${d}/${format}/${imageName}.${ext}`;
}

// Extract the "HHMMSS" identifier from an image record. Useful for matching
// images across days in the compare view.
export function imageTimeOfDay(image) {
  // image.identifier is YYYYMMDDHHMMSS
  if (!image.identifier) return null;
  return image.identifier.slice(8); // "HHMMSS"
}
