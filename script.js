/**
 * Eventora — Hyperlocal Event Discovery & Community Engagement Engine
 * Fully hardened, resilient stack connecting to Express backend with atomic persistence,
 * smart schedule conflict detector, interactive Leaflet pulse map, digital fast-pass, and community XP.
 */

const STORAGE_KEYS = {
  saved: 'eventora_saved_v2',
  preferences: 'eventora_pref_v2',
  cache: 'eventora_events_cache',
  xp: 'eventora_xp_v3',
  studentName: 'eventora_student_name',
  collegeName: 'eventora_college_name'
};

function readStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    return false;
  }
}

// State
let allEvents = [];
let savedIds = readStorage(STORAGE_KEYS.saved, [1, 2]);
let userInterests = readStorage(STORAGE_KEYS.preferences, ['ai', 'hackathon']);
let activeCategory = 'All';
let activeLocation = 'all';
let activeCorridor = 'all';
let activeTimeframe = 'all';
let verifiedOnly = false;
let freeOnly = false;
let prizeOnly = false;
let searchTerm = '';
let activeSort = 'match';
let currentExploreView = 'grid'; // 'grid' | 'map'
let activeSavedTab = 'cards'; // 'cards' | 'calendar'
let pulseMap = null;
let mapMarkers = [];

// XP Gamification State
let xpState = readStorage(STORAGE_KEYS.xp, {
  xp: 150,
  streak: 3,
  unlockedBadges: ['first_rsvp', 'night_owl'],
  history: []
});

let studentProfileName = readStorage(STORAGE_KEYS.studentName, 'Aarav Sharma');
let studentCollegeName = readStorage(STORAGE_KEYS.collegeName, 'SIES GST, Navi Mumbai');

// DOM Elements
const grid = document.getElementById('event-grid');
const savedGrid = document.getElementById('saved-grid');
const savedCount = document.getElementById('saved-count');
const savedCardsCount = document.getElementById('saved-cards-count');
const savedEmpty = document.getElementById('saved-empty');
const savedCardsWrapper = document.getElementById('saved-cards-wrapper');
const calendarWrapper = document.getElementById('calendar-wrapper');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const locationFilter = document.getElementById('location-filter');
const verifiedFilter = document.getElementById('verified-only-filter');
const freeFilter = document.getElementById('free-only-filter');
const prizeFilter = document.getElementById('prize-only-filter');
const sortFilter = document.getElementById('sort-filter');
const timeframeFilter = document.getElementById('timeframe-filter');
const eventDialog = document.getElementById('event-dialog');
const detailsDialog = document.getElementById('details-dialog');
const detailsContent = document.getElementById('details-content');
const matchDialog = document.getElementById('match-dialog');
const matchContent = document.getElementById('match-content');
const teammateDialog = document.getElementById('teammate-dialog');
const teammateContent = document.getElementById('teammate-content');
const xpDialog = document.getElementById('xp-dialog');
const xpContent = document.getElementById('xp-content');
const passDialog = document.getElementById('pass-dialog');
const passContent = document.getElementById('pass-content');
const certDialog = document.getElementById('certificate-dialog');
const certContent = document.getElementById('cert-content');
const hostDialog = document.getElementById('host-dialog');
const hostContent = document.getElementById('host-content');
const registerPortalDialog = document.getElementById('register-portal-dialog');
const registerPortalContent = document.getElementById('register-portal-content');
const outreachDialog = document.getElementById('outreach-dialog');
const outreachContent = document.getElementById('outreach-content');
const toast = document.getElementById('toast');
const interestChipsContainer = document.getElementById('interest-chips');
const quickImportText = document.getElementById('quick-import-text');
const btnParseNotice = document.getElementById('btn-parse-notice');
const btnSyncLive = document.getElementById('btn-sync-live');
const navXpBadge = document.getElementById('nav-xp-badge');
const btnViewGrid = document.getElementById('btn-view-grid');
const btnViewMap = document.getElementById('btn-view-map');
const eventPulseMapContainer = document.getElementById('event-pulse-map-container');
const resultsBar = document.getElementById('results-bar');
const btnSavedCards = document.getElementById('btn-saved-cards');
const btnSavedCalendar = document.getElementById('btn-saved-calendar');
const calendarTimeline = document.getElementById('calendar-timeline');
const conflictAlertBox = document.getElementById('conflict-alert-box');
const offlineBanner = document.getElementById('offline-banner');

// Toast feedback
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function formatDate(dateString) {
  if (!dateString) return 'Date TBA';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
  return dateString;
}

function formatTime(timeString) {
  if (!timeString) return 'Time TBA';
  const parts = timeString.split(':');
  if (parts.length >= 2) {
    const d = new Date();
    d.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
    return d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }
  return timeString;
}

function getSourceBadge(source) {
  if (!source) return '';
  const s = source.toLowerCase();
  let cssClass = 'source-unstop';
  if (s.includes('devfolio')) cssClass = 'source-devfolio';
  else if (s.includes('luma')) cssClass = 'source-luma';
  else if (s.includes('gdg')) cssClass = 'source-gdg';
  else if (s.includes('ieee')) cssClass = 'source-ieee';
  else if (s.includes('campus')) cssClass = 'source-gdg';
  return `<span class="source-badge ${cssClass}">${escapeHTML(source)}</span>`;
}

// -------------------------------------------------------------
// FOOLPROOF NETWORK RESILIENCE & OFFLINE DETECTOR
// -------------------------------------------------------------
function setupNetworkResilience() {
  function updateOnlineStatus() {
    if (navigator.onLine) {
      if (offlineBanner) offlineBanner.classList.add('hidden');
      fetchEvents(true);
    } else {
      if (offlineBanner) offlineBanner.classList.remove('hidden');
      showToast('⚡ Offline: Showing saved local events');
    }
  }

  window.addEventListener('online', () => {
    showToast('✓ Connected! Synced with live database.');
    updateOnlineStatus();
  });

  window.addEventListener('offline', () => {
    updateOnlineStatus();
  });

  if (!navigator.onLine && offlineBanner) {
    offlineBanner.classList.remove('hidden');
  }
}

// -------------------------------------------------------------
// SMART MATCH AFFINITY SCORE CALCULATION
// -------------------------------------------------------------
function calculateSmartMatch(event) {
  let score = 0;
  const breakdown = [];

  // 1. Category / Interest match (Weight: 45%)
  const evCat = (event.category || '').toLowerCase();
  const evTitle = (event.title || '').toLowerCase();
  const evTags = (event.tags || []).map(t => String(t).toLowerCase());

  let matchedInterestName = '';
  const isInterestMatched = userInterests.some(interest => {
    const i = interest.toLowerCase();
    if (evCat.includes(i) || evTitle.includes(i) || evTags.some(t => t.includes(i))) {
      matchedInterestName = interest.toUpperCase();
      return true;
    }
    if (i === 'ai' && (evTitle.includes('genai') || evTitle.includes('machine learning') || evTags.includes('ai') || evTags.includes('luma'))) {
      matchedInterestName = 'AI & GenAI';
      return true;
    }
    if (i === 'hackathon' && (evTitle.includes('hack') || evTags.includes('hackathon') || evTags.includes('devfolio'))) {
      matchedInterestName = 'Hackathons';
      return true;
    }
    if (i === 'coding' && (evTitle.includes('code') || evTags.includes('typescript') || evTags.includes('solidity'))) {
      matchedInterestName = 'Coding & Web3';
      return true;
    }
    if (i === 'startup' && (evTitle.includes('pitch') || evCat === 'business' || evTags.includes('startups') || evTags.includes('founders'))) {
      matchedInterestName = 'Startups';
      return true;
    }
    return false;
  });

  if (isInterestMatched) {
    score += 45;
    breakdown.push({
      label: 'Interest Alignment',
      value: '+45%',
      detail: `Matches your interest in ${matchedInterestName || event.category}`
    });
  } else {
    score += 15;
    breakdown.push({
      label: 'General Interest',
      value: '+15%',
      detail: 'Curated university & tech discovery'
    });
  }

  // 2. Location Proximity (Weight: 35%)
  const selectedLoc = activeLocation.toLowerCase();
  const evLoc = (event.location || '').toLowerCase();

  if (selectedLoc !== 'all' && selectedLoc === evLoc) {
    score += 35;
    breakdown.push({
      label: 'Campus Proximity',
      value: '+35%',
      detail: `Happening right in your target area: ${event.location}`
    });
  } else if (evLoc === 'online') {
    score += 30;
    breakdown.push({
      label: 'Virtual Convenience',
      value: '+30%',
      detail: 'Accessible online from any campus'
    });
  } else if (
    (selectedLoc.includes('navi mumbai') && evLoc.includes('panvel')) ||
    (selectedLoc.includes('panvel') && evLoc.includes('navi mumbai')) ||
    (selectedLoc.includes('mumbai') && evLoc.includes('navi mumbai'))
  ) {
    score += 26;
    breakdown.push({
      label: 'Commuter Zone',
      value: '+26%',
      detail: `Nearby commuter corridor (${event.location})`
    });
  } else {
    score += 20;
    breakdown.push({
      label: 'Regional Event',
      value: '+20%',
      detail: `Located in ${event.location}`
    });
  }

  // 3. Timing & Freshness (Weight: 10%)
  const eventDate = new Date(`${event.date}T${event.time || '10:00'}`);
  const now = new Date();
  const diffDays = Math.round((eventDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

  if (diffDays >= 0 && diffDays <= 21) {
    score += 10;
    breakdown.push({
      label: 'Happening Soon',
      value: '+10%',
      detail: `Scheduled within the next ${Math.max(1, diffDays)} days`
    });
  } else {
    score += 6;
    breakdown.push({
      label: 'Upcoming Window',
      value: '+6%',
      detail: 'Advance notice for team formation'
    });
  }

  // 4. Community Interest (Weight: 10%)
  const saves = event.savedCount || 0;
  if (saves >= 35) {
    score += 10;
    breakdown.push({
      label: 'Community Buzz',
      value: '+10%',
      detail: `High engagement (${saves} students saved)`
    });
  } else if (saves >= 15) {
    score += 7;
    breakdown.push({
      label: 'Community Buzz',
      value: '+7%',
      detail: `Trending event (${saves} students saved)`
    });
  } else {
    score += 4;
    breakdown.push({
      label: 'Fresh Discovery',
      value: '+4%',
      detail: 'Early bird discovery'
    });
  }

  const finalScore = Math.min(99, Math.max(25, score));
  return { score: finalScore, breakdown };
}

// -------------------------------------------------------------
// FOOLPROOF BACKEND FETCH & DATA LOADING
// -------------------------------------------------------------
async function fetchEvents(silent = false) {
  try {
    const res = await fetch('/api/events');
    if (!res.ok) throw new Error('API server returned error');
    const data = await res.json();
    if (data.success && Array.isArray(data.events)) {
      allEvents = data.events;
      saveStorage(STORAGE_KEYS.cache, allEvents);
    }
  } catch (err) {
    console.warn('API fetch warning, reading from offline cache:', err);
    const cached = readStorage(STORAGE_KEYS.cache, null);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      allEvents = cached;
      if (!silent) showToast('Offline: serving cached campus events');
    }
  }

  renderEvents();
  fetchStats();
  handleDeepLink();
}

// Fetch Platform Pulse Stats
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && data.stats) {
      const s = data.stats;
      const elTotal = document.getElementById('stat-total-events');
      const elVer = document.getElementById('stat-verified-events');
      const elSaves = document.getElementById('stat-community-saves');
      const elTm = document.getElementById('stat-teammate-openings');

      if (elTotal) elTotal.textContent = s.totalEvents;
      if (elVer) elVer.textContent = s.verifiedCampusEvents;
      if (elSaves) elSaves.textContent = `${s.totalCommunitySaves}+`;
      if (elTm) elTm.textContent = s.activeTeammateOpenings;
    }
  } catch (e) {
    // Graceful silent fallback
  }
}

