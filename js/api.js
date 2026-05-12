// NASA EPIC API wrapper. Browser-direct (CORS verified).

export const API_BASE = "https://epic.gsfc.nasa.gov/api";
export const ARCHIVE_BASE = "https://epic.gsfc.nasa.gov/archive";

export const COLLECTIONS = ["natural", "enhanced", "aerosol", "cloud"];

export function isCollection(name) {
  return COLLECTIONS.includes(name);
}

async function fetchJson(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) {
    throw new Error(`NASA API ${res.status}: ${url}`);
  }
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
