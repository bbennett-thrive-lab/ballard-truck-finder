const today = new Date();
const TODAY = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

let venues = [];
let schedule = [];
let venueMap = null;
let venueMarkers = new Map();

const venueCoordinates = {
  stoup: [47.66575, -122.37202],
  "urban-family": [47.66552, -122.3713],
  "yonder-bale-breaker": [47.66416, -122.36679],
  obec: [47.66579, -122.37347],
  reubens: [47.66533, -122.37308],
  "lucky-envelope": [47.66461, -122.37191],
  "fair-isle": [47.66409, -122.36996],
  "great-notion-ballard": [47.66533, -122.37368]
};

const manualTruckProfiles = [
  {
    name: "El Camion Ballard",
    cuisines: [],
    tags: [],
    venues: [],
    events: [],
    sourceStatus: "permanent_truck",
    truckUrl: "https://www.myballard.com/2024/11/11/el-camion-food-truck-is-back-in-ballard/",
    menuUrl: null,
    nextStopLabel: "Permanent Ballard truck",
    lastSeenLabel: "Not schedule-tracked",
    appearanceLabel: "Directory only",
    venueStops: []
  }
];

const fallbackSources = {
  generatedAt: null,
  venues: [
    {
      id: "stoup",
      name: "Stoup Brewing - Ballard",
      address: "1108 NW 52nd St",
      status: "pending",
      sourceStatus: "pending",
      source: "https://www.stoupbrewing.com/ballard/",
      message: "Run npm run scrape to generate schedule data."
    }
  ]
};

const state = {
  filter: "today",
  openNow: false,
  selectedVenueId: null,
  expandedKnownStops: new Set(),
  saved: new Set(JSON.parse(localStorage.getItem("savedTrucks") || "[]"))
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric"
});

function parseDate(date) {
  return new Date(`${date}T12:00:00`);
}

function formatTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "pm" : "am";
  const normalized = hour % 12 || 12;
  return `${normalized}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${suffix}`;
}

function formatStop(item) {
  return `${dateFormatter.format(parseDate(item.date))}, ${formatTime(item.start)} at ${item.venue}`;
}

function normalizeTruckName(value = "") {
  return value.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim();
}

function eventStartsAt(item) {
  return new Date(`${item.date}T${item.start || "00:00"}:00`);
}

function eventEndsAt(item) {
  return new Date(`${item.date}T${item.end || item.start || "23:59"}:00`);
}