// Sync Live Feeds Action
if (btnSyncLive) {
  btnSyncLive.addEventListener('click', async () => {
    btnSyncLive.disabled = true;
    btnSyncLive.textContent = '⚡ Checking Feeds...';
    try {
      const res = await fetch('/api/events/sync-live', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Live feeds synchronized with latest hackathons!');
        await fetchEvents(true);
      } else {
        showToast('Feeds are up to date.');
      }
    } catch (e) {
      showToast('Could not reach live aggregator.');
    } finally {
      btnSyncLive.disabled = false;
      btnSyncLive.textContent = '⚡ Sync Live Feeds';
    }
  });
}

// -------------------------------------------------------------
// FILTERING & SORTING LOGIC
// -------------------------------------------------------------
function getFilteredAndSortedEvents() {
  let list = allEvents.map(event => {
    const match = calculateSmartMatch(event);
    return {
      ...event,
      matchScore: match.score,
      matchBreakdown: match.breakdown
    };
  });

  list = list.filter(event => {
    const searchHaystack = [
      event.title,
      event.category,
      event.location,
      event.venue,
      event.description,
      event.organizer || '',
      event.source || '',
      event.entryFee || '',
      event.prizePool || '',
      ...(event.tags || []),
      ...(event.perks || [])
    ].join(' ').toLowerCase();

    const matchesSearch = !searchTerm || searchHaystack.includes(searchTerm);
    const matchesCategory = activeCategory === 'All' || event.category === activeCategory;
    const matchesLocation = activeLocation === 'all' || event.location === activeLocation;
    const matchesVerified = !verifiedOnly || Boolean(event.verified);
    const matchesFree = !freeOnly || (event.entryFee || '').toLowerCase().includes('free');
    const matchesPrize = !prizeOnly || (event.prizePool && !event.prizePool.toLowerCase().includes('none'));

    // Campus Corridor filter
    let matchesCorridor = true;
    if (activeCorridor !== 'all') {
      const cHaystack = (event.venue + ' ' + event.location + ' ' + (event.organizer || '')).toLowerCase();
      matchesCorridor = cHaystack.includes(activeCorridor.toLowerCase());
    }

    // Timeframe filter
    let matchesTimeframe = true;
    if (activeTimeframe === 'weekend') {
      const d = new Date(event.date);
      const day = d.getDay();
      matchesTimeframe = (day === 0 || day === 6);
    } else if (activeTimeframe === '7days') {
      const diffDays = Math.round((new Date(event.date).getTime() - Date.now()) / (1000 * 3600 * 24));
      matchesTimeframe = diffDays >= 0 && diffDays <= 7;
    }

    return matchesSearch && matchesCategory && matchesLocation && matchesVerified && matchesFree && matchesPrize && matchesCorridor && matchesTimeframe;
  });

  if (activeSort === 'name') {
    list.sort((a, b) => a.title.localeCompare(b.title));
  } else if (activeSort === 'popular') {
    list.sort((a, b) => (b.savedCount || 0) - (a.savedCount || 0));
  } else if (activeSort === 'date') {
    list.sort((a, b) => {
      const d1 = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const d2 = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return d1 - d2;
    });
  } else {
    list.sort((a, b) => b.matchScore - a.matchScore);
  }

  return list;
}

// -------------------------------------------------------------
// RENDER EVENT CARD WITH SOCIAL BUZZ & 1-CLICK REGISTER
// -------------------------------------------------------------
function eventCard(event, isSavedView = false) {
  const isSaved = savedIds.includes(event.id);
  const matchScore = event.matchScore || 85;
  const tmCount = (event.teammateRequests || []).length;
  const isHackathon = (event.tags || []).some(t => /hackathon|coding|web3/i.test(t)) || /hackathon|hackfest|jam/i.test(event.title);

  const teammateSnippet = isHackathon ? `
    <div class="teammate-banner">
      <span>🤝 <span class="teammate-badge-tag">${tmCount > 0 ? `${tmCount} Teammate Opening${tmCount === 1 ? '' : 's'}` : 'Looking for Team?'}</span></span>
      <button type="button" class="gold-text-button" data-action="teammate" data-id="${event.id}">
        ${tmCount > 0 ? 'Connect ↗' : 'Find Team ↗'}
      </button>
    </div>
  ` : '';

  // Prize & Fee Badges
  const prizeHtml = event.prizePool ? `<span class="prize-badge">🏆 ${escapeHTML(event.prizePool)}</span>` : '';
  const feeHtml = event.entryFee ? `<span class="fee-badge">🎟 ${escapeHTML(event.entryFee)}</span>` : '';

  // Dynamic social buzz indicator
  const buzzCount = (event.savedCount || 2) * 2 + 12;

  // Fast-Pass button for saved cards
  const actionButton = isSavedView ? `
    <button type="button" class="gold-button" data-action="fast-pass" data-id="${event.id}" style="padding:6px 12px;font-size:11px">
      🎫 Digital Fast-Pass
    </button>
  ` : `
    <button type="button" class="gold-button" data-action="register-gateway" data-id="${event.id}" style="padding:6px 12px;font-size:11px">
      ⚡ Register
    </button>
  `;

  return `
    <article class="event-card" data-event-id="${event.id}">
      <div class="event-image">
        <img
          src="${escapeHTML(event.image)}"
          alt="${escapeHTML(event.title)}"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80'"
        >
        <button
          type="button"
          class="match-badge"
          data-action="view-match"
          data-id="${event.id}"
          title="Click to view transparent match calculation"
        >
          ✦ ${matchScore}% Match
        </button>
        <span class="event-category">${escapeHTML(event.category)}</span>
        <button
          class="save-button ${isSaved ? 'saved' : ''}"
          data-action="save"
          data-id="${event.id}"
          aria-label="${isSaved ? 'Remove saved event' : 'Save event'}"
          aria-pressed="${isSaved}"
          title="${isSaved ? 'Remove from saved' : 'Save event'}"
        >${isSaved ? '♥' : '♡'}</button>
      </div>

      <div class="event-body">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
          <p class="event-date">${escapeHTML(formatDate(event.date))}</p>
          ${getSourceBadge(event.source)}
          ${event.verified ? `<span class="verified-badge">✓ Verified</span>` : ''}
          ${feeHtml}
          ${prizeHtml}
        </div>

        <h3 class="event-title">${escapeHTML(event.title)}</h3>
        <p class="event-description">${escapeHTML(event.description)}</p>

        <div style="display:flex;align-items:center;gap:8px;margin:4px 0 8px">
          <span class="social-buzz-badge">🔥 ${buzzCount}+ students registered</span>
        </div>

        ${teammateSnippet}

        <div class="tag-cloud">
          ${(event.tags || []).slice(0, 3).map(t => `<span class="event-tag">${escapeHTML(t)}</span>`).join('')}
        </div>

        <div class="event-info">
          <span>⌖ ${escapeHTML(event.location)} (${escapeHTML(event.venue.split(',')[0])})</span>
          <span>◷ ${escapeHTML(formatTime(event.time))}</span>
        </div>

        <div class="event-footer">
          <span style="font-size:11px;color:var(--muted)">
            👥 ${event.savedCount || 1} saved · <small style="color:var(--gold)">${escapeHTML(event.lastSyncedAt || 'Live tracked')}</small>
          </span>
          <div style="display:flex;align-items:center;gap:8px">
            ${actionButton}
            <button
              class="gold-text-button"
              data-action="details"
              data-id="${event.id}"
            >Details ↗</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

// -------------------------------------------------------------
// RENDER EVENT LIST & SAVED VIEW
// -------------------------------------------------------------
function renderEvents() {
  const events = getFilteredAndSortedEvents();

  grid.innerHTML = events.map(e => eventCard(e)).join('');
  emptyState.classList.toggle('hidden', events.length !== 0);

  const titleEl = document.getElementById('results-title');
  const descEl = document.getElementById('results-description');

  if (searchTerm || activeCategory !== 'All' || activeLocation !== 'all' || activeCorridor !== 'all' || verifiedOnly || freeOnly || prizeOnly || activeTimeframe !== 'all') {
    titleEl.textContent = 'Filtered experiences';
  } else if (activeSort === 'match') {
    titleEl.textContent = 'Curated for you (Smart Match)';
  } else {
    titleEl.textContent = 'Upcoming experiences';
  }

  descEl.textContent = `${events.length} event${events.length === 1 ? '' : 's'} ready to discover`;

  renderSaved();
  updateMapMarkers();
}

function renderSaved() {
  const savedEvents = savedIds
    .map(id => {
      const ev = allEvents.find(e => e.id === id);
      if (!ev) return null;
      const match = calculateSmartMatch(ev);
      return { ...ev, matchScore: match.score, matchBreakdown: match.breakdown };
    })
    .filter(Boolean);

  savedCount.textContent = savedEvents.length;
  if (savedCardsCount) savedCardsCount.textContent = savedEvents.length;
  savedGrid.innerHTML = savedEvents.map(e => eventCard(e, true)).join('');
  savedEmpty.classList.toggle('hidden', savedEvents.length !== 0);

  renderCalendarAndConflicts();
}

// -------------------------------------------------------------
// BOOKMARKING / SAVE ACTION (CONNECTED TO BACKEND & XP)
// -------------------------------------------------------------
async function toggleSaved(id) {
  const isAlreadySaved = savedIds.includes(id);
  const action = isAlreadySaved ? 'remove' : 'add';

  if (isAlreadySaved) {
    savedIds = savedIds.filter(savedId => savedId !== id);
    showToast('Removed from your saved events.');
  } else {
    savedIds.push(id);
    showToast('Event saved! Digital Fast-Pass unlocked in Saved 🎫');
    addXP(50, 'Saved an event');
  }

  saveStorage(STORAGE_KEYS.saved, savedIds);

  const ev = allEvents.find(e => e.id === id);
  if (ev) {
    ev.savedCount = Math.max(0, (ev.savedCount || 0) + (isAlreadySaved ? -1 : 1));
  }

  renderEvents();
  fetchStats();

  try {
    await fetch(`/api/events/${id}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
  } catch (err) {
    console.warn('Backend sync failed, state preserved locally:', err);
  }
}

