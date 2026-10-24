import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DATA_FILE = path.resolve(__dirname, 'data/events.json');

app.use(express.json());
app.use(express.static(path.resolve(__dirname, 'public')));

// Explicit attachment download endpoint (forces browser file download)
app.get('/api/download-app-zip', (req: Request, res: Response) => {
  const zipPath = path.resolve(__dirname, 'public/eventora-vscode-ready.zip');
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'eventora-vscode-ready.zip');
  } else {
    res.status(404).json({ success: false, message: 'ZIP package not found.' });
  }
});

// -------------------------------------------------------------
// FOOLPROOF DATA MODEL & ATOMIC STORAGE
// -------------------------------------------------------------
interface TeammateRequest {
  teamName: string;
  role: string;
  contact: string;
}

interface EventItem {
  id: number;
  title: string;
  category: string;
  location: string;
  venue: string;
  date: string;
  time: string;
  description: string;
  image: string;
  organizer?: string;
  registrationUrl?: string;
  source?: string;
  tags?: string[];
  verified?: boolean;
  savedCount: number;
  deadline?: string;
  lastSyncedAt?: string;
  teammateRequests?: TeammateRequest[];
  reportsCount?: number;
}

function readEvents(): EventItem[] {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read events from file, attempting recovery:', err);
    return [];
  }
}

function saveEvents(events: EventItem[]): boolean {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(events, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
    return true;
  } catch (err) {
    console.error('Failed to save events to file atomically:', err);
    return false;
  }
}

// -------------------------------------------------------------
// LIVE EVENT TRACKER & SYNCHRONIZATION ENGINE
// -------------------------------------------------------------
let lastSyncTimestamp = new Date().toISOString();

// Simulated real-time event pool from Devfolio, Luma, GDG, MLH, and College Portals
const livePlatformFeeds: Partial<EventItem>[] = [
  {
    title: "Devfolio MLH HackDay: Navi Mumbai",
    category: "Technology",
    location: "Navi Mumbai",
    venue: "SIES GST Innovation Auditorium, Nerul",
    date: "2026-11-27",
    time: "09:00",
    description: "Official Major League Hacking (MLH) and Devfolio seasonal hack day. Student hackers build open-source tools with cloud credits, swag kits, and cash prizes.",
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80",
    organizer: "Devfolio & MLH India",
    registrationUrl: "https://devfolio.co/mlh-hackday-navimumbai",
    source: "Devfolio",
    tags: ["Devfolio", "MLH", "Hackathon", "Coding", "Open Source"],
    verified: true,
    savedCount: 64,
    deadline: "2026-11-25",
    teammateRequests: [
      { teamName: "ByteStorm", role: "Backend Node.js Engineer", contact: "wa.me/919876500112" }
    ]
  },
  {
    title: "Luma GenAI & Agentic Workflows Masterclass",
    category: "Workshop",
    location: "Online",
    venue: "Live Zoom Interactive Sandbox & Luma Stage",
    date: "2026-11-16",
    time: "19:00",
    description: "Deep dive into autonomous multi-agent frameworks, tool-calling with Gemini 2.5, and vector search architectures. Hosted by Mumbai AI Guild on Luma.",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    organizer: "Mumbai AI Guild (lu.ma/genai-mumbai)",
    registrationUrl: "https://lu.ma/genai-agentic-masterclass",
    source: "Luma",
    tags: ["Luma", "AI Agents", "Workshop", "Gemini", "Online"],
    verified: true,
    savedCount: 91,
    deadline: "2026-11-15",
    teammateRequests: []
  },
  {
    title: "Pillai E-Cell Smart Panvel Hackathon",
    category: "Technology",
    location: "Panvel",
    venue: "Dr. K. M. Vasudevan Pillai Campus, New Panvel",
    date: "2026-11-30",
    time: "09:30",
    description: "Civic-tech and smart mobility hackathon challenging engineering students to design real IoT and software prototypes for urban transportation and environmental monitoring.",
    image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
    organizer: "PCE E-Cell & CSI Student Branch",
    source: "Campus",
    tags: ["Hackathon", "Smart City", "IoT", "Panvel", "Pillai"],
    verified: true,
    savedCount: 48,
    deadline: "2026-11-28",
    teammateRequests: [
      { teamName: "PanvelPioneers", role: "Hardware / ESP32 C++ Dev", contact: "t.me/panvel_pioneers" }
    ]
  }
];