function addDays(date, days) {
  const next = parseDate(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function sourceLabel(status) {
  return {
    live: "Verified source",
    empty: "No current trucks",
    needs_adapter: "Needs adapter",
    no_schedule_found: "No schedule found",
    permanent_food: "Onsite food",
    permanent_truck: "Permanent truck",
    error: "Source error",
    pending: "Needs check"
  }[status] || "Needs check";
}

function isWithinFilter(item) {
  if (state.filter === "all") return true;
  if (state.filter === "today") return item.date === TODAY;
  if (state.filter === "tomorrow") return item.date === addDays(TODAY, 1);
  const end = addDays(TODAY, 6);
  return item.date >= TODAY && item.date <= end;
}

function isOpenNow(item) {
  const now = new Date();
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (item.date !== currentDate) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = item.start.split(":").map(Number);
  const [endHour, endMinute] = item.end.split(":").map(Number);
  return currentMinutes >= startHour * 60 + startMinute && currentMinutes <= endHour * 60 + endMinute;
}

function getFilteredSchedule() {
  const selectedVenue = venues.find((venue) => venue.id === state.selectedVenueId);
  return schedule
    .filter(isWithinFilter)
    .filter((item) => !selectedVenue || item.venue === selectedVenue.name)
    .filter((item) => !state.openNow || isOpenNow(item))
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildVenueStops(events) {
  const counts = new Map();
  events.forEach((event) => {
    if (!event.venue) return;
    counts.set(event.venue, (counts.get(event.venue) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([venue, count]) => ({ venue, count }))
    .sort((a, b) => b.count - a.count || a.venue.localeCompare(b.venue));
}

function buildTruckDirectory() {
  const now = new Date();
  const truckMap = new Map();

  schedule.forEach((item) => {
    if (!item.truck) return;
    const key = normalizeTruckName(item.truck);
    if (!truckMap.has(key)) {
      truckMap.set(key, {
        name: item.truck,
        cuisines: [],
        tags: [],
        venues: [],
        events: [],
        truckUrl: null,
        menuUrl: null
      });
    }

    const truck = truckMap.get(key);
    truck.cuisines.push(item.cuisine);
    truck.tags.push(...(item.tags || []));
    truck.venues.push(item.venue);
    truck.events.push(item);
    truck.truckUrl ||= item.truckUrl;
    truck.menuUrl ||= item.menuUrl;
  });

  const scheduleTrucks = [...truckMap.values()].map((truck) => {
    const events = truck.events.sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    const upcoming = events.filter((item) => eventEndsAt(item) >= now);
    const past = events.filter((item) => eventEndsAt(item) < now);
    const statusEvent = upcoming[0] || past[past.length - 1] || events[events.length - 1];

    return {
      ...truck,
      cuisines: uniqueValues(truck.cuisines),
      tags: uniqueValues(truck.tags),
      venues: uniqueValues(truck.venues),
      events,
      nextStop: upcoming[0] || null,
      lastSeen: past[past.length - 1] || null,
      sourceStatus: statusEvent?.sourceStatus || "pending",
      venueStops: buildVenueStops(events)
    };
  });
  const scheduleKeys = new Set(scheduleTrucks.map((truck) => normalizeTruckName(truck.name)));
  const manualTrucks = manualTruckProfiles.filter((truck) => !scheduleKeys.has(normalizeTruckName(truck.name)));

  return [...scheduleTrucks, ...manualTrucks].sort((a, b) => a.name.localeCompare(b.name));
}

function getFilteredDirectory() {
  return buildTruckDirectory();
}

function renderVenues() {
  const venueList = document.querySelector("#venueList");
  venueList.innerHTML = `
    <button class="all-venues-button ${state.selectedVenueId ? "" : "is-active"}" type="button" data-venue-id="">
      <span>All venues</span>
      <span>${venues.length}</span>
    </button>
    ${venues.map((venue) => {
    const isSelected = state.selectedVenueId === venue.id;
    return `
    <div class="venue-row ${isSelected ? "is-selected" : ""}" role="button" tabindex="0" data-venue-id="${venue.id}">
      <div>
        <a class="venue-link" href="${venue.source}" target="_blank" rel="noreferrer">${venue.name}</a>
        <span>${venue.address}</span>
      </div>
      <button class="venue-select-button ${isSelected ? "is-selected" : ""}" type="button">${isSelected ? "Selected" : "Select"}</button>
    </div>
  `;
  }).join("")}`;

  venueList.querySelectorAll(".venue-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  venueList.querySelectorAll(".venue-select-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectVenue(button.closest("[data-venue-id]").dataset.venueId || null);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.stopPropagation();
      }
    });
  });

  venueList.querySelectorAll("[data-venue-id]").forEach((row) => {
    row.addEventListener("click", () => {
      selectVenue(row.dataset.venueId || null);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectVenue(row.dataset.venueId || null);
    });
  });
}

function makeMarkerIcon(venue) {
  const status = venue.sourceStatus || venue.status || "pending";
  const selected = state.selectedVenueId === venue.id ? "is-selected" : "";
  return L.divIcon({
    className: "",
    html: `<span class="venue-marker ${status} ${selected}" aria-hidden="true"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function renderVenueMap() {
  const mapEl = document.querySelector("#venueMap");
  if (!mapEl) return;
  if (!window.L) {
    mapEl.classList.add("is-hidden");
    return;
  }

  mapEl.classList.remove("is-hidden");
  if (!venueMap) {
    venueMap = L.map(mapEl, {
      attributionControl: false,
      scrollWheelZoom: false
    }).setView([47.66505, -122.37055], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(venueMap);
    L.control.attribution({ prefix: false }).addTo(venueMap);
  }

  venues.forEach((venue) => {
    const coords = venueCoordinates[venue.id];
    if (!coords) return;
    const existing = venueMarkers.get(venue.id);
    if (existing) {
      existing.setIcon(makeMarkerIcon(venue));
      return;
    }
    const marker = L.marker(coords, { icon: makeMarkerIcon(venue), title: venue.name })
      .addTo(venueMap)
      .bindTooltip(`${venue.name} - ${sourceLabel(venue.sourceStatus || venue.status)}`, {
        direction: "top",
        offset: [0, -12]
      });
    marker.on("click", () => selectVenue(venue.id));
    venueMarkers.set(venue.id, marker);
  });
}

function selectVenue(venueId) {
  state.selectedVenueId = venueId && state.selectedVenueId !== venueId ? venueId : null;
  renderVenues();
  renderVenueMap();
  renderSchedule();
}

function renderSelectedVenueFilter() {
  const filter = document.querySelector("#selectedVenueFilter");
  if (!filter) return;

  const selectedVenue = venues.find((venue) => venue.id === state.selectedVenueId);
  if (!selectedVenue) {
    filter.innerHTML = "";
    return;
  }

  filter.innerHTML = `
    <button class="selected-venue-chip" type="button" aria-label="Clear venue filter">
      <span>Venue: ${selectedVenue.name}</span>
      <span aria-hidden="true">x</span>
    </button>
  `;
  filter.querySelector("button").addEventListener("click", () => selectVenue(null));
}

function renderOnsiteFoodCard(venue, template, list) {
  const clone = template.content.cloneNode(true);
  const foodUrl = venue.foodUrl || venue.menuUrl || venue.source;

  clone.querySelector(".date-badge").textContent = "Venue";
  clone.querySelector(".source-badge").textContent = sourceLabel(venue.sourceStatus);
  clone.querySelector(".source-badge").classList.add(venue.sourceStatus || "pending");
  clone.querySelector("h3").textContent = "Onsite food";
  clone.querySelector(".meta").textContent = `${venue.name} | ${venue.address}`;
  clone.querySelector(".tag-row").innerHTML = `<span class="tag">Menu available</span>`;

  const sourceLink = clone.querySelector(".source-link");
  sourceLink.href = foodUrl;
  sourceLink.textContent = venue.foodUrl || venue.menuUrl ? "Menu" : "Food info";

  clone.querySelector(".save-button").remove();
  clone.querySelector(".truck-card").classList.add("onsite-food-card");
  list.appendChild(clone);
}

function renderSchedule() {
  const template = document.querySelector("#scheduleTemplate");
  const list = document.querySelector("#scheduleList");
  const selectedVenue = venues.find((venue) => venue.id === state.selectedVenueId);
  const items = getFilteredSchedule();
  list.innerHTML = "";
  renderSelectedVenueFilter();

  document.querySelector("#resultCount").textContent = `${items.length} ${items.length === 1 ? "truck" : "trucks"}`;
  document.querySelector("#scheduleTitle").textContent = {
    today: "Today",
    tomorrow: "Tomorrow",
    week: "This week",
    all: "All scheduled trucks"
  }[state.filter];

  if (selectedVenue?.sourceStatus === "permanent_food") {
    renderOnsiteFoodCard(selectedVenue, template, list);
    return;
  }

  if (!items.length) {
    list.innerHTML = `<div class="empty-state">No trucks match those filters yet. Try the full week or another venue.</div>`;
    return;
  }

  items.forEach((item) => {
    const clone = template.content.cloneNode(true);
    const savedKey = `${item.date}-${item.truck}-${item.venue}`;
    clone.querySelector(".date-badge").textContent = dateFormatter.format(parseDate(item.date));
    clone.querySelector(".source-badge").textContent = sourceLabel(item.sourceStatus);
    clone.querySelector(".source-badge").classList.add(item.sourceStatus || "pending");
    clone.querySelector("h3").textContent = item.truck;
    clone.querySelector(".meta").textContent = `${formatTime(item.start)} - ${formatTime(item.end)} at ${item.venue} | ${item.cuisine}`;
    clone.querySelector(".tag-row").innerHTML = (item.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join("");
    clone.querySelector(".source-link").href = item.source;

    const saveButton = clone.querySelector(".save-button");
    saveButton.textContent = state.saved.has(savedKey) ? "Saved" : "Save";
    saveButton.classList.toggle("is-saved", state.saved.has(savedKey));
    saveButton.addEventListener("click", () => {
      if (state.saved.has(savedKey)) {
        state.saved.delete(savedKey);
      } else {
        state.saved.add(savedKey);
      }
      localStorage.setItem("savedTrucks", JSON.stringify([...state.saved]));
      renderSchedule();
    });

    list.appendChild(clone);
  });
}

function renderDirectory() {
  const template = document.querySelector("#directoryTemplate");
  const list = document.querySelector("#directoryList");
  if (!template || !list) return;

  const trucks = getFilteredDirectory();
  list.innerHTML = "";
  document.querySelector("#directoryCount").textContent = `${trucks.length} ${trucks.length === 1 ? "truck" : "trucks"}`;

  if (!trucks.length) {
    list.innerHTML = `<div class="empty-state">No food trucks are in the directory yet.</div>`;
    return;
  }

  trucks.forEach((truck) => {
    const clone = template.content.cloneNode(true);
    const cuisineLabel = truck.cuisines.join(", ") || "Cuisine not listed";
    const venueLabel = truck.venues.join(", ");
    const metaParts = [cuisineLabel, venueLabel].filter(Boolean);
    const links = [];

    if (truck.truckUrl) links.push(`<a href="${truck.truckUrl}" target="_blank" rel="noreferrer">Truck site</a>`);
    if (truck.menuUrl) links.push(`<a href="${truck.menuUrl}" target="_blank" rel="noreferrer">Menu</a>`);

    clone.querySelector(".source-badge").textContent = sourceLabel(truck.sourceStatus);
    clone.querySelector(".source-badge").classList.add(truck.sourceStatus || "pending");
    clone.querySelector("h3").textContent = truck.name;
    clone.querySelector(".meta").textContent = metaParts.join(" | ");
    clone.querySelector(".tag-row").innerHTML = truck.tags.slice(0, 6).map((tag) => `<span class="tag">${tag}</span>`).join("");
    clone.querySelector(".directory-links").innerHTML = links.join("") || `<span>No truck link yet</span>`;
    clone.querySelector(".next-stop").textContent = truck.nextStopLabel || (truck.nextStop ? formatStop(truck.nextStop) : "No upcoming stop found");
    clone.querySelector(".last-seen").textContent = truck.lastSeenLabel || (truck.lastSeen ? formatStop(truck.lastSeen) : "Not seen yet in current data");

    const truckKey = normalizeTruckName(truck.name);
    const knownStopsButton = clone.querySelector(".known-stops-button");
    const stopsList = clone.querySelector(".known-stops-list");
    knownStopsButton.querySelector(".appearance-count").textContent = truck.appearanceLabel || `${truck.events.length} ${truck.events.length === 1 ? "stop" : "stops"}`;

    if (!truck.venueStops.length) {
      knownStopsButton.disabled = true;
      stopsList.hidden = true;
    } else {
      const expanded = state.expandedKnownStops.has(truckKey);
      knownStopsButton.setAttribute("aria-expanded", String(expanded));
      stopsList.hidden = !expanded;
      stopsList.innerHTML = truck.venueStops.map((stop) => `
        <div class="known-stop-row">
          <span>${stop.venue}</span>
          <strong>${stop.count} ${stop.count === 1 ? "stop" : "stops"}</strong>
        </div>
      `).join("");
      knownStopsButton.addEventListener("click", () => {
        if (state.expandedKnownStops.has(truckKey)) {
          state.expandedKnownStops.delete(truckKey);
        } else {
          state.expandedKnownStops.add(truckKey);
        }
        renderDirectory();
      });
    }

    list.appendChild(clone);
  });
}

function renderTopPick(generatedAt) {
  const todayItems = schedule.filter((item) => item.date === TODAY);
  const upcomingItems = schedule.filter((item) => item.date >= TODAY);
  const topPick = todayItems[0] || upcomingItems[0];
  document.querySelector("#topPick").textContent = topPick
    ? `${topPick.truck} at ${topPick.venue}, ${formatTime(topPick.start)} - ${formatTime(topPick.end)}`
    : "No verified trucks for today yet";
  document.querySelector("#freshness").textContent = generatedAt
    ? `Updated ${dateFormatter.format(new Date(generatedAt))}`
    : "Run npm run scrape";
}

function wireControls() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((chip) => chip.classList.remove("is-active"));
      button.classList.add("is-active");
      renderSchedule();
    });
  });

  document.querySelector("#openNowToggle").addEventListener("change", (event) => {
    state.openNow = event.target.checked;
    renderSchedule();
  });
}

async function loadJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } catch (error) {
    console.warn(`Unable to load ${url}:`, error);
    return fallback;
  }
}

async function init() {
  const [loadedSchedule, loadedSources] = await Promise.all([
    loadJson("data/schedule.json", []),
    loadJson("data/sources.json", fallbackSources)
  ]);
  schedule = Array.isArray(loadedSchedule) ? loadedSchedule : [];
  venues = loadedSources.venues || fallbackSources.venues;

  renderTopPick(loadedSources.generatedAt);
  renderVenues();
  renderVenueMap();
  wireControls();
  renderSchedule();
  renderDirectory();
}

init();
