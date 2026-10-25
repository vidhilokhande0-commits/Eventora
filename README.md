# Eventora — Discover What's Happening Around You

A full-stack, local event discovery and hackathon networking platform for students, developers, and creators across Navi Mumbai, Mumbai, Panvel, and Online.

---

## 🚀 Quick Start in VS Code (Ready to Run)

### 1. Prerequisites
- **Node.js**: Version 18 or higher (Download from [nodejs.org](https://nodejs.org))
- **VS Code**: Any modern version

### 2. Open Project in VS Code
1. Unzip the downloaded `eventora-vscode-ready.zip` file.
2. Open **VS Code**.
3. Click **File > Open Folder...** and select the unzipped `eventora` folder.

### 3. Install Dependencies
Open the built-in terminal in VS Code (`Ctrl + ~` or `Cmd + ~` on Mac) and run:
```bash
npm install
```

### 4. Run the Application
In the terminal, start the server:
```bash
npm run dev
```

### 5. Open in Browser
Open your browser and navigate to:
```
http://localhost:3000
```

That's it! Both the frontend and Express REST API backend are running together on port 3000.

---

## 📁 Project Structure

```text
├── index.html          # Responsive dark editorial interface (HTML entry point)
├── style.css           # Complete design system with mobile responsiveness
├── script.js           # Client logic: Smart Match Score, Teammate Radar, offline cache
├── server.ts           # Express REST API backend, WhatsApp notice parser, live sync
├── data/
│   └── events.json     # Pre-seeded verified events database (atomic file store)
├── package.json        # Dependencies & start scripts (Vite, Express, TSX)
├── tsconfig.json       # TypeScript configuration
└── vite.config.ts      # Vite bundler configuration
```

---

## 🌟 Key Features

1. **⚡ 1-Click WhatsApp / Flyer Notice Parser**:
   - In the "+ Create Event" dialog, paste messy WhatsApp circular text.
   - Click "Auto-Fill with Parser" to populate title, date, time, venue, category, and links in 1 second.
2. **✦ Transparent Smart Match Score (0–100%)**:
   - Calculates student interest alignment, campus proximity (Navi Mumbai, Panvel, Mumbai), and event timing.
   - Click any match badge to view the mathematical breakdown.
3. **🤝 Hackathon Teammate Radar**:
   - Hackathon cards feature team openings (*e.g., "Need 1 React Dev"*).
   - Students can connect directly via WhatsApp/Telegram or post new openings.
4. **🌐 Multi-Source Live Aggregator**:
   - Curated genuine listings from Devfolio, Luma, Google Developer Groups (GDG), IEEE, and Unstop.
   - Click "⚡ Sync Live Feeds" to poll for newly announced events.
5. **✓ Verified Campus Filter**:
   - Toggle to view only verified college fests and accredited platform events.

---

## 🛠️ Available Scripts

- `npm run dev` — Starts the Express backend with Vite middleware in development mode at `http://localhost:3000`
- `npm run build` — Builds the optimized static assets into the `dist/` folder
- `npm run start` — Starts the production Express server
