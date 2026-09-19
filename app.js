// ---- Configuration ----------------------------------------------------
// Paste your Google Sheets "publish to web" CSV URL here to load data from
// Sheets instead of the local restaurants.json fallback. See README.md for
// how to set up the sheet and get this URL.
//
// Expected columns (case-insensitive), one row per restaurant:
//   name, cuisine, sun, mon, tue, wed, thu, fri, sat, food, alcohol, out_of_town, address, notes
//
// Day columns, food/alcohol, and out_of_town accept TRUE/FALSE, yes/no, y/n,
// 1/0, or open/closed (case-insensitive). Blank = closed / false (in town).
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBLiKjWwsLgmopcPVC47Q5YNgCq63OqtCmDL64V50HU2DRZwAVHVoHRKcX7OadQczWCGY2OPjNib60/pub?gid=0&single=true&output=csv";

const FALLBACK_JSON_URL = "restaurants.json";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = { sun: "S", mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S" };

// ---- Data loading -------------------------------------------------------

async function loadRestaurants() {
  if (SHEET_CSV_URL) {
    try {
      const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csvText = await res.text();
      const rows = parseCSV(csvText);
      return rowsToRestaurants(rows);
    } catch (err) {
      console.warn("Failed to load from Google Sheets, falling back to restaurants.json", err);
    }
  }

  const res = await fetch(FALLBACK_JSON_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${FALLBACK_JSON_URL}: HTTP ${res.status}`);
  const data = await res.json();
  return data.map(normalizeRestaurant);
}

// ---- CSV parsing ---------------------------------------------------------
// Minimal RFC4180-ish parser: handles quoted fields, escaped quotes ("")
// and commas/newlines inside quotes.

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function rowsToRestaurants(rows) {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const dataRows = rows.slice(1);

  return dataRows.map((r) => {
    const obj = {};
    header.forEach((key, idx) => {
      obj[key] = (r[idx] ?? "").trim();
    });
    return normalizeRestaurant(obj);
  });
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  const v = String(value ?? "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "y" || v === "1" || v === "open";
}

function normalizeRestaurant(raw) {
  const cuisines = String(raw.cuisine ?? "")
    .split(/[,;]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const normalized = {
    name: String(raw.name ?? "").trim(),
    cuisines: cuisines.length ? cuisines : ["Uncategorized"],
    cuisine: cuisines.length ? cuisines.join(", ") : "Uncategorized",
    address: String(raw.address ?? "").trim(),
    notes: String(raw.notes ?? "").trim(),
    food: toBool(raw.food),
    alcohol: toBool(raw.alcohol),
    outOfTown: toBool(raw.out_of_town),
  };
  DAY_KEYS.forEach((day) => {
    normalized[day] = toBool(raw[day]);
  });
  return normalized;
}

// ---- Rendering ------------------------------------------------------------

const state = {
  all: [],
  filtered: [],
};

function todayKey() {
  return DAY_KEYS[new Date().getDay()];
}

function populateCuisineFilter(restaurants) {
  const panel = document.getElementById("cuisine-panel");
  const cuisines = Array.from(new Set(restaurants.flatMap((r) => r.cuisines))).sort();
  panel.innerHTML = cuisines
    .map(
      (cuisine) => `
        <label>
          <input type="checkbox" class="cuisine-option" value="${escapeHTML(cuisine)}" ${cuisine.toLowerCase() === "breakfast" ? "" : "checked"}>
          ${escapeHTML(cuisine)}
        </label>
      `
    )
    .join("");
  updateCuisineToggleLabel();
}

function selectedCuisines() {
  return Array.from(document.querySelectorAll(".cuisine-option:checked")).map((el) => el.value);
}

function updateCuisineToggleLabel() {
  const toggle = document.getElementById("cuisine-toggle");
  const total = document.querySelectorAll(".cuisine-option").length;
  const selected = selectedCuisines();
  if (selected.length === 0 || selected.length === total) toggle.textContent = "All cuisines";
  else if (selected.length <= 2) toggle.textContent = selected.join(", ");
  else toggle.textContent = `${selected.length} cuisines`;
}

function setupCuisineMultiselect() {
  const toggle = document.getElementById("cuisine-toggle");
  const panel = document.getElementById("cuisine-panel");
  const container = document.getElementById("cuisine-multiselect");

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    toggle.setAttribute("aria-expanded", String(!isOpen));
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  panel.addEventListener("change", () => {
    updateCuisineToggleLabel();
    applyFilters();
  });
}

function mapsUrl(address) {
  const query = encodeURIComponent(address);
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  return isApple
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function servesLabel(r) {
  if (r.food && r.alcohol) return "Food & Alcohol";
  if (r.food) return "Food only";
  if (r.alcohol) return "Alcohol only";
  return "Unlisted";
}

function renderDayRow(r, today) {
  return DAY_KEYS.map((day) => {
    const classes = ["day-pill", r[day] ? "open" : "closed"];
    if (day === today) classes.push("today");
    return `<span class="${classes.join(" ")}" title="${day}">${DAY_LABELS[day]}</span>`;
  }).join("");
}

function renderCard(r, today) {
  const openToday = r[today];
  return `
    <article class="restaurant-card">
      <h3>${escapeHTML(r.name)}</h3>
      <div class="cuisine">${escapeHTML(r.cuisine)}</div>
      <div class="tags">
        <span class="tag ${openToday ? "today-open" : "today-closed"}">${openToday ? "Open today" : "Closed today"}</span>
        <span class="tag">${servesLabel(r)}</span>
        ${r.outOfTown ? `<span class="tag out-of-town">Out of town</span>` : ""}
      </div>
      <div class="day-row">${renderDayRow(r, today)}</div>
      ${r.address ? `<div class="address"><a href="${mapsUrl(r.address)}" target="_blank" rel="noopener noreferrer">${escapeHTML(r.address)}</a></div>` : ""}
      ${r.notes ? `<div class="notes">${escapeHTML(r.notes)}</div>` : ""}
    </article>
  `;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function applyFilters() {
  const cuisines = selectedCuisines();
  const location = document.getElementById("location-filter").value;
  const openTodayOnly = document.getElementById("open-today-filter").checked;
  const serves = document.getElementById("serves-filter").value;
  const today = todayKey();

  state.filtered = state.all.filter((r) => {
    if (cuisines.length > 0 && !r.cuisines.some((c) => cuisines.includes(c))) return false;
    if (location === "in-town" && r.outOfTown) return false;
    if (location === "out-of-town" && !r.outOfTown) return false;
    if (openTodayOnly && !r[today]) return false;
    if (serves === "food-alcohol" && !(r.food && r.alcohol)) return false;
    if (serves === "food-only" && !(r.food && !r.alcohol)) return false;
    if (serves === "alcohol-only" && !(r.alcohol && !r.food)) return false;
    return true;
  });

  renderList();
}

function renderList() {
  const listEl = document.getElementById("restaurant-list");
  const statusEl = document.getElementById("status-line");
  const today = todayKey();

  statusEl.textContent = `${state.filtered.length} of ${state.all.length} restaurants shown`;

  if (state.filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">No restaurants match these filters.</div>`;
    return;
  }

  listEl.innerHTML = state.filtered
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => renderCard(r, today))
    .join("");
}