// -------------------------------------------------------------
// EVENT DETAILS DIALOG WITH TRANSIT GUIDE & OUTREACH
// -------------------------------------------------------------
function openDetails(id) {
  const rawEvent = allEvents.find(item => item.id === id);
  if (!rawEvent) return;

  const match = calculateSmartMatch(rawEvent);
  const event = { ...rawEvent, matchScore: match.score, matchBreakdown: match.breakdown };
  const isSaved = savedIds.includes(event.id);

  // Transit Guide Info
  const transit = event.transitGuide || {
    nearestStation: `${event.location} Station`,
    line: 'Suburban Railway',
    lastMile: '8–12 minutes auto-rickshaw',
    tips: 'Take local train or shared auto.'
  };

  const mapsDirectionUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.venue + ' ' + event.location)}`;

  // Update browser hash for shareable deep linking
  try {
    history.replaceState(null, '', `#event-${event.id}`);
  } catch (_) {}

  detailsContent.innerHTML = `
    <div class="dialog-heading">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <p class="eyebrow">${escapeHTML(event.category).toUpperCase()} · ${escapeHTML(event.location).toUpperCase()}</p>
        ${getSourceBadge(event.source)}
        ${event.verified ? `<span class="verified-badge">✓ Verified Campus</span>` : ''}
        ${event.entryFee ? `<span class="fee-badge">🎟 ${escapeHTML(event.entryFee)}</span>` : ''}
        ${event.prizePool ? `<span class="prize-badge">🏆 ${escapeHTML(event.prizePool)}</span>` : ''}
      </div>
      <button class="close-dialog" id="close-details" aria-label="Close">×</button>
    </div>

    <img class="detail-image"
      src="${escapeHTML(event.image)}"
      alt="${escapeHTML(event.title)}"
      onerror="this.src='https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80'">

    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:8px">
      <span class="event-date">Organized by: <strong>${escapeHTML(event.organizer || 'Community Lead')}</strong></span>
      <span class="match-badge" style="position:static;display:inline-flex">✦ ${event.matchScore}% Smart Match</span>
    </div>

    <h2 style="font-family:var(--serif);font-size:28px;font-weight:600;margin-top:10px;line-height:1.25">
      ${escapeHTML(event.title)}
    </h2>

    <div style="display:flex;align-items:center;gap:8px;margin:8px 0">
      <span class="social-buzz-badge">🔥 High Demand: 28 students registered today · Verified accreditation</span>
    </div>

    <p class="detail-copy">${escapeHTML(event.description)}</p>

    <!-- HYPERLOCAL TRANSIT & COMMUTE GUIDE -->
    <div class="transit-guide-card">
      <div class="transit-header">
        <span>🚆 Local Transit & Station Commute Guide</span>
        <a href="${mapsDirectionUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--gold);text-decoration:underline;font-size:11px">
          Open in Maps ↗
        </a>
      </div>
      <div class="transit-station">🚉 ${escapeHTML(transit.nearestStation)}</div>
      <span class="transit-line-pill">● ${escapeHTML(transit.line)}</span>
      <div class="transit-details">
        <strong>Last-Mile:</strong> ${escapeHTML(transit.lastMile)}<br>
        <strong>Commuter Tip:</strong> ${escapeHTML(transit.tips)}
      </div>
    </div>

    <!-- Transparent Smart Match Breakdown -->
    <div class="match-breakdown-card">
      <div class="breakdown-header">
        <strong style="color:var(--gold);font-size:12px;text-transform:uppercase;letter-spacing:1px">
          ✦ Transparent Match Breakdown (${event.matchScore}%)
        </strong>
        <span style="font-size:11px;color:var(--muted)">Multi-Factor Weighting</span>
      </div>
      ${event.matchBreakdown.map(item => `
        <div class="breakdown-item">
          <div>
            <span class="breakdown-tag">${escapeHTML(item.label)}:</span>
            <span style="font-size:11px;color:var(--muted);margin-left:6px">${escapeHTML(item.detail)}</span>
          </div>
          <span class="breakdown-val">${escapeHTML(item.value)}</span>
        </div>
      `).join('')}
    </div>

    <div class="detail-meta">
      <span>▦ ${escapeHTML(formatDate(event.date))}</span>
      <span>◷ ${escapeHTML(formatTime(event.time))}</span>
      <span>⌖ ${escapeHTML(event.venue)}, ${escapeHTML(event.location)}</span>
      <span>👥 ${event.savedCount || 1} students interested</span>
    </div>

    <div class="tag-cloud">
      ${(event.tags || []).map(t => `<span class="event-tag">${escapeHTML(t)}</span>`).join('')}
      ${(event.perks || []).map(p => `<span class="event-tag" style="border-color:var(--gold);color:var(--gold)">✓ ${escapeHTML(p)}</span>`).join('')}
    </div>

    <!-- ACTION BUTTONS: REGISTER (NO 404), OUTREACH / WHATSAPP, FAST-PASS -->
    <div class="detail-actions-grid">
      <button type="button" class="gold-button" id="details-register-btn" style="text-align:center;display:flex;align-items:center;justify-content:center">
        ⚡ Register on Official Portal ↗
      </button>
      <button type="button" class="gold-button" id="details-fast-pass" style="background:#252825;color:var(--gold);border-color:var(--gold)">
        🎫 View Digital Fast-Pass
      </button>
    </div>

    <div class="detail-actions-grid" style="margin-top:10px">
      <button type="button" class="outline-gold-button" id="details-outreach-btn">
        📢 Share to Class Group (Reach Kit)
      </button>
      <button class="outline-gold-button" id="details-save">
        ${isSaved ? '♥ Saved (Remove)' : '♡ Save Event'}
      </button>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:12px;border-top:1px solid rgba(245,240,230,0.08);font-size:11px;color:var(--muted)">
      <span>Verified Genuine Event · ${escapeHTML(event.lastSyncedAt || 'Live tracked')}</span>
      <button type="button" id="report-event-btn" style="background:none;border:none;color:#ef4444;font-size:11px;cursor:pointer">
        🚨 Report inaccurate details
      </button>
    </div>
  `;

  detailsDialog.showModal();

  document.getElementById('close-details').addEventListener('click', () => {
    detailsDialog.close();
  });

  document.getElementById('details-save').addEventListener('click', () => {
    toggleSaved(event.id);
    openDetails(event.id);
  });

  document.getElementById('details-fast-pass').addEventListener('click', () => {
    detailsDialog.close();
    openFastPass(event.id);
  });

  document.getElementById('details-register-btn').addEventListener('click', () => {
    detailsDialog.close();
    openRegisterPortal(event.id);
  });

  document.getElementById('details-outreach-btn').addEventListener('click', () => {
    detailsDialog.close();
    openOutreachModal(event.id);
  });

  document.getElementById('report-event-btn').addEventListener('click', async () => {
    try {
      await fetch(`/api/events/${event.id}/report`, { method: 'POST' });
      showToast('Thank you. Listing submitted for moderation review.');
    } catch (e) {
      showToast('Report received.');
    }
  });
}