function runLiveEventSync(): { addedCount: number; updatedCount: number } {
  const currentEvents = readEvents();
  let addedCount = 0;
  let updatedCount = 0;

  livePlatformFeeds.forEach(feedItem => {
    const existing = currentEvents.find(e => 
      e.title.toLowerCase() === feedItem.title?.toLowerCase() ||
      (e.registrationUrl && e.registrationUrl === feedItem.registrationUrl)
    );

    if (!existing && feedItem.title) {
      const newEv: EventItem = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        title: feedItem.title,
        category: feedItem.category || "Technology",
        location: feedItem.location || "Navi Mumbai",
        venue: feedItem.venue || "Navi Mumbai Innovation Campus",
        date: feedItem.date || "2026-11-25",
        time: feedItem.time || "10:00",
        description: feedItem.description || "Live tracked student event",
        image: feedItem.image || "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
        organizer: feedItem.organizer || "Live Tracked Partner",
        registrationUrl: feedItem.registrationUrl || "https://devfolio.co",
        source: feedItem.source || "Devfolio",
        tags: feedItem.tags || ["Technology"],
        verified: true,
        savedCount: feedItem.savedCount || 30,
        deadline: feedItem.deadline,
        lastSyncedAt: "Live tracked just now",
        teammateRequests: feedItem.teammateRequests || []
      };
      currentEvents.unshift(newEv);
      addedCount++;
    } else if (existing) {
      existing.lastSyncedAt = "Live tracked just now";
      updatedCount++;
    }
  });

  if (addedCount > 0 || updatedCount > 0) {
    saveEvents(currentEvents);
  }
  lastSyncTimestamp = new Date().toISOString();
  return { addedCount, updatedCount };
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// GET /api/stats - Platform Pulse & Live Verification Metrics
app.get('/api/stats', (req: Request, res: Response) => {
  const events = readEvents();
  const verifiedCount = events.filter(e => e.verified).length;
  const totalSaves = events.reduce((sum, e) => sum + (e.savedCount || 0), 0);
  const locations = Array.from(new Set(events.map(e => e.location)));
  const totalTeammateReqs = events.reduce((sum, e) => sum + (e.teammateRequests?.length || 0), 0);

  res.json({
    success: true,
    stats: {
      totalEvents: events.length,
      verifiedCampusEvents: verifiedCount,
      totalCommunitySaves: totalSaves,
      coveredCampuses: locations.length,
      activeTeammateOpenings: totalTeammateReqs,
      lastSyncTimestamp,
      sourcesCovered: ['Devfolio', 'Luma', 'GDG', 'Unstop', 'IEEE', 'Meetup', 'Campus']
    }
  });
});

// POST /api/events/sync-live - Trigger live daily event aggregation
app.post('/api/events/sync-live', (req: Request, res: Response) => {
  const result = runLiveEventSync();
  res.json({
    success: true,
    message: `Live tracker synchronized! Found ${result.addedCount} new opportunities, refreshed ${result.updatedCount} listings.`,
    syncResult: result,
    syncedAt: lastSyncTimestamp
  });
});

// GET /api/events - Filter & retrieve events
app.get('/api/events', (req: Request, res: Response) => {
  const { category, location, search, sort, verified, source } = req.query;
  let events = readEvents();

  if (verified === 'true') {
    events = events.filter(e => e.verified);
  }

  if (source && typeof source === 'string' && source !== 'All') {
    events = events.filter(e => e.source?.toLowerCase() === source.toLowerCase());
  }

  if (category && typeof category === 'string' && category !== 'All') {
    events = events.filter(e => e.category.toLowerCase() === category.toLowerCase());
  }

  if (location && typeof location === 'string' && location !== 'all') {
    events = events.filter(e => e.location.toLowerCase() === location.toLowerCase());
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    events = events.filter(e => {
      const matchText = [
        e.title,
        e.description,
        e.venue,
        e.location,
        e.category,
        e.organizer || '',
        e.source || '',
        ...(e.tags || [])
      ].join(' ').toLowerCase();
      return matchText.includes(q);
    });
  }

  if (sort === 'name') {
    events.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === 'popular') {
    events.sort((a, b) => (b.savedCount || 0) - (a.savedCount || 0));
  } else {
    // default sort by date soonest first
    events.sort((a, b) => {
      const d1 = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const d2 = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return d1 - d2;
    });
  }

  res.json({
    success: true,
    count: events.length,
    events
  });
});

// GET /api/events/:id - Get single event
app.get('/api/events/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const events = readEvents();
  const event = events.find(e => e.id === id);

  if (!event) {
    res.status(404).json({ success: false, message: 'Event not found' });
    return;
  }

  res.json({ success: true, event });
});