function pickForMe() {
  const resultEl = document.getElementById("pick-result");
  if (state.filtered.length === 0) {
    resultEl.hidden = false;
    resultEl.innerHTML = `No restaurants match your current filters — try loosening them.`;
    return;
  }
  const pick = state.filtered[Math.floor(Math.random() * state.filtered.length)];
  const today = todayKey();
  resultEl.hidden = false;
  resultEl.innerHTML = `
    <strong>${escapeHTML(pick.name)}</strong>${pick.outOfTown ? ` <span class="tag out-of-town">Out of town</span>` : ""}<br>
    <span class="cuisine">${escapeHTML(pick.cuisine)} • ${servesLabel(pick)}</span><br>
    ${pick[today] ? "Open today" : "⚠️ Closed today"}
    ${pick.address ? `<br><a class="address" href="${mapsUrl(pick.address)}" target="_blank" rel="noopener noreferrer">${escapeHTML(pick.address)}</a>` : ""}
  `;
}

// ---- Init -----------------------------------------------------------------

async function init() {
  const statusEl = document.getElementById("status-line");
  statusEl.textContent = "Loading restaurants…";

  try {
    state.all = await loadRestaurants();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Failed to load restaurant data.";
    return;
  }

  populateCuisineFilter(state.all);
  setupCuisineMultiselect();
  applyFilters();

  document.getElementById("location-filter").addEventListener("change", applyFilters);
  document.getElementById("open-today-filter").addEventListener("change", applyFilters);
  document.getElementById("serves-filter").addEventListener("change", applyFilters);
  document.getElementById("pick-btn").addEventListener("click", pickForMe);
}

init();