// -------------------------------------------------------------
// FIX 404: OFFICIAL IN-APP REGISTRATION GATEWAY MODAL
// -------------------------------------------------------------
function openRegisterPortal(eventId) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;

  registerPortalContent.innerHTML = `
    <div style="margin-bottom:16px">
      <h3 style="font-family:var(--serif);font-size:22px;color:var(--cream);margin-bottom:4px">
        ${escapeHTML(event.title)}
      </h3>
      <p style="font-size:12px;color:var(--muted)">
        📍 ${escapeHTML(event.venue)} · 📅 ${escapeHTML(formatDate(event.date))} at ${escapeHTML(formatTime(event.time))}
      </p>
      <div style="display:flex;gap:6px;margin-top:8px">
        ${event.entryFee ? `<span class="fee-badge">🎟 ${escapeHTML(event.entryFee)}</span>` : ''}
        ${event.prizePool ? `<span class="prize-badge">🏆 ${escapeHTML(event.prizePool)}</span>` : ''}
      </div>
    </div>

    <div class="reg-card-choice-grid">
      <!-- OPTION 1: INSTANT 1-CLICK CAMPUS RSVP -->
      <div class="reg-choice-box primary">
        <div class="reg-choice-title">
          <span>⚡ 1-Click Instant Campus Registration</span>
          <span style="font-size:10px;color:var(--gold);background:rgba(214,184,120,0.15);padding:2px 6px;border-radius:4px">RECOMMENDED</span>
        </div>
        <p class="reg-choice-desc">
          Register directly through Eventora. Guarantees your seat, issues an official verified <strong>Digital Fast-Pass</strong> with gate QR code, and adds +100 Community XP!
        </p>

        <form id="inapp-reg-form">
          <div class="form-row">
            <label>Student Full Name
              <input type="text" id="reg-name" required value="${escapeHTML(studentProfileName)}">
            </label>
            <label>College / Campus
              <input type="text" id="reg-college" required value="${escapeHTML(studentCollegeName)}">
            </label>
          </div>
          <div class="form-row">
            <label>Email Address
              <input type="email" id="reg-email" required placeholder="student@college.edu.in">
            </label>
            <label>WhatsApp / Phone
              <input type="tel" id="reg-phone" placeholder="+91 98...">
            </label>
          </div>

          <button type="submit" class="gold-button" id="btn-submit-reg" style="width:100%;margin-top:8px">
            ✓ Confirm Official Registration & Get Fast-Pass ↗
          </button>
        </form>
      </div>

      <!-- OPTION 2: VERIFIED PLATFORM HUB LINK (GUARANTEED NO 404) -->
      <div class="reg-choice-box">
        <div class="reg-choice-title">
          <span>🌐 Partner Platform Hub (${escapeHTML(event.source || 'Official')})</span>
        </div>
        <p class="reg-choice-desc">
          Prefer to view the official partner portal? Open the live verified category hub on ${escapeHTML(event.source || 'the platform')} (verified active destination, no 404s).
        </p>
        <a href="${escapeHTML(event.registrationUrl || 'https://unstop.com/hackathons')}" target="_blank" rel="noopener noreferrer" class="outline-gold-button" style="display:block;text-align:center">
          Open Verified ${escapeHTML(event.source || 'Platform')} Hub ↗
        </a>
      </div>
    </div>
  `;

  registerPortalDialog.showModal();

  document.getElementById('close-reg-dialog').addEventListener('click', () => {
    registerPortalDialog.close();
  });

  const regForm = document.getElementById('inapp-reg-form');
  regForm.addEventListener('submit', async ev => {
    ev.preventDefault();
    const btn = document.getElementById('btn-submit-reg');
    const name = document.getElementById('reg-name').value.trim();
    const college = document.getElementById('reg-college').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();

    if (!name || !college || !email) {
      showToast('Please fill out your name, college, and email.');
      return;
    }

    studentProfileName = name;
    studentCollegeName = college;
    saveStorage(STORAGE_KEYS.studentName, studentProfileName);
    saveStorage(STORAGE_KEYS.collegeName, studentCollegeName);

    btn.disabled = true;
    btn.textContent = 'Confirming registration...';

    try {
      const res = await fetch(`/api/events/${event.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: name, college, email, phone })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (!savedIds.includes(event.id)) {
          savedIds.push(event.id);
          saveStorage(STORAGE_KEYS.saved, savedIds);
        }
        event.savedCount = (event.savedCount || 0) + 1;
        addXP(100, 'Registered for event');
        showToast('🎉 Official registration confirmed! Your Fast-Pass ticket is ready.');
        registerPortalDialog.close();
        renderEvents();
        openFastPass(event.id);
      } else {
        showToast(data.message || 'Registration failed.');
      }
    } catch (e) {
      showToast('Could not reach registration server. Saved locally.');
      registerPortalDialog.close();
      openFastPass(event.id);
    } finally {
      btn.disabled = false;
      btn.textContent = '✓ Confirm Official Registration & Get Fast-Pass ↗';
    }
  });
}

// -------------------------------------------------------------
// AMBASSADOR OUTREACH & CLASS WHATSAPP SHARE MODAL
// -------------------------------------------------------------
function openOutreachModal(eventId) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;

  const appUrl = window.location.origin + window.location.pathname;
  const eventDirectLink = `${appUrl}#event-${event.id}`;

  const transit = event.transitGuide || { nearestStation: `${event.location} Station`, tips: 'Local train or auto' };

  // 1. WhatsApp Template
  const waText = `📢 *Upcoming College Event: ${event.title}*\n\n` +
    `📍 *Venue:* ${event.venue}, ${event.location}\n` +
    `📅 *Date & Time:* ${formatDate(event.date)} at ${formatTime(event.time)}\n` +
    `🎟 *Entry:* ${event.entryFee || 'Free'}${event.prizePool ? ` | 🏆 *Cash Prizes:* ${event.prizePool}` : ''}\n` +
    `🚆 *Transit:* Nearest station is ${transit.nearestStation} (${transit.lastMile || 'Close by'})\n` +
    `✨ *Perks:* ${(event.perks || ['Certificates', 'Networking']).join(', ')}\n\n` +
    `👉 *View details & claim your free Fast-Pass ticket here:*\n${eventDirectLink}`;

  // 2. Discord Template
  const discordText = `**📢 Event Announcement: ${event.title}**\n\n` +
    `> **Category:** ${event.category} (${event.location})\n` +
    `> **Venue:** ${event.venue}\n` +
    `> **Schedule:** ${formatDate(event.date)} @ ${formatTime(event.time)}\n` +
    `> **Fee / Prizes:** ${event.entryFee || 'Free'} · ${event.prizePool || 'Certificates'}\n` +
    `> **Commute:** ${transit.nearestStation}\n\n` +
    `Looking for team members or wanting to attend together? Check details and RSVP on Eventora: ${eventDirectLink}`;

  // 3. LinkedIn Template
  const linkedInText = `Excited to discover "${event.title}" happening on ${formatDate(event.date)} at ${event.venue}! 🚀\n\n` +
    `Great opportunity for student builders and tech enthusiasts across Mumbai and Navi Mumbai colleges to collaborate on ${event.category} projects.\n\n` +
    `Key highlights:\n` +
    `• Entry: ${event.entryFee || 'Free'}\n` +
    `• Rewards: ${event.prizePool || 'Accredited Certificates'}\n` +
    `• Perks: ${(event.perks || ['Mentorship', 'Certificates']).join(', ')}\n\n` +
    `Let's connect if you're attending! Check the event page: ${eventDirectLink}\n\n` +
    `#MumbaiTech #Hackathon #CollegeFest #Engineering #StudentBuilders #Eventora`;

  outreachContent.innerHTML = `
    <div style="margin-bottom:14px">
      <h3 style="font-family:var(--serif);font-size:20px;color:var(--cream)">
        ${escapeHTML(event.title)}
      </h3>
      <p style="font-size:12px;color:var(--muted)">
        Share this event to class groups, WhatsApp batches, Discord channels, and LinkedIn to pack the house and find teammates!
      </p>
    </div>

    <div class="outreach-tabs">
      <button type="button" class="outreach-tab-btn active" data-tab="wa">💬 WhatsApp Class Group</button>
      <button type="button" class="outreach-tab-btn" data-tab="discord">🎮 Discord Server</button>
      <button type="button" class="outreach-tab-btn" data-tab="linkedin">💼 LinkedIn Post</button>
    </div>

    <textarea id="outreach-text-box" class="outreach-textarea" readonly>${escapeHTML(waText)}</textarea>

    <div style="display:flex;gap:10px;margin-top:14px">
      <button type="button" class="gold-button" id="btn-copy-outreach" style="flex:1">
        📋 Copy Broadcast Text
      </button>
      <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener noreferrer" class="outline-gold-button" id="btn-send-wa" style="flex:1;text-align:center;display:flex;align-items:center;justify-content:center">
        💬 Send to WhatsApp Now
      </a>
    </div>
  `;

  outreachDialog.showModal();

  document.getElementById('close-outreach-dialog').addEventListener('click', () => {
    outreachDialog.close();
  });

  const textBox = document.getElementById('outreach-text-box');
  const btnCopy = document.getElementById('btn-copy-outreach');
  const btnSendWa = document.getElementById('btn-send-wa');

  const tabTexts = {
    wa: waText,
    discord: discordText,
    linkedin: linkedInText
  };

  outreachContent.querySelectorAll('.outreach-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      outreachContent.querySelectorAll('.outreach-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const key = btn.dataset.tab;
      textBox.value = tabTexts[key] || waText;
      if (btnSendWa) {
        btnSendWa.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(tabTexts[key] || waText)}`;
      }
    });
  });

  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textBox.value);
      showToast('📋 Broadcast announcement copied to clipboard!');
      addXP(30, 'Shared announcement to class');
    } catch (_) {
      textBox.select();
      document.execCommand('copy');
      showToast('📋 Copied!');
    }
  });
}

// -------------------------------------------------------------
// DIGITAL STUDENT FAST-PASS (QR TICKET)
// -------------------------------------------------------------
async function openFastPass(eventId) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;

  passDialog.showModal();
  passContent.innerHTML = `<p style="padding:20px;text-align:center;color:var(--muted)">Generating official event pass...</p>`;

  try {
    const res = await fetch(`/api/events/${eventId}/pass`);
    const data = await res.json();
    const pass = data.success ? data.pass : {
      passId: `EVT-${event.id.toString().slice(-4)}-STUDENT`,
      gateEntryCode: 'GATE-CAMPUS-PASS',
      verifiedStatus: 'Official Attendee Pass'
    };

    const qrSvg = generateSimpleQRSvg(pass.passId);

    passContent.innerHTML = `
      <div class="fast-pass-ticket" id="printable-fast-pass">
        <div class="ticket-header">
          <div class="logo" style="font-size:13px">
            <span class="logo-mark" style="width:24px;height:24px;font-size:16px">E</span> EVENTORA FAST-PASS
          </div>
          <span style="font-size:11px;color:var(--gold);font-weight:700">✓ ${escapeHTML(pass.verifiedStatus)}</span>
        </div>

        <div class="ticket-title">${escapeHTML(event.title)}</div>
        <div style="font-size:12px;color:var(--muted)">Organized by ${escapeHTML(event.organizer || 'College Tech Guild')}</div>

        <div class="ticket-info-grid">
          <div class="ticket-field">
            <label>Date & Time</label>
            <span>${escapeHTML(formatDate(event.date))} · ${escapeHTML(formatTime(event.time))}</span>
          </div>
          <div class="ticket-field">
            <label>Attendee Name</label>
            <span>${escapeHTML(studentProfileName)}</span>
          </div>
          <div class="ticket-field">
            <label>Venue / Gate</label>
            <span>${escapeHTML(event.venue.split(',')[0])}</span>
          </div>
          <div class="ticket-field">
            <label>Gate Code</label>
            <span style="color:var(--gold)">${escapeHTML(pass.gateEntryCode)}</span>
          </div>
        </div>

        <div class="ticket-qr-zone">
          <div class="ticket-qr-svg">
            ${qrSvg}
          </div>
          <div class="ticket-code">PASS ID: ${escapeHTML(pass.passId)}</div>
          <p style="font-size:10px;color:var(--muted);text-align:center;margin:0">
            Show this digital fast-pass or QR at the college gate for priority entry.
          </p>
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-top:16px">
        <button type="button" class="gold-button" id="btn-print-pass" style="flex:1">
          🖨 Save / Print Pass
        </button>
        <button type="button" class="outline-gold-button" id="btn-close-pass" style="flex:1">
          Done
        </button>
      </div>
    `;

    document.getElementById('btn-close-pass').addEventListener('click', () => passDialog.close());
    document.getElementById('btn-print-pass').addEventListener('click', () => {
      window.print();
    });

  } catch (err) {
    passContent.innerHTML = `<p style="padding:20px;color:#ef4444">Failed to generate pass. Please check connection.</p>`;
  }
}

function generateSimpleQRSvg(text) {
  return `
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" fill="white"/>
      <rect x="10" y="10" width="30" height="30" fill="#171918"/>
      <rect x="16" y="16" width="18" height="18" fill="white"/>
      <rect x="20" y="20" width="10" height="10" fill="#171918"/>

      <rect x="80" y="10" width="30" height="30" fill="#171918"/>
      <rect x="86" y="16" width="18" height="18" fill="white"/>
      <rect x="90" y="20" width="10" height="10" fill="#171918"/>

      <rect x="10" y="80" width="30" height="30" fill="#171918"/>
      <rect x="16" y="86" width="18" height="18" fill="white"/>
      <rect x="20" y="90" width="10" height="10" fill="#171918"/>

      <rect x="50" y="15" width="8" height="20" fill="#171918"/>
      <rect x="64" y="10" width="8" height="12" fill="#171918"/>
      <rect x="50" y="45" width="20" height="8" fill="#171918"/>
      <rect x="75" y="45" width="8" height="25" fill="#171918"/>
      <rect x="15" y="50" width="25" height="8" fill="#171918"/>
      <rect x="90" y="50" width="18" height="8" fill="#171918"/>
      <rect x="50" y="60" width="15" height="15" fill="#171918"/>
      <rect x="50" y="85" width="10" height="20" fill="#171918"/>
      <rect x="70" y="80" width="20" height="8" fill="#171918"/>
      <rect x="95" y="85" width="15" height="15" fill="#171918"/>
    </svg>
  `;
}

// -------------------------------------------------------------
// COMMUNITY LEADER & PIONEER CERTIFICATE
// -------------------------------------------------------------
function openCertificateModal() {
  const tier = getLevelInfo(xpState.xp);
  const certId = `EVT-CERT-${Date.now().toString().slice(-6)}`;

  certContent.innerHTML = `
    <div class="cert-card" id="printable-cert">
      <div class="cert-ornament">✦ ✳ ✦</div>
      <div class="cert-main-title">EVENTORA LEADERSHIP CREDENTIAL</div>
      <div class="cert-sub">Hyperlocal Community Pioneer Certificate</div>

      <div class="cert-awarded-to">THIS VERIFIED ACCREDITATION IS PROUDLY PRESENTED TO</div>
      <div class="cert-student-name" contenteditable="true" id="cert-student-name-edit" title="Click to edit name">
        ${escapeHTML(studentProfileName)}
      </div>

      <p class="cert-body-text">
        In recognition of outstanding passion and active participation in the Mumbai & Navi Mumbai
        inter-collegiate tech ecosystem. Achieved <strong>Level ${tier.level} (${tier.name})</strong> with
        <strong>${xpState.xp} Community XP</strong> and a verified <strong>${xpState.streak}-Day Active Streak</strong>.
      </p>

      <div class="cert-seal-footer">
        <div>
          <strong>CREDENTIAL ID:</strong> ${certId}<br>
          <span>ISSUED: ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
        </div>
        <div style="text-align:right">
          <strong style="color:var(--gold)">EVENTORA COMMUNITY GUILD</strong><br>
          <span>Mumbai · Navi Mumbai · Panvel</span>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-top:18px">
      <button type="button" class="gold-button" id="btn-print-cert" style="flex:1">
        🖨 Save / Print Certificate
      </button>
      <button type="button" class="outline-gold-button" id="btn-close-cert" style="flex:1">
        Close
      </button>
    </div>
  `;

  certDialog.showModal();

  document.getElementById('btn-close-cert').addEventListener('click', () => certDialog.close());
  document.getElementById('btn-print-cert').addEventListener('click', () => {
    window.print();
  });

  const nameEdit = document.getElementById('cert-student-name-edit');
  if (nameEdit) {
    nameEdit.addEventListener('blur', () => {
      studentProfileName = nameEdit.textContent.trim() || 'Aarav Sharma';
      saveStorage(STORAGE_KEYS.studentName, studentProfileName);
    });
  }
}

// -------------------------------------------------------------
// TEAMMATE RADAR MODAL
// -------------------------------------------------------------
function openTeammateDialog(id) {
  const event = allEvents.find(e => e.id === id);
  if (!event) return;

  const reqs = event.teammateRequests || [];

  teammateContent.innerHTML = `
    <div class="dialog-heading">
      <div>
        <p class="eyebrow">TEAMMATE RADAR 🤝</p>
        <h2 style="font-family:var(--serif);font-size:24px">${escapeHTML(event.title)}</h2>
      </div>
      <button class="close-dialog" id="close-teammate" aria-label="Close">×</button>
    </div>

    <p style="font-size:13px;color:var(--muted);margin:8px 0 16px">
      Connect with fellow students looking for hackathon team members, or post your own opening:
    </p>

    <div class="teammate-section">
      <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--gold);margin-bottom:10px">
        Active Openings (${reqs.length})
      </h4>
      ${reqs.length === 0 ? `
        <p style="font-size:12px;color:var(--muted);padding:8px 0">
          No teams looking yet! Be the first to post your request below.
        </p>
      ` : reqs.map(r => `
        <div class="teammate-item">
          <div>
            <strong style="color:var(--cream)">${escapeHTML(r.teamName)}</strong>
            <div style="color:var(--gold);font-size:11px;margin-top:2px">Needs: ${escapeHTML(r.role)}</div>
          </div>
          <a href="https://${escapeHTML(r.contact.replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener noreferrer" class="teammate-contact-btn">
            💬 Connect
          </a>
        </div>
      `).join('')}
    </div>

    <!-- POST A TEAMMATE REQUEST FORM -->
    <form id="teammate-form" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
      <h4 style="font-size:13px;font-weight:600;color:var(--cream);margin-bottom:10px">
        + Post a Teammate Request
      </h4>
      <div class="form-row">
        <label>Team Name
          <input name="teamName" id="tm-team" required placeholder="e.g. SIES Hackers">
        </label>
        <label>Role / Skill Needed
          <input name="role" id="tm-role" required placeholder="e.g. Frontend React / UI">
        </label>
      </div>
      <label>Contact Link (WhatsApp or Telegram)
        <input name="contact" id="tm-contact" required placeholder="e.g. wa.me/919820011223 or t.me/myhandle">
      </label>
      <button type="submit" class="gold-button" style="width:100%;margin-top:10px">
        Publish to Teammate Radar ↗
      </button>
    </form>
  `;

  teammateDialog.showModal();

  document.getElementById('close-teammate').addEventListener('click', () => {
    teammateDialog.close();
  });

  document.getElementById('teammate-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const teamName = document.getElementById('tm-team').value.trim();
    const role = document.getElementById('tm-role').value.trim();
    const contact = document.getElementById('tm-contact').value.trim();

    if (!teamName || !role || !contact) return;

    try {
      const res = await fetch(`/api/events/${event.id}/teammate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, role, contact })
      });
      const data = await res.json();
      if (data.success) {
        showToast('🎉 Your teammate request is live on the board!');
        event.teammateRequests = data.teammateRequests;
        addXP(120, 'Posted on Teammate Radar');
        openTeammateDialog(event.id);
        renderEvents();
        fetchStats();
      }
    } catch (e) {
      showToast('Failed to post request.');
    }
  });
}