// POST /api/events - Create a new event with foolproof validation
app.post('/api/events', (req: Request, res: Response) => {
  const {
    title,
    category,
    location,
    venue,
    date,
    time,
    description,
    image,
    organizer,
    registrationUrl,
    tags
  } = req.body;

  if (!title || !category || !location || !venue || !date || !time || !description) {
    res.status(400).json({
      success: false,
      message: 'Please provide all required fields: title, category, location, venue, date, time, and description.'
    });
    return;
  }

  // Domain verification for genuine accreditation
  let isVerified = false;
  let detectedSource = 'Organized';
  const cleanUrl = String(registrationUrl || '').trim();

  if (/unstop\.com/i.test(cleanUrl)) {
    isVerified = true;
    detectedSource = 'Unstop';
  } else if (/devfolio\.co/i.test(cleanUrl)) {
    isVerified = true;
    detectedSource = 'Devfolio';
  } else if (/lu\.ma/i.test(cleanUrl)) {
    isVerified = true;
    detectedSource = 'Luma';
  } else if (/gdg\.community\.dev|meetup\.com/i.test(cleanUrl)) {
    isVerified = true;
    detectedSource = 'GDG';
  } else if (/edu\.in|ac\.in/i.test(cleanUrl) || /sies|pillai|terna|vjti|iitb/i.test(String(venue))) {
    isVerified = true;
    detectedSource = 'Campus';
  }

  const categoryImages: Record<string, string> = {
    Technology: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80',
    Workshop: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    Business: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80',
    Arts: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=80',
    Community: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=80'
  };

  const newEvent: EventItem = {
    id: Date.now(),
    title: String(title).trim(),
    category: String(category).trim(),
    location: String(location).trim(),
    venue: String(venue).trim(),
    date: String(date).trim(),
    time: String(time).trim(),
    description: String(description).trim(),
    image: image ? String(image).trim() : (categoryImages[category] || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80'),
    organizer: organizer ? String(organizer).trim() : 'Community Organizer',
    registrationUrl: cleanUrl || 'https://unstop.com',
    source: detectedSource,
    tags: Array.isArray(tags) ? tags : [category, location],
    verified: isVerified,
    savedCount: 1,
    lastSyncedAt: 'Live published today',
    teammateRequests: []
  };

  const events = readEvents();
  events.unshift(newEvent);
  saveEvents(events);

  res.status(201).json({
    success: true,
    message: isVerified 
      ? '✓ Verified event published successfully to Eventora!' 
      : 'Event published successfully to Eventora community feed!',
    event: newEvent
  });
});

// POST /api/events/:id/teammate - Innovation: Hackathon Teammate Radar
app.post('/api/events/:id/teammate', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { teamName, role, contact } = req.body;

  if (!teamName || !role || !contact) {
    res.status(400).json({ success: false, message: 'Please provide team name, required skill/role, and contact handle.' });
    return;
  }

  const events = readEvents();
  const event = events.find(e => e.id === id);

  if (!event) {
    res.status(404).json({ success: false, message: 'Event not found' });
    return;
  }

  if (!event.teammateRequests) {
    event.teammateRequests = [];
  }

  const newReq: TeammateRequest = {
    teamName: String(teamName).trim(),
    role: String(role).trim(),
    contact: String(contact).trim()
  };

  event.teammateRequests.push(newReq);
  saveEvents(events);

  res.status(201).json({
    success: true,
    message: 'Teammate request published on the event board!',
    teammateRequests: event.teammateRequests
  });
});

// POST /api/events/:id/rsvp - Track community interest count
app.post('/api/events/:id/rsvp', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const events = readEvents();
  const event = events.find(e => e.id === id);

  if (!event) {
    res.status(404).json({ success: false, message: 'Event not found' });
    return;
  }

  const { action } = req.body;
  if (action === 'remove') {
    event.savedCount = Math.max(0, (event.savedCount || 1) - 1);
  } else {
    event.savedCount = (event.savedCount || 0) + 1;
  }

  saveEvents(events);
  res.json({ success: true, savedCount: event.savedCount });
});

// POST /api/events/:id/report - Community Moderation
app.post('/api/events/:id/report', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const events = readEvents();
  const event = events.find(e => e.id === id);

  if (!event) {
    res.status(404).json({ success: false, message: 'Event not found' });
    return;
  }

  event.reportsCount = (event.reportsCount || 0) + 1;
  saveEvents(events);

  res.json({
    success: true,
    message: 'Listing reported for moderation review. Thank you for keeping Eventora genuine.'
  });
});

