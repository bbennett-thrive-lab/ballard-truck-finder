const BALLARD_TIME_ZONE = "America/Los_Angeles";
const FRESHNESS_WINDOW_MS = 36 * 60 * 60 * 1000;

let venues = [];
let schedule = [];
let venueMap = null;
let venueMarkers = new Map();
let sourceMetadata = {};
const dataLoadErrors = new Set();

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
  selectedVenueId: null,
  directoryQuery: "",
  directoryFavoritesOnly: false,
  expandedKnownStops: new Set(),
  favoriteTrucks: new Set(loadStoredList("favoriteTrucksV1").filter((name) => typeof name === "string").map(normalizeTruckName))
};

function loadStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function getBallardNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BALLARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function getBallardToday(date = new Date()) {
  const now = getBallardNowParts(date);
  return `${now.year}-${now.month}-${now.day}`;
}

function getBallardCurrentMinutes() {
  const now = getBallardNowParts();
  return Number(now.hour) * 60 + Number(now.minute);
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric"
});

function parseDate(date) {
  return new Date(`${date}T12:00:00Z`);
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
  const key = value.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/&/g, "and").replace(/\s+/g, " ").trim();
  return {
    "kaosamai thai": "kaosamai",
    "impeckable chicken": "impeccable chicken",
    "impeckable": "impeccable chicken",
    "albrijes": "alebrijes",
    "la rivera maya": "la riviera maya",
    "la rivera": "la riviera maya"
  }[key] || key;
}

function addDays(date, days) {
  const next = parseDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function sourceLabel(status) {
  return {
    live: "Verified source",
    stale: "Stale data",
    empty: "No current trucks",
    needs_adapter: "Needs adapter",
    no_schedule_found: "No schedule found",
    permanent_food: "Onsite food",
    permanent_truck: "Permanent truck",
    error: "Source error",
    pending: "Needs check"
  }[status] || "Needs check";
}

function getDataStatus(record) {
  if (record?.dataStatus === "stale") return "stale";
  if (record?.dataStatus === "error" || record?.sourceStatus === "error") return "error";
  const verifiedAt = record?.lastVerifiedAt || record?.lastSuccessfulAt || record?.lastScrapedAt || sourceMetadata.generatedAt;
  const verifiedTime = Date.parse(verifiedAt);
  if (!Number.isFinite(verifiedTime)) return "unknown";
  if (Date.now() - verifiedTime > FRESHNESS_WINDOW_MS) return "stale";
  if (record?.sourceType === "homepage_today" && record.date !== getBallardToday()) return "stale";
  if (record?.id === "obec") {
    const day = getBallardToday(new Date(verifiedTime));
    if (day !== getBallardToday()) return "stale";
  }
  return "fresh";
}

function sourceAppearance(record) {
  const status = getDataStatus(record);
  return status === "fresh" ? record.sourceStatus || "pending" : status === "unknown" ? "pending" : status;
}

function recordLabel(record) {
  const status = getDataStatus(record);
  if (status === "stale") return "Stale data";
  if (status === "error") return "Source error";
  if (status === "unknown" && !["permanent_food", "permanent_truck"].includes(record?.sourceStatus)) return "Needs check";
  return sourceLabel(record?.sourceStatus);
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function renderTags(container, tags = []) {
  container.replaceChildren();
  for (const tag of tags) {
    const element = document.createElement("span");
    element.className = "tag";
    element.textContent = tag;
    container.appendChild(element);
  }
}

function isWithinFilter(item) {
  const today = getBallardToday();
  if (state.filter === "all") return true;
  if (state.filter === "today") return item.date === today;
  if (state.filter === "tomorrow") return item.date === addDays(today, 1);
  const end = addDays(today, 6);
  return item.date >= today && item.date <= end;
}

function isEventEnded(item) {
  const today = getBallardToday();
  if (item.date < today) return true;
  if (item.date > today) return false;
  const [endHour, endMinute] = (item.end || item.start || "23:59").split(":").map(Number);
  return getBallardCurrentMinutes() > endHour * 60 + endMinute;
}

function getFilteredSchedule() {
  const selectedVenue = venues.find((venue) => venue.id === state.selectedVenueId);
  return schedule
    .filter(isWithinFilter)
    .filter((item) => !selectedVenue || item.venue === selectedVenue.name)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function preserveFocus(update) {
  const key = document.activeElement?.dataset.focusKey;
  update();
  if (!key) return;
  const replacement = [...document.querySelectorAll("[data-focus-key]")].find((element) => element.dataset.focusKey === key);
  const fallback = key.startsWith("directory-") ? document.querySelector("#favoritesOnlyToggle") : document.querySelector("#schedulePanel");
  (replacement || fallback)?.focus({ preventScroll: true });
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
    const upcoming = events.filter((item) => !isEventEnded(item));
    const past = events.filter((item) => isEventEnded(item));
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
      dataStatus: statusEvent ? getDataStatus(statusEvent) : "fresh",
      isFavorite: state.favoriteTrucks.has(normalizeTruckName(truck.name)),
      venueStops: buildVenueStops(events)
    };
  });
  const scheduleKeys = new Set(scheduleTrucks.map((truck) => normalizeTruckName(truck.name)));
  const manualTrucks = manualTruckProfiles
    .filter((truck) => !scheduleKeys.has(normalizeTruckName(truck.name)))
    .map((truck) => ({ ...truck, isFavorite: state.favoriteTrucks.has(normalizeTruckName(truck.name)) }));

  return [...scheduleTrucks, ...manualTrucks].sort((a, b) => a.name.localeCompare(b.name));
}