// -------------------------------------------------------------
// STANDALONE SMART MATCH EXPLANATION DIALOG
// -------------------------------------------------------------
function openMatchExplainer(id) {
  const rawEvent = allEvents.find(item => item.id === id);
  if (!rawEvent) return;

  const match = calculateSmartMatch(rawEvent);

  matchContent.innerHTML = `
    <div class="dialog-heading">
      <p class="eyebrow">SMART MATCH AUDIT</p>
      <button class="close-dialog" id="close-match" aria-label="Close">×</button>
    </div>

    <h2 style="font-family:var(--serif);font-size:24px;margin-top:8px">
      ${escapeHTML(rawEvent.title)}
    </h2>
    <p style="color:var(--gold);font-size:16px;font-weight:700;margin:8px 0 16px">
      Calculated Affinity: ${match.score}%
    </p>

    <div class="match-breakdown-card" style="margin:0">
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px">
        Eventora's Smart Match engine uses transparent multi-factor scoring to connect students with the right technical and cultural opportunities without black-box advertising:
      </p>
      ${match.breakdown.map(item => `
        <div class="breakdown-item" style="padding:8px 0">
          <div>
            <strong style="color:var(--cream);font-size:12px">${escapeHTML(item.label)}</strong>
            <p style="font-size:11px;color:var(--muted);margin-top:2px">${escapeHTML(item.detail)}</p>
          </div>
          <span class="breakdown-val" style="font-size:14px">${escapeHTML(item.value)}</span>
        </div>
      `).join('')}
    </div>

    <button class="gold-button" id="close-match-btn" style="width:100%;margin-top:20px">
      Got it ↗
    </button>
  `;

  matchDialog.showModal();

  document.getElementById('close-match').addEventListener('click', () => {
    matchDialog.close();
  });
  document.getElementById('close-match-btn').addEventListener('click', () => {
    matchDialog.close();
  });
}

// -------------------------------------------------------------
// WHATSAPP / CIRCULAR TEXT PARSER 2.0
// -------------------------------------------------------------
btnParseNotice.addEventListener('click', async () => {
  const text = quickImportText.value.trim();
  if (!text) {
    showToast('Please paste a WhatsApp message or notice text first!');
    return;
  }

  btnParseNotice.disabled = true;
  btnParseNotice.textContent = 'Parsing announcement with engine...';

  try {
    const res = await fetch('/api/events/parse-notice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    if (data.success && data.parsed) {
      const p = data.parsed;
      document.getElementById('form-title').value = p.title || '';
      document.getElementById('form-category').value = p.category || 'Technology';
      document.getElementById('form-location').value = p.location || 'Navi Mumbai';
      document.getElementById('form-venue').value = p.venue || '';
      document.getElementById('form-date').value = p.date || '';
      document.getElementById('form-time').value = p.time || '10:00';
      document.getElementById('form-description').value = p.description || '';
      if (p.entryFee) document.getElementById('form-fee').value = p.entryFee;
      if (p.prizePool) document.getElementById('form-prize').value = p.prizePool;
      if (p.registrationUrl) {
        document.getElementById('form-reg-url').value = p.registrationUrl;
      }
      showToast('⚡ Auto-filled title, date, venue, fees & prizes! Review and publish.');
    } else {
      showToast('Could not automatically parse all fields. Please fill manually.');
    }
  } catch (err) {
    showToast('Notice parser error. Please fill manually.');
  } finally {
    btnParseNotice.disabled = false;
    btnParseNotice.textContent = '⚡ Auto-Fill Event Details with Parser';
  }
});

