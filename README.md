# 📿 Tasbih Counter – Digital Islamic Prayer Beads (PWA)

A beautiful, modern, installable Progressive Web App (PWA) for tracking dhikr (remembrance) counts. Designed for speed, offline resilience, spiritual focus, and graceful UX on mobile & desktop.

---

## ✨ Core Highlights

- ✅ Offline-first (Service Worker + localStorage persistence)
- 🔐 Lightweight account sync via Google Apps Script backend
- 📈 Built‑in Analytics (Day / Month / Year activity charts)
- 🌓 Adaptive theming (light/dark via prefers-color-scheme)
- 📱 Multi-surface Install UX (banner, modal, header button, inline hint, floating chip, fallback instructions)
- 💾 Auto-save & offline queue (syncs when reconnected)
- 🧭 Guided Onboarding (3‑step intro flow)
- 🧪 Accessible UI (skip link, ARIA roles, focus-visible, reduced motion friendly)
- 👁️ Password show/hide with accessible toggle
- ⌨️ Keyboard shortcuts (save, new, etc.)
- 🪄 Tooltips, confirmations & contextual help
- 🔔 Haptic / subtle feedback on mobile

---

## 🖼 Screens / Flow

1. Login / Register (auto-generated editable User ID on register)
2. Dashboard: add tasbih, increment counts, remove, sync
3. Analytics card (unlocked once activity exists)
4. Install surfaces appear contextually until installed/dismissed
5. Popups (custom) & confirmation dialogs for safety

---

## 🏗 Architecture Overview

| Layer               | Responsibility                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `index.html`        | Structure, modals, install surfaces, onboarding, analytics canvas                         |
| `styles.css`        | Theming, responsive layout, dark mode, component styling                                  |
| `script.js`         | Auth, tasbih logic, persistence, install orchestration, analytics, onboarding, UX helpers |
| `service-worker.js` | Offline caching & (future) background sync                                                |
| `manifest.json`     | PWA metadata, icons, shortcuts                                                            |
| Google Apps Script  | Minimal backend for createUser/login/save/getProgress                                     |

---

## 🔐 Authentication Model

The app uses a **lightweight credential model**:

- `createUser` and `login` POST to Apps Script endpoint
- No JWT/session — relies on returned success + stored userId
- Local persistence via `localStorage` keys
  - `tasbih_userId`
  - `tasbih_name`
  - `tasbih_counts` (object: { tasbihName: number })
  - `tasbih_offline_pending` (queued unsynced payload)
  - `tasbih_activity_log_v1` (analytics event log)
  - UX state flags (e.g. `hasSeenInstallModal`, `inlineInstallDismissed`, `pwaInstalled`, `hasCompletedOnboarding`)

> For production-grade security you’d migrate to a proper auth provider + tokens.

---

## 📊 Analytics System

Activity is logged locally on each increment:

```jsonc
// Entry shape
{ "t": 1737571234567, "n": "SubhanAllah", "d": 1 }
```

Aggregations:

- Day view: last 7 days grouped by weekday
- Month view: last 30 days daily totals
- Year view: current year by month

Rendering powered by Chart.js (loaded via CDN). Empty state messaging appears until non-zero activity exists.

---

## 🧪 Keyboard Shortcuts

| Shortcut       | Action                                                   |
| -------------- | -------------------------------------------------------- |
| Ctrl / Cmd + S | Save & sync (or queue offline)                           |
| Ctrl / Cmd + N | Focus new tasbih input                                   |
| Esc            | Dismiss open modal (install / onboarding / confirmation) |

---

## 🛠 Installation (as PWA)

Automatic surfaces appear when the browser fires `beforeinstallprompt`.
Surfaces:

- Install Banner (mobile, timed)
- Install Modal (first-time experience)
- Header Install Ghost Button
- Inline Hint (dismissible)
- Floating Install Chip (FAB-style)
- Manual instruction fallback (e.g. iOS Safari: Share → Add to Home Screen)

After successful install:

- UI hides all install affordances
- `pwaInstalled` flag set for future sessions

### Manual (Desktop Chromium)

1. Open the app URL
2. Click browser install icon (or use in-app button)
3. Confirm

### iOS Safari

1. Tap Share
2. Tap Add to Home Screen
3. Launch from new icon (standalone mode)

---

## 💾 Data Persistence

| Scope         | Mechanism                             | Notes                                         |
| ------------- | ------------------------------------- | --------------------------------------------- |
| Local counts  | `localStorage`                        | Immediate persistence per increment           |
| Cloud sync    | Apps Script POST                      | Only when online & logged in                  |
| Offline saves | Stored under `tasbih_offline_pending` | Auto-flushed when reconnected & authenticated |
| Activity log  | `tasbih_activity_log_v1`              | Prunes after ~4000 entries                    |