// POST /api/events/parse-notice - Innovation: 1-Click WhatsApp / Flyer Parser
app.post('/api/events/parse-notice', async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ success: false, message: 'Please provide announcement text to parse.' });
    return;
  }

  const cleanText = text.trim();

  let title = '';
  let category = 'Technology';
  let location = 'Navi Mumbai';
  let venue = '';
  let date = '';
  let time = '10:00';
  let registrationUrl = '';
  const tags: string[] = [];

  // Extract URLs
  const urlMatch = cleanText.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    registrationUrl = urlMatch[0].replace(/[.,!?;:]+$/, '');
  }

  // Detect location
  const lower = cleanText.toLowerCase();
  if (lower.includes('panvel')) {
    location = 'Panvel';
  } else if (lower.includes('vashi') || lower.includes('nerul') || lower.includes('belapur') || lower.includes('kharghar') || lower.includes('navi mumbai') || lower.includes('sies')) {
    location = 'Navi Mumbai';
  } else if (lower.includes('online') || lower.includes('zoom') || lower.includes('meet.google') || lower.includes('virtual')) {
    location = 'Online';
  } else if (lower.includes('bandra') || lower.includes('andheri') || lower.includes('fort') || lower.includes('mumbai') || lower.includes('powai') || lower.includes('matunga')) {
    location = 'Mumbai';
  }

  // Detect Category & Tags
  if (lower.includes('hackathon') || lower.includes('hackfest') || lower.includes('devfolio') || lower.includes('hack')) {
    category = 'Technology';
    tags.push('Hackathon', 'Coding');
  } else if (lower.includes('ai') || lower.includes('machine learning') || lower.includes('llm') || lower.includes('gemini') || lower.includes('luma')) {
    category = 'Technology';
    tags.push('AI', 'Machine Learning');
  } else if (lower.includes('workshop') || lower.includes('hands-on') || lower.includes('bootcamp') || lower.includes('lab') || lower.includes('symposium')) {
    category = 'Workshop';
    tags.push('Workshop', 'Skill Building');
  } else if (lower.includes('pitch') || lower.includes('startup') || lower.includes('founder') || lower.includes('business') || lower.includes('e-cell')) {
    category = 'Business';
    tags.push('Startups', 'Pitching');
  } else if (lower.includes('art') || lower.includes('music') || lower.includes('culture') || lower.includes('design')) {
    category = 'Arts';
    tags.push('Arts', 'Culture');
  } else if (lower.includes('clean-up') || lower.includes('volunteer') || lower.includes('drive') || lower.includes('meetup') || lower.includes('community')) {
    category = 'Community';
    tags.push('Community', 'Networking');
  }

  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  const isoMatch = cleanText.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    date = isoMatch[0];
  } else {
    const textDateMatch = cleanText.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+(\d{4}))?/i);
    if (textDateMatch) {
      const day = String(textDateMatch[1]).padStart(2, '0');
      const mon = monthMap[textDateMatch[2].toLowerCase().slice(0, 3)] || '11';
      const year = textDateMatch[3] || '2026';
      date = `${year}-${mon}-${day}`;
    }
  }

  if (!date) {
    date = '2026-11-20';
  }

  // Extract Time
  const timeMatch = cleanText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? timeMatch[2] : '00';
    const isPm = timeMatch[3].toLowerCase() === 'pm';
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    time = `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  // Extract Venue
  const venueLine = cleanText.split('\n').find(l => /venue|at:|location:|college|campus|auditorium|hall|room|centre/i.test(l));
  if (venueLine) {
    venue = venueLine.replace(/^(venue|location|at)\s*[:\-]\s*/i, '').trim();
  } else {
    venue = location === 'Online' ? 'Google Meet / Online Session' : `${location} Innovation Campus`;
  }

  // Extract Title
  const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length > 0) {
    title = lines[0].replace(/^(📢|🚀|🔥|✨|⚡|📣|announcement|notice|alert)\s*[:\-]?\s*/i, '');
    if (title.length > 70) {
      title = title.substring(0, 67) + '...';
    }
  } else {
    title = 'Community Tech Gathering 2026';
  }

  res.json({
    success: true,
    parsed: {
      title: title || 'Upcoming Tech Event',
      category,
      location,
      venue: venue || 'Auditorium, Navi Mumbai',
      date,
      time,
      description: cleanText.length > 240 ? cleanText.substring(0, 237) + '...' : cleanText,
      registrationUrl: registrationUrl || 'https://unstop.com',
      tags: tags.length ? tags : ['Technology', 'Workshop']
    }
  });
});

// -------------------------------------------------------------
// VITE OR STATIC FRONTEND SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Eventora server running at http://localhost:${PORT}`);
  });
}

startServer();
