
const sampleEvents = [
  {
    id: 1,
    title: "The Future of AI",
    category: "Technology",
    location: "Navi Mumbai",
    venue: "Innovation Centre, Vashi",
    date: "2026-11-14",
    time: "10:00",
    description: "Explore artificial intelligence, emerging technologies, and real-world applications with fellow tech enthusiasts.",
    image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 2,
    title: "Creative Minds Workshop",
    category: "Workshop",
    location: "Mumbai",
    venue: "The Design Studio, Bandra",
    date: "2026-11-08",
    time: "11:00",
    description: "An interactive creative workshop for curious minds who want to learn new skills and collaborate on ideas.",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 3,
    title: "Startup Connect",
    category: "Business",
    location: "Navi Mumbai",
    venue: "Business Hub, Belapur",
    date: "2026-11-21",
    time: "14:00",
    description: "Meet aspiring founders, exchange ideas, and discover opportunities to turn your next big idea into reality.",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 4,
    title: "Art After Hours",
    category: "Arts",
    location: "Mumbai",
    venue: "Kala Gallery, Fort",
    date: "2026-11-12",
    time: "17:30",
    description: "Spend an evening exploring local art, creative expression, and the stories behind emerging artists.",
    image: "https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 5,
    title: "Code & Coffee",
    category: "Technology",
    location: "Panvel",
    venue: "The Coffee Lab, Panvel",
    date: "2026-11-07",
    time: "09:30",
    description: "A relaxed meetup for coding enthusiasts to share projects, discuss ideas, and learn from each other.",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 6,
    title: "Community Clean-Up",
    category: "Community",
    location: "Navi Mumbai",
    venue: "Palm Beach Road",
    date: "2026-11-15",
    time: "08:00",
    description: "Join local volunteers for a community initiative that brings neighbours together to care for shared spaces.",
    image: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 7,
    title: "Design Thinking Live",
    category: "Workshop",
    location: "Online",
    venue: "Online session",
    date: "2026-11-10",
    time: "18:00",
    description: "Learn practical design-thinking techniques to understand problems, generate ideas, and create useful solutions.",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 8,
    title: "Founders' Open Mic",
    category: "Business",
    location: "Panvel",
    venue: "The Community Room, Panvel",
    date: "2026-11-18",
    time: "16:00",
    description: "An informal gathering where aspiring entrepreneurs share early-stage ideas and receive community feedback.",
    image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 9,
    title: "Digital Art Showcase",
    category: "Arts",
    location: "Online",
    venue: "Online exhibition",
    date: "2026-11-25",
    time: "19:00",
    description: "Discover digital illustrations and creative experiments from artists exploring new ways to tell stories.",
    image: "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=80"
  }
];