function getFilteredDirectory() {
  const query = state.directoryQuery.trim().toLowerCase();
  return buildTruckDirectory().filter((truck) => {
    if (state.directoryFavoritesOnly && !truck.isFavorite) return false;
    if (!query) return true;
    const haystack = [truck.name, ...truck.cuisines, ...truck.tags, ...truck.venues].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function renderVenues() {
  const venueList = document.querySelector("#venueList");
  venueList.replaceChildren();

  const allVenues = document.createElement("button");
  allVenues.className = `all-venues-button ${state.selectedVenueId ? "" : "is-active"}`;
  allVenues.type = "button";
  allVenues.dataset.focusKey = "all-venues";
  allVenues.textContent = `All venues (${venues.length})`;
  allVenues.addEventListener("click", () => selectVenue(null));
  venueList.appendChild(allVenues);

  venues.forEach((venue) => {
    const isSelected = state.selectedVenueId === venue.id;
    const row = document.createElement("div");
    row.className = `venue-row ${isSelected ? "is-selected" : ""}`;
    row.dataset.venueId = venue.id;
    row.dataset.focusKey = `venue:${venue.id}`;
    row.setAttribute("role", "button");
    row.setAttribute("aria-pressed", String(isSelected));
    row.tabIndex = 0;

    const details = document.createElement("div");
    const link = document.createElement("a");
    link.className = "venue-link";
    link.dataset.focusKey = `venue-link:${venue.id}`;
    link.href = safeHttpUrl(venue.source);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = venue.name;
    link.addEventListener("click", (event) => event.stopPropagation());
    const address = document.createElement("span");
    address.textContent = venue.address;
    details.append(link, address);

    const selectButton = document.createElement("button");
    selectButton.className = `venue-select-button ${isSelected ? "is-selected" : ""}`;
    selectButton.type = "button";
    selectButton.dataset.focusKey = `venue-select:${venue.id}`;
    selectButton.textContent = isSelected ? "Selected" : "Select";
    selectButton.setAttribute("aria-label", `${isSelected ? "Clear" : "Select"} ${venue.name}`);
    selectButton.addEventListener("click", (event) => {
      event.stopPropagation();
      selectVenue(venue.id);
    });

    row.append(details, selectButton);
    row.addEventListener("click", () => selectVenue(venue.id));
    row.addEventListener("keydown", (event) => {
      if (event.target !== row) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectVenue(venue.id);
    });
    venueList.appendChild(row);
  });
}

function makeMarkerIcon(venue) {
  const status = sourceAppearance(venue);
  const selected = state.selectedVenueId === venue.id ? "is-selected" : "";
  return L.divIcon({
    className: "",
    html: `<span class="venue-marker ${status} ${selected}" aria-hidden="true"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function venueTooltip(venue) {
  const label = document.createElement("span");
  label.textContent = `${venue.name} - ${recordLabel(venue)}`;
  return label;
}

function fitVenueBounds() {
  const coordinates = venues.map((venue) => venueCoordinates[venue.id]).filter(Boolean);
  if (venueMap && coordinates.length) venueMap.fitBounds(coordinates, { padding: [12, 12], maxZoom: 17, animate: false });
}

function renderVenueMap() {
  const mapEl = document.querySelector("#venueMap");
  if (!mapEl) return;
  if (!window.L) {
    mapEl.classList.add("is-hidden");
    return;
  }

  mapEl.classList.remove("is-hidden");
  const firstRender = !venueMap;
  if (firstRender) {
    venueMap = L.map(mapEl, {
      attributionControl: false,
      scrollWheelZoom: false,
      zoomSnap: 0.1,
      zoomDelta: 0.5
    }).setView([47.66505, -122.37055], 17);

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
      existing.setTooltipContent(venueTooltip(venue));
      return;
    }
    const marker = L.marker(coords, { icon: makeMarkerIcon(venue), title: venue.name, riseOnHover: true })
      .addTo(venueMap)
      .bindTooltip(venueTooltip(venue), {
        direction: "top",
        offset: [0, -12]
      });
    marker.on("click", () => selectVenue(venue.id));
    venueMarkers.set(venue.id, marker);
  });
  if (firstRender) fitVenueBounds();
}

function selectVenue(venueId) {
  state.selectedVenueId = venueId && state.selectedVenueId !== venueId ? venueId : null;
  preserveFocus(() => {
    renderVenues();
    renderVenueMap();
    renderSchedule();
  });
}

function renderSelectedVenueFilter() {
  const filter = document.querySelector("#selectedVenueFilter");
  if (!filter) return;

  const selectedVenue = venues.find((venue) => venue.id === state.selectedVenueId);
  const resultsLink = document.querySelector("#viewVenueResults");
  if (resultsLink) resultsLink.hidden = !selectedVenue;
  if (!selectedVenue) {
    filter.replaceChildren();
    return;
  }

  const chip = document.createElement("button");
  chip.className = "selected-venue-chip";
  chip.type = "button";
  chip.dataset.focusKey = "selected-venue-filter";
  chip.setAttribute("aria-label", "Clear venue filter");
  const label = document.createElement("span");
  label.textContent = `Venue: ${selectedVenue.name}`;
  const close = document.createElement("span");
  close.setAttribute("aria-hidden", "true");
  close.textContent = "x";
  chip.append(label, close);
  chip.addEventListener("click", () => selectVenue(null));
  filter.replaceChildren(chip);
}

function renderOnsiteFoodCard(venue, template, list) {
  const clone = template.content.cloneNode(true);
  const foodUrl = venue.foodUrl || venue.menuUrl || venue.source;

  clone.querySelector(".date-badge").textContent = "Venue";
  clone.querySelector(".source-badge").textContent = recordLabel(venue);
  clone.querySelector(".source-badge").classList.add(sourceAppearance(venue));
  clone.querySelector("h3").textContent = "Onsite food";
  clone.querySelector(".meta").textContent = `${venue.name} | ${venue.address}`;
  renderTags(clone.querySelector(".tag-row"), ["Menu available"]);

  const sourceLink = clone.querySelector(".source-link");
  sourceLink.href = safeHttpUrl(foodUrl);
  sourceLink.textContent = venue.foodUrl || venue.menuUrl ? "Menu" : "Food info";

  clone.querySelector(".favorite-button").remove();
  clone.querySelector(".truck-card").classList.add("onsite-food-card");
  list.appendChild(clone);
}

function toggleFavorite(truckName) {
  const key = normalizeTruckName(truckName);
  if (state.favoriteTrucks.has(key)) {
    state.favoriteTrucks.delete(key);
  } else {
    state.favoriteTrucks.add(key);
  }
  try {
    localStorage.setItem("favoriteTrucksV1", JSON.stringify([...state.favoriteTrucks]));
  } catch {
    // Favorites still work for this visit when browser storage is unavailable.
  }
  preserveFocus(() => {
    renderSchedule();
    renderDirectory();
  });
}

function renderFavoriteButton(button, truckName) {
  const isFavorite = state.favoriteTrucks.has(normalizeTruckName(truckName));
  button.setAttribute("aria-pressed", String(isFavorite));
  button.setAttribute("aria-label", `${isFavorite ? "Remove" : "Add"} ${truckName} ${isFavorite ? "from" : "to"} favorites`);
  button.classList.toggle("is-favorite", isFavorite);
  button.querySelector(".favorite-icon").textContent = isFavorite ? "★" : "☆";
  button.querySelector("span:last-child").textContent = isFavorite ? "Favorited" : "Favorite";
  button.addEventListener("click", () => toggleFavorite(truckName));
}

function renderScheduleMeta(meta, item) {
  meta.replaceChildren(
    document.createTextNode(`${formatTime(item.start)} - ${formatTime(item.end)} at `),
    Object.assign(document.createElement("span"), {
      className: "venue-name-pill",
      textContent: item.venue
    }),
    document.createTextNode(` | ${item.cuisine}`)
  );
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
    const outdated = venues.some((venue) => (!selectedVenue || venue.id === selectedVenue.id) && ["stale", "error", "unknown"].includes(getDataStatus(venue)));
    list.innerHTML = `<div class="empty-state">${dataLoadErrors.size
      ? "The schedule could not be loaded. Reload the page or check the venue website."
      : outdated ? "No current stops are confirmed for these filters. Some schedules need an update; check the venue website."
        : "No trucks are listed for these filters. Try the next seven days or another venue."}</div>`;
    return;
  }

  items.forEach((item) => {
    const clone = template.content.cloneNode(true);
    clone.querySelector(".favorite-button").dataset.focusKey = `schedule-favorite:${item.date}:${item.start}:${item.venue}:${normalizeTruckName(item.truck)}`;
    clone.querySelector(".date-badge").textContent = dateFormatter.format(parseDate(item.date));
    clone.querySelector(".source-badge").textContent = recordLabel(item);
    clone.querySelector(".source-badge").classList.add(sourceAppearance(item));
    clone.querySelector("h3").textContent = item.truck;
    renderScheduleMeta(clone.querySelector(".meta"), item);
    renderTags(clone.querySelector(".tag-row"), item.tags || []);
    clone.querySelector(".source-link").href = safeHttpUrl(item.source);
    renderFavoriteButton(clone.querySelector(".favorite-button"), item.truck);

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
    list.innerHTML = `<div class="empty-state">${state.directoryFavoritesOnly ? "No favorite trucks match this search." : state.directoryQuery ? "No trucks match this search." : "No food trucks are in the directory yet."}</div>`;
    return;
  }

  trucks.forEach((truck) => {
    const clone = template.content.cloneNode(true);
    const truckKey = normalizeTruckName(truck.name);
    clone.querySelector(".favorite-button").dataset.focusKey = `directory-favorite:${truckKey}`;
    const cuisineLabel = truck.cuisines.join(", ") || "Cuisine not listed";
    const venueLabel = truck.venues.join(", ");
    const metaParts = [cuisineLabel, venueLabel].filter(Boolean);

    clone.querySelector(".source-badge").textContent = recordLabel(truck);
    clone.querySelector(".source-badge").classList.add(sourceAppearance(truck));
    clone.querySelector("h3").textContent = truck.name;
    renderFavoriteButton(clone.querySelector(".favorite-button"), truck.name);
    clone.querySelector(".meta").textContent = metaParts.join(" | ");
    renderTags(clone.querySelector(".tag-row"), truck.tags.slice(0, 6));
    const linksContainer = clone.querySelector(".directory-links");
    linksContainer.replaceChildren();
    for (const [url, label] of [[truck.truckUrl, "Truck site"], [truck.menuUrl, "Menu"]]) {
      if (!url) continue;
      const link = document.createElement("a");
      link.href = safeHttpUrl(url);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = label;
      link.dataset.focusKey = `directory-link:${truckKey}:${label}`;
      linksContainer.appendChild(link);
    }
    if (!linksContainer.childElementCount) {
      const empty = document.createElement("span");
      empty.textContent = "No truck link yet";
      linksContainer.appendChild(empty);
    }
    clone.querySelector(".next-stop").textContent = truck.nextStopLabel || (truck.nextStop ? formatStop(truck.nextStop) : "No upcoming stop found");
    clone.querySelector(".last-seen").textContent = truck.lastSeenLabel || (truck.lastSeen ? formatStop(truck.lastSeen) : "Not seen yet in current data");

    const knownStopsButton = clone.querySelector(".known-stops-button");
    knownStopsButton.dataset.focusKey = `directory-stops:${truckKey}`;
    const stopsList = clone.querySelector(".known-stops-list");
    knownStopsButton.querySelector(".appearance-count").textContent = truck.appearanceLabel || `${truck.events.length} ${truck.events.length === 1 ? "stop" : "stops"}`;

    if (!truck.venueStops.length) {
      knownStopsButton.disabled = true;
      stopsList.hidden = true;
    } else {
      const expanded = state.expandedKnownStops.has(truckKey);
      knownStopsButton.setAttribute("aria-expanded", String(expanded));
      stopsList.hidden = !expanded;
      stopsList.replaceChildren();
      truck.venueStops.forEach((stop) => {
        const row = document.createElement("div");
        row.className = "known-stop-row";
        const venueName = document.createElement("span");
        venueName.textContent = stop.venue;
        const count = document.createElement("strong");
        count.textContent = `${stop.count} ${stop.count === 1 ? "stop" : "stops"}`;
        row.append(venueName, count);
        stopsList.appendChild(row);
      });
      knownStopsButton.addEventListener("click", () => {
        if (state.expandedKnownStops.has(truckKey)) {
          state.expandedKnownStops.delete(truckKey);
        } else {
          state.expandedKnownStops.add(truckKey);
        }
        preserveFocus(renderDirectory);
      });
    }

    list.appendChild(clone);
  });
}

function formatFreshness(iso) {
  if (!iso) return "not available";
  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (ageMinutes < 60) return `${ageMinutes} min ago`;
  if (ageMinutes < 1440) return `${Math.round(ageMinutes / 60)} hr ago`;
  return `${Math.round(ageMinutes / 1440)} days ago`;
}

function renderFreshnessBanner(payload) {
  const banner = document.querySelector("#freshnessBanner");
  if (!banner) return;
  const sourceList = payload.venues || [];
  const scheduleSources = sourceList.filter((source) => !["permanent_food", "permanent_truck"].includes(source.sourceStatus));
  const freshCount = scheduleSources.filter((source) => getDataStatus(source) === "fresh").length;
  const staleCount = sourceList.filter((source) => getDataStatus(source) === "stale").length;
  const errorCount = sourceList.filter((source) => getDataStatus(source) === "error").length;
  const unknownCount = sourceList.filter((source) => getDataStatus(source) === "unknown").length;
  const hasWarning = dataLoadErrors.size > 0 || staleCount > 0 || errorCount > 0 || unknownCount > 0 || payload.dataStatus === "partial";
  banner.hidden = !hasWarning;
  banner.className = `freshness-banner ${errorCount ? "is-error" : "is-stale"}`;
  if (!hasWarning) return;
  if (dataLoadErrors.size) {
    banner.textContent = "Schedule data could not be loaded. Reload the page or use the venue websites to confirm today's food.";
    banner.className = "freshness-banner is-error";
    return;
  }
  banner.textContent = `${freshCount} of ${scheduleSources.length} schedules fresh. Updated ${formatFreshness(payload.lastSuccessfulAt || payload.generatedAt)}. Please confirm stale venues before heading out.`;
}

function renderTopPick(payload) {
  const today = getBallardToday();
  const todayItems = schedule
    .filter((item) => item.date === today && !isEventEnded(item) && getDataStatus(item) === "fresh")
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const topPick = todayItems[0];
  document.querySelector("#topPick").textContent = topPick
    ? `${topPick.truck} at ${topPick.venue}, ${formatTime(topPick.start)} - ${formatTime(topPick.end)}`
    : schedule.some((item) => item.date === today && !isEventEnded(item) && getDataStatus(item) !== "fresh")
      ? "Today's schedule needs an update"
      : schedule.some((item) => item.date === today) ? "No more trucks tonight" : "No verified trucks for today yet";
  document.querySelector("#freshness").textContent = payload.lastSuccessfulAt || payload.generatedAt
    ? `Updated ${formatFreshness(payload.lastSuccessfulAt || payload.generatedAt)}`
    : "Update time unavailable";
  renderFreshnessBanner(payload);
}

function wireControls() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((chip) => chip.classList.remove("is-active"));
      document.querySelectorAll("[data-filter]").forEach((chip) => chip.setAttribute("aria-pressed", String(chip === button)));
      button.classList.add("is-active");
      renderSchedule();
      renderTopPick(sourceMetadata);
    });
  });

  document.querySelector("#directorySearch").addEventListener("input", (event) => {
    state.directoryQuery = event.target.value;
    renderDirectory();
  });

  document.querySelector("#favoritesOnlyToggle").addEventListener("click", (event) => {
    state.directoryFavoritesOnly = !state.directoryFavoritesOnly;
    event.currentTarget.setAttribute("aria-pressed", String(state.directoryFavoritesOnly));
    event.currentTarget.classList.toggle("is-active", state.directoryFavoritesOnly);
    renderDirectory();
  });

  window.addEventListener("resize", () => {
    venueMap?.invalidateSize();
    fitVenueBounds();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshClock();
  });
  window.setInterval(refreshClock, 60_000);
}

function refreshClock() {
  if (document.hidden) return;
  preserveFocus(() => {
    renderTopPick(sourceMetadata);
    renderSchedule();
    renderDirectory();
    renderVenues();
    renderVenueMap();
  });
}

async function loadJson(url, fallback, validate) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = await response.json();
    if (!validate(payload)) throw new Error("Unexpected data format");
    return payload;
  } catch (error) {
    console.warn(`Unable to load ${url}:`, error);
    dataLoadErrors.add(url);
    return fallback;
  }
}

async function init() {
  const [loadedSchedule, loadedSources] = await Promise.all([
    loadJson("data/schedule.json", [], Array.isArray),
    loadJson("data/sources.json", fallbackSources, (payload) => payload && Array.isArray(payload.venues))
  ]);
  schedule = Array.isArray(loadedSchedule) ? loadedSchedule : [];
  venues = loadedSources.venues || fallbackSources.venues;
  sourceMetadata = loadedSources;

  renderTopPick(loadedSources);
  renderVenues();
  renderVenueMap();
  wireControls();
  renderSchedule();
  renderDirectory();
}

init();