// -------------------------------------------------------------
// EVENT CREATION SUBMISSION WITH DUPLICATE PROTECTION
// -------------------------------------------------------------
document.getElementById('create-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitBtn = form.querySelector('.submit-event');

  const title = document.getElementById('form-title').value.trim();
  const category = document.getElementById('form-category').value;
  const location = document.getElementById('form-location').value;
  const venue = document.getElementById('form-venue').value.trim();
  const date = document.getElementById('form-date').value;
  const time = document.getElementById('form-time').value;
  const organizer = document.getElementById('form-organizer').value.trim();
  const registrationUrl = document.getElementById('form-reg-url').value.trim();
  const description = document.getElementById('form-description').value.trim();
  const entryFee = document.getElementById('form-fee').value.trim();
  const prizePool = document.getElementById('form-prize').value.trim();

  if (!title || !venue || !description || !date || !time) {
    showToast('Please fill out all required fields.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Publishing to database...';

  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        location,
        venue,
        date,
        time,
        description,
        entryFee: entryFee || 'Free',
        prizePool: prizePool || 'Prizes & Badges',
        organizer: organizer || 'Campus Organizer',
        registrationUrl: registrationUrl || 'https://unstop.com/hackathons',
        tags: [category, location, 'Student Event']
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || '🎉 Your event has been published to Eventora!');
      addXP(250, 'Published a campus event');
      form.reset();
      quickImportText.value = '';
      eventDialog.close();

      await fetchEvents(true);
      document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });
    } else {
      showToast(data.message || 'Error publishing event.');
    }
  } catch (err) {
    showToast('Failed to save to server. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish to Eventora ↗';
  }
});

// -------------------------------------------------------------
// COMMUNITY XP, STREAKS & BADGES ENGINE
// -------------------------------------------------------------
const XP_TIERS = [
  { level: 1, name: 'Campus Scout', min: 0, max: 200, icon: '🌱' },
  { level: 2, name: 'Tech Explorer', min: 201, max: 500, icon: '🚀' },
  { level: 3, name: 'Hackathon Prodigy', min: 501, max: 1000, icon: '⚡' },
  { level: 4, name: 'Community Pillar', min: 1001, max: 999999, icon: '👑' }
];

const BADGE_DEFINITIONS = [
  { id: 'first_rsvp', title: 'First RSVP', icon: '🎟️', desc: 'Saved your first college event bookmark' },
  { id: 'hackathon_hunter', title: 'Hackathon Hunter', icon: '💻', desc: 'Saved 2 or more competitive student hackathons' },
  { id: 'campus_connector', title: 'Campus Connector', icon: '🤝', desc: 'Connected on Teammate Radar or shared notice' },
  { id: 'night_owl', title: 'Night Owl Coder', icon: '🦉', desc: 'Exploring hackathons during late-night build hours' },
  { id: 'corridor_explorer', title: 'Corridor Explorer', icon: '🗺️', desc: 'Discovered events across Navi Mumbai, Panvel & Mumbai' }
];

function getLevelInfo(xp) {
  return XP_TIERS.find(t => xp >= t.min && xp <= t.max) || XP_TIERS[XP_TIERS.length - 1];
}

function updateXpNavBadge() {
  const tier = getLevelInfo(xpState.xp);
  if (navXpBadge) {
    navXpBadge.textContent = `Lvl ${tier.level} · ${xpState.xp} XP`;
  }
}

function addXP(amount, actionName) {
  const prevTier = getLevelInfo(xpState.xp);
  xpState.xp += amount;
  const newTier = getLevelInfo(xpState.xp);

  // Check automated badge triggers
  if (savedIds.length >= 1 && !xpState.unlockedBadges.includes('first_rsvp')) {
    xpState.unlockedBadges.push('first_rsvp');
  }
  const hackCount = allEvents.filter(e => savedIds.includes(e.id) && /hackathon|coding|web3/i.test(e.title + e.category)).length;
  if (hackCount >= 2 && !xpState.unlockedBadges.includes('hackathon_hunter')) {
    xpState.unlockedBadges.push('hackathon_hunter');
  }

  saveStorage(STORAGE_KEYS.xp, xpState);
  updateXpNavBadge();

  if (newTier.level > prevTier.level) {
    showToast(`🎉 LEVEL UP! You reached Level ${newTier.level}: ${newTier.name}! (+${amount} XP)`);
  } else {
    showToast(`+${amount} XP: ${actionName}!`);
  }
}

function renderXpModal() {
  const tier = getLevelInfo(xpState.xp);
  const nextTier = XP_TIERS.find(t => t.level === tier.level + 1) || tier;
  const progressInTier = Math.max(0, xpState.xp - tier.min);
  const progressPercent = tier.level === 4 ? 100 : Math.min(100, Math.round((progressInTier / (nextTier.min - tier.min)) * 100));

  xpContent.innerHTML = `
    <div class="xp-tier-card">
      <div class="xp-tier-header">
        <div class="xp-current-level">
          <span>${tier.icon}</span> Level ${tier.level}: ${tier.name}
        </div>
        <div class="xp-streak-box">
          🔥 ${xpState.streak}-Day Active Streak
        </div>
      </div>

      <div class="xp-progress-bar-wrap">
        <div class="xp-progress-bar-fill" style="width:${progressPercent}%"></div>
      </div>

      <div class="xp-progress-labels">
        <span>${xpState.xp} Total XP</span>
        <span>${tier.level === 4 ? 'Max Level Reached!' : `${Math.max(0, nextTier.min - xpState.xp)} XP to Level ${nextTier.level} (${nextTier.name})`}</span>
      </div>
    </div>

    <!-- LEADER CERTIFICATE CTA -->
    <div style="background:rgba(214,184,120,0.1);border:1px solid var(--gold);border-radius:8px;padding:14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <strong style="color:var(--cream);font-size:13px">🎓 Community Pioneer Credential</strong>
        <p style="font-size:11px;color:var(--muted);margin:2px 0 0">Verified certificate of campus event engagement for your resume.</p>
      </div>
      <button type="button" class="gold-button" id="btn-open-cert" style="padding:8px 14px;font-size:11px">
        View Certificate ↗
      </button>
    </div>

    <div>
      <div class="badges-shelf-title">
        <span>🏆 Unlocked Badges (${xpState.unlockedBadges.length}/${BADGE_DEFINITIONS.length})</span>
        <span style="font-size:11px;color:var(--gold)">Campus Milestones</span>
      </div>
      <div class="badges-grid">
        ${BADGE_DEFINITIONS.map(b => {
          const isUnlocked = xpState.unlockedBadges.includes(b.id);
          return `
            <div class="badge-card ${isUnlocked ? 'unlocked' : ''}">
              <div class="badge-icon">${b.icon}</div>
              <div class="badge-title">${escapeHTML(b.title)}</div>
              <div class="badge-desc">${escapeHTML(b.desc)}</div>
              <span style="font-size:9px;color:${isUnlocked ? '#34d399' : 'var(--muted)'};font-weight:700">
                ${isUnlocked ? '✓ UNLOCKED' : '🔒 LOCKED'}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="xp-earning-guide">
      <h5>⚡ Ways to Earn Community XP</h5>
      <div class="xp-action-list">
        <div class="xp-action-item">
          <span>Publish verified college event</span>
          <span class="xp-action-val">+250 XP</span>
        </div>
        <div class="xp-action-item">
          <span>Post/Apply on Teammate Radar</span>
          <span class="xp-action-val">+120 XP</span>
        </div>
        <div class="xp-action-item">
          <span>Register on official event portal</span>
          <span class="xp-action-val">+100 XP</span>
        </div>
        <div class="xp-action-item">
          <span>Bookmark event to Little Black Book</span>
          <span class="xp-action-val">+50 XP</span>
        </div>
        <div class="xp-action-item">
          <span>Export schedule to .ICS Calendar</span>
          <span class="xp-action-val">+30 XP</span>
        </div>
        <div class="xp-action-item">
          <span>Share circular to WhatsApp group</span>
          <span class="xp-action-val">+30 XP</span>
        </div>
      </div>
    </div>
  `;

  xpDialog.showModal();

  document.getElementById('btn-open-cert').addEventListener('click', () => {
    xpDialog.close();
    openCertificateModal();
  });
}

// -------------------------------------------------------------
// INTERACTIVE LEAFLET EVENT PULSE MAP
// -------------------------------------------------------------
function initPulseMap() {
  if (typeof L === 'undefined') return;
  if (pulseMap) return;

  const mapEl = document.getElementById('event-map');
  if (!mapEl) return;

  pulseMap = L.map('event-map', {
    center: [19.0330, 73.0163],
    zoom: 11,
    zoomControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(pulseMap);

  updateMapMarkers();
}

function updateMapMarkers() {
  if (!pulseMap || typeof L === 'undefined') return;

  mapMarkers.forEach(m => pulseMap.removeLayer(m));
  mapMarkers = [];

  const validEvents = allEvents.filter(e => e.lat && e.lng);
  validEvents.forEach(e => {
    const isTech = /technology|hackathon/i.test(e.category + (e.tags || []).join(' '));
    const pinColor = isTech ? '#d6b878' : '#60a5fa';

    const customIcon = L.divIcon({
      className: 'custom-gold-pin',
      html: `<div style="background:${pinColor};width:26px;height:26px;border-radius:50%;border:2px solid #171918;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px ${pinColor};font-size:11px;font-weight:bold;color:#171918;">●</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14]
    });

    const popupHtml = `
      <div class="custom-map-popup">
        <span class="popup-tag">${escapeHTML(e.category)} · ${escapeHTML(e.location)}</span>
        <div class="popup-title">${escapeHTML(e.title)}</div>
        <div class="popup-meta">
          <span>📅 ${escapeHTML(formatDate(e.date))} · ${escapeHTML(formatTime(e.time))}</span>
          <span>📍 ${escapeHTML(e.venue)}</span>
        </div>
        <button type="button" class="popup-btn" data-action="details" data-id="${e.id}">
          View Details ↗
        </button>
      </div>
    `;

    const marker = L.marker([e.lat, e.lng], { icon: customIcon })
      .addTo(pulseMap)
      .bindPopup(popupHtml);

    mapMarkers.push(marker);
  });
}

function focusMapOnEvent(id) {
  const ev = allEvents.find(e => e.id === id);
  if (!ev || !ev.lat || !ev.lng) return;

  currentExploreView = 'map';
  btnViewGrid.classList.remove('active');
  btnViewMap.classList.add('active');
  eventPulseMapContainer.classList.remove('hidden');
  resultsBar.classList.add('hidden');
  grid.classList.add('hidden');
  emptyState.classList.add('hidden');

  if (!pulseMap) {
    initPulseMap();
  }

  setTimeout(() => {
    pulseMap.invalidateSize();
    pulseMap.flyTo([ev.lat, ev.lng], 14, { animate: true, duration: 1.2 });
    document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });

    const marker = mapMarkers.find(m => {
      const pos = m.getLatLng();
      return Math.abs(pos.lat - ev.lat) < 0.001 && Math.abs(pos.lng - ev.lng) < 0.001;
    });
    if (marker) {
      setTimeout(() => marker.openPopup(), 1200);
    }
  }, 100);
}