const STORAGE_KEYS = {
  saved: "eventora_saved_v1",
  custom: "eventora_custom_v1"
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

let customEvents = readStorage(STORAGE_KEYS.custom, []);
let savedIds = readStorage(STORAGE_KEYS.saved, []);

if (!Array.isArray(customEvents)) customEvents = [];
if (!Array.isArray(savedIds)) savedIds = [];

let activeCategory = "All";
let searchTerm = "";
let activeLocation = "all";

const grid = document.getElementById("event-grid");
const savedGrid = document.getElementById("saved-grid");
const savedCount = document.getElementById("saved-count");
const savedEmpty = document.getElementById("saved-empty");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const locationFilter = document.getElementById("location-filter");
const sortFilter = document.getElementById("sort-filter");
const eventDialog = document.getElementById("event-dialog");
const detailsDialog = document.getElementById("details-dialog");
const detailsContent = document.getElementById("details-content");
const toast = document.getElementById("toast");

function getEvents() {
  return [...sampleEvents, ...customEvents];
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(dateString) {
  const date = new Date(dateString + "T12:00:00");

  if (Number.isNaN(date.getTime())) return "Date to be announced";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatTime(timeString) {
  if (!timeString) return "Time TBA";

  const parts = timeString.split(":");
  const date = new Date();
  date.setHours(Number(parts[0]), Number(parts[1]), 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showToast("Storage unavailable. Changes may not persist.");
    return false;
  }
}

function getFilteredEvents() {
  let events = getEvents().filter(event => {
    const searchText = [
      event.title,
      event.category,
      event.location,
      event.venue,
      event.description
    ].join(" ").toLowerCase();

    const matchesSearch = searchText.includes(searchTerm);
    const matchesCategory =
      activeCategory === "All" || event.category === activeCategory;
    const matchesLocation =
      activeLocation === "all" || event.location === activeLocation;

    return matchesSearch && matchesCategory && matchesLocation;
  });

  if (sortFilter.value === "name") {
    events.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    events.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare || a.time.localeCompare(b.time);
    });
  }

  return events;
}

function eventCard(event, compact = false) {
  const isSaved = savedIds.includes(event.id);

  return `
    <article class="event-card">
      <div class="event-image">
        <img
          src="${escapeHTML(event.image)}"
          alt="${escapeHTML(event.title)}"
          loading="lazy"
          onerror="this.style.display='none'"
        >
        <span class="event-category">${escapeHTML(event.category)}</span>
        <button
          class="save-button ${isSaved ? "saved" : ""}"
          data-action="save"
          data-id="${event.id}"
          aria-label="${isSaved ? "Remove saved event" : "Save event"}"
          aria-pressed="${isSaved}"
          title="${isSaved ? "Remove from saved" : "Save event"}"
        >${isSaved ? "♥" : "♡"}</button>
      </div>
      <div class="event-body">
        <p class="event-date">${escapeHTML(formatDate(event.date))}</p>
        <h3 class="event-title">${escapeHTML(event.title)}</h3>
        <p class="event-description">${escapeHTML(event.description)}</p>
        <div class="event-info">
          <span>⌖ ${escapeHTML(event.location)}</span>
          <span>◷ ${escapeHTML(formatTime(event.time))}</span>
        </div>
        <div class="event-footer">
          <span class="event-date">${escapeHTML(event.category)}</span>
          <button
            class="gold-text-button"
            data-action="details"
            data-id="${event.id}"
          >View details ↗</button>
        </div>
      </div>
    </article>
  `;
}

function renderEvents() {
  const events = getFilteredEvents();

  grid.innerHTML = events.map(event => eventCard(event)).join("");
  emptyState.classList.toggle("hidden", events.length !== 0);

  document.getElementById("results-title").textContent =
    searchTerm || activeCategory !== "All" || activeLocation !== "all"
      ? "Your matching experiences"
      : "Upcoming experiences";

  document.getElementById("results-description").textContent =
    `${events.length} event${events.length === 1 ? "" : "s"} to explore`;

  renderSaved();
}

function renderSaved() {
  const allEvents = getEvents();
  const savedEvents = savedIds
    .map(id => allEvents.find(event => event.id === id))
    .filter(Boolean);

  savedCount.textContent = savedEvents.length;
  savedGrid.innerHTML = savedEvents.map(event => eventCard(event, true)).join("");
  savedEmpty.classList.toggle("hidden", savedEvents.length !== 0);
}

function toggleSaved(id) {
  if (savedIds.includes(id)) {
    savedIds = savedIds.filter(savedId => savedId !== id);
    saveStorage(STORAGE_KEYS.saved, savedIds);
    showToast("Removed from your saved events.");
  } else {
    savedIds.push(id);
    const stored = saveStorage(STORAGE_KEYS.saved, savedIds);
    if (stored) showToast("Event saved to your collection! ♥");
  }

  renderEvents();
}

function openDetails(id) {
  const event = getEvents().find(item => item.id === id);
  if (!event) return;

  detailsContent.innerHTML = `
    <div class="dialog-heading">
      <p class="eyebrow">THE DETAILS</p>
      <button class="close-dialog" id="close-details" aria-label="Close">×</button>
    </div>
    <img class="detail-image"
      src="${escapeHTML(event.image)}"
      alt="${escapeHTML(event.title)}"
      onerror="this.style.display='none'">
    <p class="event-date">${escapeHTML(event.category)}</p>
    <h2 style="font-family:var(--serif);font-size:30px;font-weight:500;margin-top:8px">
      ${escapeHTML(event.title)}
    </h2>
    <p class="detail-copy">${escapeHTML(event.description)}</p>
    <div class="detail-meta">
      <span>▦ ${escapeHTML(formatDate(event.date))}</span>
      <span>◷ ${escapeHTML(formatTime(event.time))}</span>
      <span>⌖ ${escapeHTML(event.location)} — ${escapeHTML(event.venue)}</span>
    </div>
    <button class="gold-button" id="details-save" style="width:100%">
      ${savedIds.includes(event.id) ? "♥ Saved — Remove bookmark" : "♡ Save this event"}
    </button>
    <p class="form-note">Demo event details. External registration is not connected yet.</p>
  `;

  detailsDialog.showModal();

  document.getElementById("close-details").addEventListener("click", () => {
    detailsDialog.close();
  });

  document.getElementById("details-save").addEventListener("click", () => {
    toggleSaved(event.id);
    openDetails(event.id);
  });
}

function openCreateDialog() {
  const form = document.getElementById("create-form");
  const dateInput = form.elements.date;

  // Prevent selecting a date before today for newly created events.
  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");

  dateInput.min = localToday;
  eventDialog.showModal();
}

document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;

    document.querySelectorAll("[data-category]").forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", active);
    });

    renderEvents();
  });
});