---

## 🔄 Sync Flow

1. User increments → localStorage writes immediately
2. User clicks Save (or auto-save triggers) → if:
   - Online + logged in → POST to backend
   - Offline / not logged in → queue in `tasbih_offline_pending`
3. On next online event + logged in → queued payload uploaded

---

## 🧬 State Flags (UX)

| Key                      | Purpose                                 |
| ------------------------ | --------------------------------------- |
| `firstVisit`             | Triggers welcome feedback               |
| `interactionCount`       | Drives delayed modal install prompt     |
| `hasSeenInstallModal`    | Prevents re-showing intro install modal |
| `installDismissed`       | Timestamp to rate-limit banner          |
| `inlineInstallDismissed` | Hides inline hint                       |
| `pwaInstalled`           | Consolidated install detection flag     |
| `hasCompletedOnboarding` | One-time onboarding gate                |
| `hasSeenContextualHelp`  | One-time tooltip tip                    |

---

## 🔐 Password Toggle

Implemented using accessible `<button>` with two inline SVGs:

- Eye (hidden state)
- Eye-off (visible state)
  Swaps `type=password/text`, updates `aria-label`, toggles displayed icon.

---

## 🧭 Onboarding Flow

3 steps highlighting: Welcome → Install Benefits → Start Dhikr.
Stored completion under `hasCompletedOnboarding`.

---

## 🧰 Development

No build tooling required (vanilla stack).

Recommended local test steps:

1. Serve directory over HTTP (for SW + PWA). Examples:
   - VS Code Live Server extension
   - Python: `python -m http.server 5173` (adjust port)
2. Open in Chromium-based browser
3. Open DevTools > Application to inspect manifest, service worker, storage
4. Toggle offline in DevTools to test queueing / banner hiding

> Ensure you update `SCRIPT_URL` at top of `script.js` with your deployed Apps Script Web App endpoint.

### Google Apps Script Backend (Conceptual)

Expected actions (POST):

- `createUser` { userId, name, password }
- `login` { userId, password } → returns `{ success, name }`
- `saveTasbih` { userId, name, data } → persists counts
- `getProgress` { userId } → returns object { tasbihName: totalToday }

### Service Worker (Planned Enhancements)

- Runtime caching strategy (currently basic register)
- Background sync / periodic sync (future)
- Versioned asset cache invalidation

---

## ♿ Accessibility Notes

- Skip link to main content
- High-contrast gradients & focus ring tokens
- Interactive elements keyboard reachable
- ARIA tab roles on chart range buttons
- Semantic headings & readable contrast palette
- Reduced motion friendly (no essential motion gating)

---

## 🐛 Error Handling & Resilience

- Network outages: offline queue + UI feedback
- Install prompt guards: feature detection
- Activity log pruning for localStorage health
- Graceful degradation when Charts unavailable (empty state)

---

## 🗺 Roadmap / Ideas

- Export counts (CSV / JSON / share intent)
- Streak tracking & daily goal badges
- Per‑tasbih breakdown charts & filters
- Tagging / categorization
- Reminders / scheduled notifications (where supported)
- Manual theme toggle override (light/dark)
- Multi-language / RTL support (Arabic UI)
- Cloud conflict resolution strategy (merge vs overwrite)
- Settings panel (data management, privacy)
- Optional vibration tuning & sound cues

---

## 🤝 Contributing

1. Fork & clone
2. Create a feature branch
3. Keep changes scoped (small PRs > large ones)
4. Explain UX rationale in PR description

Feel free to open issues for feature discussions first.

---

## 🧾 License

Choose a license (e.g. MIT) and place it here. If unsure, MIT is a permissive default:

```
MIT License © 2025 Your Name
```

---

## 🙏 A Note of Intention

May this tool help increase remembrance and spiritual focus. If you benefit, consider sharing with others.

---

## 📬 Support / Questions

Open an issue or extend the README with FAQs. Happy to guide improvements.

---

### Badge (Optional)

Feel free to add a shields.io badge once hosted (deployment URL pending).

```md
![PWA Ready](https://img.shields.io/badge/PWA-ready-brightgreen)
```

---

### Quick Reference

| Action       | Where                                              |
| ------------ | -------------------------------------------------- |
| Add Tasbih   | Dashboard input + Add button                       |
| Increment    | +1 button per tasbih row                           |
| Remove       | Remove button (with confirmation)                  |
| Save         | Save & Sync button or Ctrl/Cmd+S                   |
| Switch Range | Day / Month / Year tabs in Analytics               |
| Install      | Header button / Inline hint / FAB / Banner / Modal |

---

Enjoy & BarakAllahu Feek! 🌙