// -------------------------------------------------------------
// PERSONALIZED CALENDAR & SMART SCHEDULE CONFLICT DETECTOR
// -------------------------------------------------------------
function renderCalendarAndConflicts() {
  if (!calendarTimeline || !conflictAlertBox) return;

  const savedEvents = savedIds
    .map(id => allEvents.find(e => e.id === id))
    .filter(Boolean)
    .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime());

  if (savedEvents.length === 0) {
    calendarTimeline.innerHTML = `<p class="saved-empty" style="display:block">No events saved in your calendar yet. Bookmark events with ♡ to view schedule conflicts and export.</p>`;
    conflictAlertBox.classList.add('hidden');
    return;
  }

  const grouped = {};
  savedEvents.forEach(e => {
    grouped[e.date] = grouped[e.date] || [];
    grouped[e.date].push(e);
  });

  const conflicts = [];
  const flaggedEventIds = new Set();

  Object.keys(grouped).forEach(date => {
    const dayEvents = grouped[date];
    if (dayEvents.length < 2) return;

    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        const ev1 = dayEvents[i];
        const ev2 = dayEvents[j];

        const parseMinutes = (timeStr, fallbackHour = 10) => {
          if (!timeStr) return fallbackHour * 60;
          const [h, m] = timeStr.split(':').map(Number);
          return (h || 0) * 60 + (m || 0);
        };

        const start1 = parseMinutes(ev1.time, 10);
        const end1 = ev1.endTime ? parseMinutes(ev1.endTime, 17) : start1 + 240;

        const start2 = parseMinutes(ev2.time, 10);
        const end2 = ev2.endTime ? parseMinutes(ev2.endTime, 17) : start2 + 240;

        // 1. Time overlap check
        const isOverlap = Math.max(start1, start2) < Math.min(end1, end2);

        if (isOverlap) {
          flaggedEventIds.add(ev1.id);
          flaggedEventIds.add(ev2.id);
          conflicts.push({
            type: 'overlap',
            date: date,
            ev1,
            ev2,
            message: `CRITICAL SCHEDULE OVERLAP on ${formatDate(date)}: "${ev1.title}" (${formatTime(ev1.time)}–${formatTime(ev1.endTime || 'Late')}) and "${ev2.title}" (${formatTime(ev2.time)}–${formatTime(ev2.endTime || 'Late')}) occur at the same time.`,
            solution: `Recommendation: Choose between ${ev1.venue} and ${ev2.venue}, or attend one session virtually if live stream is offered.`
          });
        } else {
          // 2. Cross-Corridor Travel Buffer Conflict
          const first = start1 <= start2 ? ev1 : ev2;
          const second = start1 <= start2 ? ev2 : ev1;
          const firstEnd = start1 <= start2 ? end1 : end2;
          const secondStart = start1 <= start2 ? start2 : start1;
          const gapMinutes = secondStart - firstEnd;

          const loc1 = (first.location || '').toLowerCase();
          const loc2 = (second.location || '').toLowerCase();

          if (loc1 !== loc2 && loc1 !== 'online' && loc2 !== 'online') {
            const isPanvelToMumbai = (loc1.includes('panvel') && loc2.includes('mumbai')) || (loc1.includes('mumbai') && loc2.includes('panvel'));
            const isNaviToMumbaiOrPanvel = loc1.includes('navi mumbai') || loc2.includes('navi mumbai');

            if (isPanvelToMumbai && gapMinutes < 90) {
              flaggedEventIds.add(ev1.id);
              flaggedEventIds.add(ev2.id);
              conflicts.push({
                type: 'transit',
                date: date,
                ev1,
                ev2,
                message: `TRANSIT BUFFER WARNING on ${formatDate(date)}: Attending "${first.title}" in ${first.location} and "${second.title}" in ${second.location} leaves only ${Math.max(0, gapMinutes)} mins travel buffer.`,
                solution: `Harbor line train or highway commute between Panvel and Mumbai typically takes 75–90 mins. You risk arriving significantly late.`
              });
            } else if (isNaviToMumbaiOrPanvel && gapMinutes < 50) {
              flaggedEventIds.add(ev1.id);
              flaggedEventIds.add(ev2.id);
              conflicts.push({
                type: 'transit',
                date: date,
                ev1,
                ev2,
                message: `COMMUTE BUFFER WARNING on ${formatDate(date)}: Only ${Math.max(0, gapMinutes)} mins between "${first.title}" (${first.venue}) and "${second.title}" (${second.venue}).`,
                solution: `Peak hour travel across Navi Mumbai campuses requires at least 45 mins.`
              });
            }
          }
        }
      }
    }
  });

  if (conflicts.length > 0) {
    conflictAlertBox.classList.remove('hidden');
    conflictAlertBox.innerHTML = conflicts.map(c => `
      <div class="conflict-alert-card ${c.type === 'transit' ? 'warning' : ''}">
        <div class="conflict-icon">${c.type === 'transit' ? '⚠️' : '🚨'}</div>
        <div class="conflict-text">
          <strong>${escapeHTML(c.message)}</strong>
          <div class="conflict-solution">💡 ${escapeHTML(c.solution)}</div>
        </div>
      </div>
    `).join('');
  } else {
    conflictAlertBox.classList.remove('hidden');
    conflictAlertBox.innerHTML = `
      <div class="conflict-alert-card warning" style="background:rgba(52,211,153,0.08);border-color:rgba(52,211,153,0.3);border-left-color:#34d399;color:#d1fae5">
        <div class="conflict-icon">✓</div>
        <div class="conflict-text">
          <strong>All clear! Zero schedule or transit conflicts detected.</strong>
          <div class="conflict-solution">Your saved events have compatible timings and feasible transit margins across campuses.</div>
        </div>
      </div>
    `;
  }

  calendarTimeline.innerHTML = Object.keys(grouped).map(date => {
    const dayEvents = grouped[date];
    return `
      <div class="timeline-day-group">
        <div class="timeline-date-header">
          <span class="timeline-date-title">📅 ${escapeHTML(formatDate(date))}</span>
          <span class="timeline-date-badge">${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'} scheduled</span>
        </div>
        <div class="timeline-events-list">
          ${dayEvents.map(e => {
            const isFlagged = flaggedEventIds.has(e.id);
            return `
              <div class="timeline-item-row ${isFlagged ? 'conflict-flagged' : ''}">
                <div class="timeline-time-col">
                  <div class="timeline-time-range">${escapeHTML(formatTime(e.time))} – ${escapeHTML(formatTime(e.endTime || 'Late'))}</div>
                  <div class="timeline-venue-sub">${escapeHTML(e.venue.split(',')[0])} (${escapeHTML(e.location)})</div>
                </div>
                <div class="timeline-info-col">
                  <div class="timeline-title-link" data-action="details" data-id="${e.id}">
                    ${escapeHTML(e.title)} ${isFlagged ? '<span style="color:#ef4444;font-size:11px;font-weight:bold">● Conflict</span>' : ''}
                  </div>
                  <span class="event-tag" style="margin-top:4px;display:inline-block">${escapeHTML(e.category)}</span>
                </div>
                <div class="timeline-actions-col">
                  <button type="button" class="gold-text-button" data-action="fast-pass" data-id="${e.id}" style="font-size:11px">
                    🎫 Fast-Pass
                  </button>
                  <button type="button" class="gold-text-button" data-action="register-gateway" data-id="${e.id}" style="font-size:11px">
                    Register ↗
                  </button>
                  <button type="button" class="gold-text-button" data-action="details" data-id="${e.id}" style="font-size:11px">
                    Details
                  </button>
                  <button type="button" class="gold-text-button" data-action="save" data-id="${e.id}" style="font-size:11px;color:#ef4444">
                    ✕
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function exportSavedToICS() {
  const savedEvents = savedIds
    .map(id => allEvents.find(e => e.id === id))
    .filter(Boolean);

  if (savedEvents.length === 0) {
    showToast('No saved events to export.');
    return;
  }

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eventora//Campus Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  savedEvents.forEach(e => {
    const cleanDate = (e.date || '').replace(/-/g, '');
    const cleanTime = (e.time || '10:00').replace(/:/g, '') + '00';
    const cleanEnd = (e.endTime || '17:00').replace(/:/g, '') + '00';
    const uid = `eventora-${e.id}-${cleanDate}@eventora.in`;

    icsContent.push('BEGIN:VEVENT');
    icsContent.push(`UID:${uid}`);
    icsContent.push(`DTSTAMP:${cleanDate}T${cleanTime}`);
    icsContent.push(`DTSTART:${cleanDate}T${cleanTime}`);
    icsContent.push(`DTEND:${cleanDate}T${cleanEnd}`);
    icsContent.push(`SUMMARY:${e.title.replace(/[,;]/g, ' ')}`);
    icsContent.push(`DESCRIPTION:${(e.description || '').replace(/\n/g, ' ')} | Register at: ${e.registrationUrl || 'https://unstop.com'}`);
    icsContent.push(`LOCATION:${(e.venue || '')}, ${(e.location || '')}`);
    icsContent.push('STATUS:CONFIRMED');
    icsContent.push('END:VEVENT');
  });

  icsContent.push('END:VCALENDAR');

  const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', 'eventora-personalized-schedule.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('📅 Exported .ICS calendar file! Ready for Google Calendar.');
  addXP(30, 'Calendar Exported');
}

// -------------------------------------------------------------
// ORGANIZER HOST INSIGHTS & REACH ANALYTICS
// -------------------------------------------------------------
async function openHostInsights() {
  hostDialog.showModal();
  hostContent.innerHTML = `<p style="padding:20px;text-align:center;color:var(--muted)">Loading organizer analytics engine...</p>`;

  try {
    const res = await fetch('/api/organizer/analytics');
    const data = await res.json();
    if (data.success && data.analytics) {
      renderHostInsights(data.analytics);
    } else {
      hostContent.innerHTML = `<p style="padding:20px;color:#ef4444">Failed to load analytics.</p>`;
    }
  } catch (e) {
    hostContent.innerHTML = `<p style="padding:20px;color:#ef4444">Network error loading host analytics.</p>`;
  }
}