document.getElementById("search-form").addEventListener("submit", event => {
  event.preventDefault();
  searchTerm = searchInput.value.trim().toLowerCase();
  renderEvents();
  document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
});

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  renderEvents();
});

locationFilter.addEventListener("change", () => {
  activeLocation = locationFilter.value;
  renderEvents();
});

sortFilter.addEventListener("change", renderEvents);

document.getElementById("reset-filters").addEventListener("click", () => {
  activeCategory = "All";
  searchTerm = "";
  activeLocation = "all";
  searchInput.value = "";
  locationFilter.value = "all";

  document.querySelectorAll("[data-category]").forEach(button => {
    const active = button.dataset.category === "All";
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active);
  });

  renderEvents();
});

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  if (!Number.isSafeInteger(id)) return;

  if (button.dataset.action === "save") {
    toggleSaved(id);
  }

  if (button.dataset.action === "details") {
    openDetails(id);
  }
});

document.getElementById("open-create").addEventListener("click", openCreateDialog);
document.getElementById("banner-create").addEventListener("click", openCreateDialog);
document.getElementById("close-create").addEventListener("click", () => {
  eventDialog.close();
});

document.getElementById("create-form").addEventListener("submit", event => {
  event.preventDefault();

  const form = event.currentTarget;
  const values = new FormData(form);
  const title = String(values.get("title")).trim();
  const venue = String(values.get("venue")).trim();
  const description = String(values.get("description")).trim();
  const date = String(values.get("date"));
  const time = String(values.get("time"));

  if (!title || !venue || !description || !date || !time) {
    showToast("Please complete all the fields.");
    return;
  }

  const newEvent = {
    id: Date.now(),
    title,
    category: String(values.get("category")),
    location: String(values.get("location")),
    venue,
    date,
    time,
    description,
    image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80"
  };

  customEvents.push(newEvent);

  if (!saveStorage(STORAGE_KEYS.custom, customEvents)) {
    customEvents.pop();
    return;
  }

  form.reset();
  eventDialog.close();

  activeCategory = "All";
  activeLocation = "all";
  searchTerm = "";
  searchInput.value = "";
  locationFilter.value = "all";

  document.querySelectorAll("[data-category]").forEach(button => {
    const active = button.dataset.category === "All";
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active);
  });

  renderEvents();
  showToast("Your event has been published!");
  document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("menu-toggle").addEventListener("click", () => {
  const nav = document.querySelector(".nav-links");
  const isOpen = nav.classList.toggle("open");
  document.getElementById("menu-toggle").setAttribute("aria-expanded", isOpen);
});

document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelector(".nav-links").classList.remove("open");
    document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
  });
});

document.getElementById("saved-count").parentElement.addEventListener("click", () => {
  renderSaved();
});

// Initial page render
renderEvents();