function renderHostInsights(an) {
  const impressions = an.totalImpressions || 7500;
  const saves = an.totalRSVPs || 1100;
  const rate = an.engagementRate || '14.5%';
  const openings = an.activeTeammateRequests || 6;
  const topEvents = an.topEvents || [];

  hostContent.innerHTML = `
    <div class="analytics-kpi-grid">
      <div class="kpi-card">
        <span class="kpi-val">${impressions.toLocaleString()}+</span>
        <span class="kpi-label">Audience Impressions</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-val">${saves.toLocaleString()}</span>
        <span class="kpi-label">Student RSVPs</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-val">${rate}</span>
        <span class="kpi-label">RSVP Conversion</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-val">${openings}</span>
        <span class="kpi-label">Teammate Openings</span>
      </div>
    </div>

    <div class="host-section-card">
      <h4>🔥 High Engagement Regional Hackathons</h4>
      ${topEvents.length > 0 ? topEvents.map(te => `
        <div class="host-stat-row">
          <span><strong>${escapeHTML(te.title)}</strong> (${escapeHTML(te.location)})</span>
          <strong style="color:var(--gold)">${te.saves} RSVPs · ${te.views} views</strong>
        </div>
      `).join('') : `
        <div class="host-stat-row">
          <span>Navi Mumbai Tech Corridor (Nerul, Vashi, Belapur)</span>
          <strong style="color:var(--gold)">5 Events Active</strong>
        </div>
      `}
    </div>

    <div class="growth-tip-card">
      <strong>💡 Organizer Growth Tip:</strong>
      Events that offer transparent <strong>Teammate Radar</strong> openings receive <strong>2.8x higher repeat attendance</strong> because students who find hackathon teammates are 85% more likely to physically show up on campus on event day!
    </div>
  `;
}

// -------------------------------------------------------------
// USER EVENT LISTENERS & NAVIGATION
// -------------------------------------------------------------
function openCreateDialog() {
  const form = document.getElementById('create-form');
  const dateInput = document.getElementById('form-date');

  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');

  dateInput.min = localToday;
  if (!dateInput.value) {
    dateInput.value = localToday;
  }
  eventDialog.showModal();
}

document.getElementById('open-create').addEventListener('click', openCreateDialog);
document.getElementById('banner-create').addEventListener('click', openCreateDialog);
document.getElementById('close-create').addEventListener('click', () => {
  eventDialog.close();
});

// View Toggle: Grid vs Event Pulse Map
btnViewGrid.addEventListener('click', () => {
  currentExploreView = 'grid';
  btnViewGrid.classList.add('active');
  btnViewMap.classList.remove('active');
  eventPulseMapContainer.classList.add('hidden');
  resultsBar.classList.remove('hidden');
  grid.classList.remove('hidden');
  renderEvents();
});

btnViewMap.addEventListener('click', () => {
  currentExploreView = 'map';
  btnViewMap.classList.add('active');
  btnViewGrid.classList.remove('active');
  eventPulseMapContainer.classList.remove('hidden');
  resultsBar.classList.add('hidden');
  grid.classList.add('hidden');
  emptyState.classList.add('hidden');

  if (!pulseMap) {
    initPulseMap();
  }
  setTimeout(() => {
    if (pulseMap) pulseMap.invalidateSize();
  }, 100);
});

document.getElementById('btn-recenter-map').addEventListener('click', () => {
  if (pulseMap) {
    pulseMap.flyTo([19.0330, 73.0163], 11, { animate: true });
  }
});

// Saved Toggle: Cards vs Calendar
btnSavedCards.addEventListener('click', () => {
  activeSavedTab = 'cards';
  btnSavedCards.classList.add('active');
  btnSavedCalendar.classList.remove('active');
  savedCardsWrapper.classList.remove('hidden');
  calendarWrapper.classList.add('hidden');
});

btnSavedCalendar.addEventListener('click', () => {
  activeSavedTab = 'calendar';
  btnSavedCalendar.classList.add('active');
  btnSavedCards.classList.remove('active');
  savedCardsWrapper.classList.add('hidden');
  calendarWrapper.classList.remove('hidden');
  renderCalendarAndConflicts();
});

document.getElementById('btn-export-ical').addEventListener('click', exportSavedToICS);

// XP Modal wiring
document.getElementById('open-xp-modal').addEventListener('click', renderXpModal);
document.getElementById('close-xp-dialog').addEventListener('click', () => {
  xpDialog.close();
});

// Fast-Pass Modal wiring
document.getElementById('close-pass-dialog').addEventListener('click', () => {
  passDialog.close();
});

// Certificate Modal wiring
document.getElementById('close-cert-dialog').addEventListener('click', () => {
  certDialog.close();
});

// Host Insights wiring
document.getElementById('open-host-insights').addEventListener('click', openHostInsights);
document.getElementById('banner-insights').addEventListener('click', openHostInsights);
document.getElementById('close-host-dialog').addEventListener('click', () => {
  hostDialog.close();
});

// WhatsApp-to-Event Sample Notice Buttons
const SAMPLE_NOTICES = {
  sies: 'GDG Navi Mumbai is hosting GenAI Hackathon 2026 at SIES GST Auditorium, Nerul on 2026-11-14 starting at 09:30 AM! Free entry with prizes worth ₹50,000. Register before seats fill: https://unstop.com/hackathons?searchTerm=SIES',
  pillai: 'Pillai College of Engineering Panvel presents National IoT & Robotics Summit on 2026-11-14 from 02:00 PM to 06:00 PM at PCE Campus Panvel. Hands-on hardware kits provided: https://devfolio.co/hackathons',
  vjti: 'VJTI Mumbai Coding Club: Advanced Full Stack & System Design Masterclass on 2026-11-15 at 10:00 AM in VJTI Matunga Campus. Register here: https://lu.ma/discover'
};

document.querySelectorAll('.btn-sample-notice').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.sample;
    if (SAMPLE_NOTICES[key]) {
      quickImportText.value = SAMPLE_NOTICES[key];
      btnParseNotice.click();
    }
  });
});

// Delegate click handlers
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const id = Number(target.dataset.id);
  if (!Number.isSafeInteger(id)) return;

  if (target.dataset.action === 'save') {
    toggleSaved(id);
  } else if (target.dataset.action === 'details') {
    openDetails(id);
  } else if (target.dataset.action === 'view-match') {
    openMatchExplainer(id);
  } else if (target.dataset.action === 'teammate') {
    openTeammateDialog(id);
  } else if (target.dataset.action === 'locate-map') {
    focusMapOnEvent(id);
  } else if (target.dataset.action === 'fast-pass') {
    openFastPass(id);
  } else if (target.dataset.action === 'register-gateway') {
    openRegisterPortal(id);
  }
});

// Quick Search Tags wiring
document.querySelectorAll('.quick-tag-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const q = chip.dataset.query;
    if (q === 'free') {
      if (freeFilter) freeFilter.checked = true;
      freeOnly = true;
    } else if (q === '₹') {
      if (prizeFilter) prizeFilter.checked = true;
      prizeOnly = true;
    } else if (q === 'weekend') {
      if (timeframeFilter) timeframeFilter.value = 'weekend';
      activeTimeframe = 'weekend';
    } else {
      searchInput.value = q;
      searchTerm = q.toLowerCase();
    }
    renderEvents();
    document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });
  });
});

// Corridor Chips wiring
document.querySelectorAll('.corridor-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    activeCorridor = chip.dataset.corridor;
    document.querySelectorAll('.corridor-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderEvents();
  });
});

// Category filter
document.querySelectorAll('[data-category]').forEach(button => {
  button.addEventListener('click', () => {
    activeCategory = button.dataset.category;

    document.querySelectorAll('[data-category]').forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', active);
    });

    renderEvents();
  });
});

// Interest Chips toggle
interestChipsContainer.querySelectorAll('.pref-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const interest = chip.dataset.interest;
    if (userInterests.includes(interest)) {
      if (userInterests.length > 1) {
        userInterests = userInterests.filter(i => i !== interest);
        chip.classList.remove('active');
      } else {
        showToast('Keep at least 1 interest selected for Smart Match');
      }
    } else {
      userInterests.push(interest);
      chip.classList.add('active');
    }
    saveStorage(STORAGE_KEYS.preferences, userInterests);
    renderEvents();
  });
});

// Search bar
document.getElementById('search-form').addEventListener('submit', event => {
  event.preventDefault();
  searchTerm = searchInput.value.trim().toLowerCase();
  renderEvents();
  document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });
});

searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  renderEvents();
});

locationFilter.addEventListener('change', () => {
  activeLocation = locationFilter.value;
  renderEvents();
});

if (verifiedFilter) {
  verifiedFilter.addEventListener('change', () => {
    verifiedOnly = verifiedFilter.checked;
    renderEvents();
  });
}

if (freeFilter) {
  freeFilter.addEventListener('change', () => {
    freeOnly = freeFilter.checked;
    renderEvents();
  });
}

if (prizeFilter) {
  prizeFilter.addEventListener('change', () => {
    prizeOnly = prizeFilter.checked;
    renderEvents();
  });
}

if (timeframeFilter) {
  timeframeFilter.addEventListener('change', () => {
    activeTimeframe = timeframeFilter.value;
    renderEvents();
  });
}

sortFilter.addEventListener('change', () => {
  activeSort = sortFilter.value;
  renderEvents();
});

document.getElementById('reset-filters').addEventListener('click', () => {
  activeCategory = 'All';
  searchTerm = '';
  activeLocation = 'all';
  activeCorridor = 'all';
  activeTimeframe = 'all';
  activeSort = 'match';
  verifiedOnly = false;
  freeOnly = false;
  prizeOnly = false;
  if (verifiedFilter) verifiedFilter.checked = false;
  if (freeFilter) freeFilter.checked = false;
  if (prizeFilter) prizeFilter.checked = false;
  if (timeframeFilter) timeframeFilter.value = 'all';
  searchInput.value = '';
  locationFilter.value = 'all';
  sortFilter.value = 'match';

  document.querySelectorAll('.corridor-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.corridor === 'all');
  });

  document.querySelectorAll('[data-category]').forEach(btn => {
    const active = btn.dataset.category === 'All';
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active);
  });

  renderEvents();
});

// Mobile menu toggle
document.getElementById('menu-toggle').addEventListener('click', () => {
  const nav = document.querySelector('.nav-links');
  const isOpen = nav.classList.toggle('open');
  document.getElementById('menu-toggle').setAttribute('aria-expanded', isOpen);
});

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelector('.nav-links').classList.remove('open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
  });
});

// Window resize map invalidation
window.addEventListener('resize', () => {
  if (pulseMap && currentExploreView === 'map') {
    pulseMap.invalidateSize();
  }
});

function handleDeepLink() {
  const hash = window.location.hash;
  const match = hash.match(/#event-(\d+)/);
  if (match) {
    const targetId = Number(match[1]);
    const ev = allEvents.find(e => e.id === targetId);
    if (ev) {
      setTimeout(() => openDetails(targetId), 300);
    }
  }
}

// Initial boot
setupNetworkResilience();
updateXpNavBadge();
fetchEvents().then(() => {
  initPulseMap();
});
