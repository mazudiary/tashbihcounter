/*************** CONFIG - set your Apps Script Web App URL here ***************/
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbz13o5VIS1OgbSk1ErjYrp6yelHZoN4eZSmKEaXe_--TQedY35K4jQUssUS-iyohs0/exec";
/*****************************************************************************/

// App state
let userId = localStorage.getItem("tasbih_userId") || "";
let userName = localStorage.getItem("tasbih_name") || "";
let counts = JSON.parse(localStorage.getItem("tasbih_counts") || "{}");
let pendingKey = "tasbih_offline_pending"; // when offline and save called, store under this key

// DOM refs
const netStatus = document.getElementById("netStatus");
const loginCard = document.getElementById("loginCard");
const registerCard = document.getElementById("registerCard");
const dashboard = document.getElementById("dashboard");
const displayName = document.getElementById("displayName");
const tasbihList = document.getElementById("tasbihList");
const progressDiv = document.getElementById("progress");

// Network status
function updateNetworkUI() {
  if (navigator.onLine) {
    netStatus.className = "status card online";
    netStatus.textContent = "🟢 Online — syncing pending data if any";
    syncOfflinePending();
  } else {
    netStatus.className = "status card offline";
    netStatus.textContent = "🔴 Offline — work locally, data will sync later";
  }
}
window.addEventListener("online", updateNetworkUI);
window.addEventListener("offline", updateNetworkUI);
updateNetworkUI();

function showAuthMessage(msg, isError, type = "login") {
  const msgElement =
    type === "register"
      ? document.getElementById("registerMsg")
      : document.getElementById("loginMsg");
  msgElement.textContent = msg || "";
  msgElement.style.color = isError ? "#b91c1c" : "#0f5132";
}

function showLogin() {
  loginCard.style.display = "block";
  registerCard.style.display = "none";
  // Clear any previous messages
  document.getElementById("loginMsg").textContent = "";
  document.getElementById("registerMsg").textContent = "";
}

function showRegister() {
  loginCard.style.display = "none";
  registerCard.style.display = "block";
  // Clear any previous messages
  document.getElementById("loginMsg").textContent = "";
  document.getElementById("registerMsg").textContent = "";

  // Auto-generate a unique user ID
  const generatedId = generateUserId();
  document.getElementById("registerUserId").value = generatedId;
  document.getElementById("registerName").value = "";
  document.getElementById("registerPassword").value = "";

  // Check if the generated ID is available
  checkUserIdAvailability(generatedId);
}

// Generate unique user ID
function generateUserId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `user_${timestamp}_${random}`;
}

// Check if user ID is available
async function checkUserIdAvailability(userId) {
  const msgEl = document.getElementById("registerMsg");

  if (!navigator.onLine) {
    msgEl.textContent = "⚠️ Offline - cannot verify ID availability";
    msgEl.style.color = "#f59e0b";
    return true; // Assume available when offline
  }

  try {
    msgEl.textContent = "🔍 Checking availability...";
    msgEl.style.color = "#6b7280";

    const form = new URLSearchParams({
      action: "checkUserId",
      userId: userId,
    });
    const res = await fetch(SCRIPT_URL, { method: "POST", body: form });
    const data = await res.json();

    if (data.available === true) {
      msgEl.textContent = "✅ User ID is available";
      msgEl.style.color = "#10b981";
      return true;
    } else {
      msgEl.textContent = "❌ User ID is already taken";
      msgEl.style.color = "#ef4444";
      return false;
    }
  } catch (err) {
    console.warn("Could not check user ID availability:", err);
    msgEl.textContent = "⚠️ Could not verify availability - proceeding anyway";
    msgEl.style.color = "#f59e0b";
    return true; // Assume available on error
  }
}

function saveLocalState() {
  localStorage.setItem("tasbih_counts", JSON.stringify(counts));
  if (userId) localStorage.setItem("tasbih_userId", userId);
  if (userName) localStorage.setItem("tasbih_name", userName);
}

// Render tasbih list
function renderTasbihs() {
  tasbihList.innerHTML = "";
  if (Object.keys(counts).length === 0) {
    tasbihList.innerHTML = '<p class="small muted">No tasbih added yet.</p>';
    return;
  }
  for (let name of Object.keys(counts)) {
    // encode id-safe key
    const idSafe = encodeURIComponent(name);
    const row = document.createElement("div");
    row.className = "tasbih-row";
    row.innerHTML = `
          <div>
            <h3>${escapeHtml(name)}</h3>
            <p class="small muted">Count: <strong id="c_${idSafe}">${
      counts[name]
    }</strong></p>
          </div>
          <div style="display:flex;gap:8px;flex-direction:column;">
            <div style="display:flex;gap:8px;">
              <button onclick="incrementTasbih('${escapeJs(name)}')">+1</button>
            </div>
            <button onclick="removeTasbih('${escapeJs(
              name
            )}')" style="background:#6b7280">Remove</button>
          </div>
        `;
    tasbihList.appendChild(row);
  }
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m])
  );
}
function escapeJs(s) {
  return s.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// Custom popup functions
function showPopup(
  title,
  message,
  primaryText = "OK",
  secondaryText = null,
  onPrimary = null,
  onSecondary = null
) {
  document.getElementById("popupTitle").textContent = title;
  document.getElementById("popupMessage").textContent = message;
  document.getElementById("popupPrimaryBtn").textContent = primaryText;

  const primaryBtn = document.getElementById("popupPrimaryBtn");
  const secondaryBtn = document.getElementById("popupSecondaryBtn");

  // Reset event listeners
  primaryBtn.onclick = null;
  secondaryBtn.onclick = null;

  if (secondaryText) {
    secondaryBtn.textContent = secondaryText;
    secondaryBtn.style.display = "block";
    secondaryBtn.onclick = () => {
      hidePopup();
      if (onSecondary) onSecondary();
    };
    primaryBtn.onclick = () => {
      hidePopup();
      if (onPrimary) onPrimary();
    };
  } else {
    secondaryBtn.style.display = "none";
    primaryBtn.onclick = () => {
      hidePopup();
      if (onPrimary) onPrimary();
    };
  }

  document.getElementById("customPopup").style.display = "flex";
}

function hidePopup() {
  document.getElementById("customPopup").style.display = "none";
}

// Tasbih operations
function addTasbih() {
  const v = document.getElementById("newTasbih").value.trim();
  if (!v) {
    showPopup("Error", "Enter tasbih name");
    return;
  }
  if (counts[v] !== undefined) {
    showPopup("Error", "This tasbih already exists");
    document.getElementById("newTasbih").value = "";
    return;
  }
  counts[v] = 0;
  document.getElementById("newTasbih").value = "";
  saveLocalState();
  renderTasbihs();
}

function incrementTasbih(name) {
  counts[name] = (counts[name] || 0) + 1;
  const el = document.getElementById("c_" + encodeURIComponent(name));
  if (el) el.textContent = counts[name];
  saveLocalState();
  logDhikrActivity(name, 1);
  scheduleChartUpdate();
}
function removeTasbih(name) {
  showPopup(
    "Remove Tasbih",
    `Are you sure you want to remove "${name}"?`,
    "Remove",
    "Cancel",
    () => {
      delete counts[name];
      saveLocalState();
      renderTasbihs();
    }
  );
}

function clearLocal() {
  showConfirmation(
    "Clear All Tasbihs",
    "Are you sure you want to clear all local tasbihs? This action cannot be undone.",
    "🗑️",
    (confirmed) => {
      if (confirmed) {
        counts = {};
        saveLocalState();
        renderTasbihs();
        progressDiv.innerHTML = "";
        showMobileFeedback("🗑️ All tasbihs cleared");
      }
    }
  );
}

// AUTH: createUser & login
async function createUser() {
  const uid = document.getElementById("registerUserId").value.trim();
  const name = document.getElementById("registerName").value.trim();
  const pass = document.getElementById("registerPassword").value.trim();
  if (!uid || !name || !pass) {
    showAuthMessage("Provide UserID, Name & Password", true, "register");
    return;
  }
  if (!navigator.onLine) {
    showAuthMessage("Registration requires internet", true, "register");
    return;
  }

  // Check if user ID is available before creating
  const isAvailable = await checkUserIdAvailability(uid);
  if (!isAvailable) {
    showAuthMessage(
      "User ID is already taken. Please choose a different one.",
      true,
      "register"
    );
    return;
  }

  try {
    const form = new URLSearchParams({
      action: "createUser",
      userId: uid,
      name: name,
      password: pass,
    });
    const res = await fetch(SCRIPT_URL, { method: "POST", body: form });
    const data = await res.json();
    if (data.success) {
      userId = uid;
      userName = name;
      saveLocalState();
      showPopup(
        "Welcome!",
        "Account created successfully! You're now logged in."
      );
      openDashboard();
    } else {
      showAuthMessage(data.message || "Registration failed", true, "register");
    }
  } catch (err) {
    showAuthMessage("Error: " + err.message, true, "register");
  }
}

async function login() {
  const uid = document.getElementById("loginUserId").value.trim();
  const pass = document.getElementById("loginPassword").value.trim();
  if (!uid || !pass) {
    showAuthMessage("Provide UserID & Password", true, "login");
    return;
  }
  if (!navigator.onLine) {
    showAuthMessage("Login requires internet", true, "login");
    return;
  }

  try {
    const form = new URLSearchParams({
      action: "login",
      userId: uid,
      password: pass,
    });
    const res = await fetch(SCRIPT_URL, { method: "POST", body: form });
    const data = await res.json();
    if (data.success) {
      userId = uid;
      userName =
        data.name || document.getElementById("loginUserId").value || "";
      saveLocalState();
      showPopup("Welcome back!", "Successfully logged in!");
      openDashboard();
    } else {
      showAuthMessage(data.message || "Invalid credentials", true, "login");
    }
  } catch (err) {
    showAuthMessage("Error: " + err.message, true, "login");
  }
}

function openDashboard() {
  loginCard.style.display = "none";
  registerCard.style.display = "none";
  dashboard.style.display = "block";
  displayName.textContent = userName || userId;
  renderTasbihs();

  // Auto-load today's progress when opening dashboard
  if (navigator.onLine && userId) {
    loadProgress();
  }
}

// Logout function
function logout() {
  showPopup(
    "Logout",
    "Are you sure you want to logout? Unsaved data will be kept locally.",
    "Logout",
    "Cancel",
    () => {
      // Clear user credentials but keep local data
      userId = "";
      userName = "";

      // Remove from localStorage (but keep counts and session)
      localStorage.removeItem("tasbih_userId");
      localStorage.removeItem("tasbih_name");

      // Clear auth form
      document.getElementById("loginUserId").value = "";
      document.getElementById("loginPassword").value = "";
      document.getElementById("registerUserId").value = "";
      document.getElementById("registerName").value = "";
      document.getElementById("registerPassword").value = "";

      // Clear auth message
      showAuthMessage("", false);

      // Switch back to auth view
      dashboard.style.display = "none";
      showLogin();

      // Clear progress display
      progressDiv.innerHTML = "";

      console.log("User logged out successfully");
    }
  );
}

// Save / Sync logic
async function saveProgress() {
  const saveBtn = document.querySelector('button[onclick="saveProgress()"]');

  // Add loading state
  if (saveBtn) {
    showLoadingSpinner(saveBtn, true);
    saveBtn.textContent = "⏳ Saving...";
  }

  try {
    // if no user logged in, save local and notify
    if (!userId) {
      localStorage.setItem(pendingKey, JSON.stringify({ counts }));
      showMobileFeedback("💾 Saved locally - login to sync");
      return;
    }

    // If offline, store pending and return
    if (!navigator.onLine) {
      localStorage.setItem(pendingKey, JSON.stringify({ counts }));
      showMobileFeedback("📴 Offline - saved locally");
      return;
    }

    // Build payload (no sessionId needed anymore)
    const payload = {
      counts: counts,
    };
    const form = new URLSearchParams({
      action: "saveTasbih",
      userId: userId,
      name: userName,
      data: JSON.stringify(payload),
    });
    const res = await fetch(SCRIPT_URL, { method: "POST", body: form });
    const data = await res.json();

    if (data.success) {
      showMobileFeedback("✅ Saved to cloud");
      // clear pending
      localStorage.removeItem(pendingKey);
    } else {
      showMobileFeedback("❌ Save failed - try again");
      console.error("Server error:", data.message);
    }
  } catch (err) {
    // store pending if fetch fails
    localStorage.setItem(pendingKey, JSON.stringify({ counts }));
    showMobileFeedback("🔄 Network error - saved locally");
    console.error("Save error:", err);
  } finally {
    // Remove loading state
    if (saveBtn) {
      showLoadingSpinner(saveBtn, false);
      saveBtn.textContent = "💾 Save & Sync";
    }
  }
}

// When online, attempt to send pending
async function syncOfflinePending() {
  if (!navigator.onLine) return;
  const pending = localStorage.getItem(pendingKey);
  if (!pending) return;
  if (!userId) return; // need logged user to sync
  try {
    const pendingData = JSON.parse(pending);
    if (pendingData && pendingData.counts) {
      const payload = {
        counts: pendingData.counts,
      };
      const form = new URLSearchParams({
        action: "saveTasbih",
        userId: userId,
        name: userName,
        data: JSON.stringify(payload),
      });
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem(pendingKey);
        console.log("Pending synced.");
      } else {
        console.warn("Pending sync failed:", data);
      }
    }
  } catch (err) {
    console.warn("Sync error:", err);
  }
}

// Load today's progress from server (aggregated per tasbih)
async function loadProgress() {
  if (!userId) {
    showPopup(
      "Login Required",
      "Login required to load server progress. Showing local data."
    );
    renderLocalProgress();
    return;
  }
  if (!navigator.onLine) {
    showPopup("Offline Mode", "Offline: showing local data");
    renderLocalProgress();
    return;
  }
  try {
    const form = new URLSearchParams({
      action: "getProgress",
      userId: userId,
    });
    const res = await fetch(SCRIPT_URL, { method: "POST", body: form });
    const data = await res.json();
    // data is object mapping tasbihName -> totalCount
    if (data && typeof data === "object") {
      // merge server data into UI (but don't overwrite local - show both)
      progressDiv.innerHTML =
        "<h4>📊 Today's Server Totals</h4><p class='small'>Accumulated from all saves today</p>";
      let html = "";
      for (let k of Object.keys(data)) {
        html += `<div>${escapeHtml(k)}: <strong>${data[k]}</strong></div>`;
      }
      progressDiv.innerHTML +=
        html || '<div class="small muted">No server records today</div>';

      // Also show local data for comparison
      progressDiv.innerHTML +=
        "<h4 style='margin-top: 15px;'>💻 Current Local Counts</h4><p class='small'>Not yet saved to server</p>";
      let localHtml = "";
      for (let k of Object.keys(counts)) {
        localHtml += `<div>${escapeHtml(k)}: <strong>${
          counts[k]
        }</strong></div>`;
      }
      progressDiv.innerHTML +=
        localHtml || '<div class="small muted">No local counts</div>';
    } else {
      progressDiv.innerHTML =
        '<div class="small muted">No data returned from server</div>';
    }
  } catch (err) {
    showPopup("Error", "Error loading progress: " + err.message);
  }
}

function renderLocalProgress() {
  progressDiv.innerHTML = "<h4>Local (unsynced)</h4>";
  let html = "";
  for (let k of Object.keys(counts))
    html += `<div>${escapeHtml(k)}: <strong>${counts[k]}</strong></div>`;
  progressDiv.innerHTML +=
    html || '<div class="small muted">No local counts</div>';
}

// init UI state
(function init() {
  // if userId present in local storage, pre-fill and jump to dashboard
  if (userId) {
    document.getElementById("loginUserId").value = userId;
    document.getElementById("registerUserId").value = userId;
    document.getElementById("registerName").value = userName;
  }
  document.getElementById("loginPassword").value = "";
  document.getElementById("registerPassword").value = "";
  if (userId && userName) {
    // keep logged in locally (note: for real apps use better auth)
    openDashboard();
  } else {
    // Show login by default
    showLogin();
  }
  renderTasbihs();
  updateNetworkUI();

  // Mobile app initialization
  handleAppShortcut(); // Handle shortcuts from app icon

  // Hide install banner if already installed or dismissed recently
  const dismissedTime = localStorage.getItem("installDismissed");
  if (
    isPWAInstalled() ||
    (dismissedTime &&
      Date.now() - parseInt(dismissedTime) < 24 * 60 * 60 * 1000)
  ) {
    installBanner.style.display = "none";
  }

  // Add mobile-specific features
  if (isMobileDevice()) {
    document.body.classList.add("mobile-device");

    // Add viewport meta tag for better mobile experience
    const viewport = document.querySelector("meta[name=viewport]");
    if (viewport) {
      viewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
      );
    }
  }

  // Enhanced first-time user experience
  if (!localStorage.getItem("firstVisit")) {
    localStorage.setItem("firstVisit", "true");
    setTimeout(() => {
      if (isMobileDevice() && !isPWAInstalled()) {
        showMobileFeedback(
          "👋 Welcome! Install our app for the best experience"
        );
      } else if (isMobileDevice()) {
        showMobileFeedback("👋 Welcome back to Tasbih Counter!");
      }
    }, 1000);
  }

  // Show manual install button for users who haven't installed
  const manualInstallBtn = document.getElementById("manualInstallBtn");
  if (manualInstallBtn) {
    if (!isPWAInstalled()) {
      manualInstallBtn.style.display = "inline-flex";
    } else {
      manualInstallBtn.style.display = "none";
    }
  }

  // Show install modal for first-time mobile users after some interaction
  if (
    isMobileDevice() &&
    !isPWAInstalled() &&
    !localStorage.getItem("hasSeenInstallModal")
  ) {
    let interactionCount = parseInt(
      localStorage.getItem("interactionCount") || "0"
    );

    // Track user interactions for showing install prompt
    const trackInteraction = () => {
      interactionCount++;
      localStorage.setItem("interactionCount", interactionCount.toString());

      // Show modal after 3 interactions (taps/clicks)
      if (
        interactionCount >= 3 &&
        !localStorage.getItem("hasSeenInstallModal")
      ) {
        setTimeout(() => {
          showInstallModal();
        }, 2000);
      }
    };

    // Add interaction tracking to key elements
    document.addEventListener("click", trackInteraction, { once: false });
  }
})();

// Add event listener for User ID availability checking
document
  .getElementById("registerUserId")
  .addEventListener("input", function (e) {
    const userId = e.target.value.trim();
    if (userId.length > 0) {
      checkUserIdAvailability(userId);
    } else {
      // Clear any previous availability message
      document.getElementById("registerMsg").textContent = "";
    }
  });

// ===== MOBILE APP FEATURES =====

// PWA Install Prompt
let deferredPrompt;
const installBanner = document.getElementById("installBanner");
const installBtn = document.getElementById("installBtn");
const dismissInstallBtn = document.getElementById("dismissInstallBtn");

// Modal elements
const installModal = document.getElementById("installModal");
const modalInstallBtn = document.getElementById("modalInstallBtn");
const modalDismissBtn = document.getElementById("modalDismissBtn");
// New multi-placement install elements
const headerInstallBtn = document.getElementById("headerInstallBtn");
const inlineInstallHint = document.getElementById("inlineInstallHint");
const inlineInstallBtn = document.getElementById("inlineInstallBtn");
const inlineDismissBtn = document.getElementById("inlineDismissBtn");
const installFab = document.getElementById("installFab");
const manualInstallInstructions = document.getElementById(
  "manualInstallInstructions"
);

function updateInstallUI() {
  const installed = isPWAInstalled();
  const supported = !!deferredPrompt; // indicates beforeinstallprompt fired
  if (headerInstallBtn)
    headerInstallBtn.style.display =
      !installed && supported ? "inline-flex" : "none";
  if (installFab)
    installFab.style.display = !installed && supported ? "inline-flex" : "none";
  if (inlineInstallHint) {
    const dismissed = localStorage.getItem("inlineInstallDismissed") === "true";
    inlineInstallHint.style.display =
      !installed && supported && !dismissed ? "flex" : "none";
  }
  if (manualInstallInstructions) {
    // Show manual instructions if not installed and not supported (e.g., iOS Safari pre-prompt behavior)
    manualInstallInstructions.style.display =
      !installed && !supported ? "list-item" : "none";
  }
}

function attachInstallHandlers() {
  const trigger = async () => {
    await handleInstall();
    updateInstallUI();
  };
  if (headerInstallBtn) headerInstallBtn.onclick = trigger;
  if (inlineInstallBtn) inlineInstallBtn.onclick = trigger;
  if (installFab) installFab.onclick = trigger;
  if (inlineDismissBtn)
    inlineDismissBtn.onclick = () => {
      localStorage.setItem("inlineInstallDismissed", "true");
      updateInstallUI();
    };
}

attachInstallHandlers();

// Handle install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  console.log("PWA install prompt triggered");
  e.preventDefault();
  deferredPrompt = e;
  updateInstallUI();

  // Show install modal for first-time users, banner for returning users
  if (!isPWAInstalled()) {
    const hasSeenModal = localStorage.getItem("hasSeenInstallModal");

    if (!hasSeenModal) {
      // Show modal for first-time users
      setTimeout(() => {
        showInstallModal();
      }, 5000); // Show after 5 seconds for better UX
    } else {
      // Show banner for returning users (only on mobile)
      if (isMobileDevice()) {
        setTimeout(() => {
          showInstallBanner();
        }, 3000);
      }
    }
  }
});

// Show install banner
function showInstallBanner() {
  if (!isPWAInstalled() && isMobileDevice()) {
    installBanner.classList.add("show");
  }
}

// Show install modal
function showInstallModal() {
  if (!isPWAInstalled()) {
    installModal.classList.add("show");
    localStorage.setItem("hasSeenInstallModal", "true");
  }
}

// Handle banner install button click
installBtn.addEventListener("click", async () => {
  await handleInstall();
  installBanner.classList.remove("show");
});

// Handle modal install button click
modalInstallBtn.addEventListener("click", async () => {
  await handleInstall();
  installModal.classList.remove("show");
});

// Handle banner dismiss button
dismissInstallBtn.addEventListener("click", () => {
  installBanner.classList.remove("show");
  localStorage.setItem("installDismissed", Date.now().toString());
});

// Handle modal dismiss button
modalDismissBtn.addEventListener("click", () => {
  installModal.classList.remove("show");
  // Still show banner later for modal dismissers
  setTimeout(() => {
    if (!isPWAInstalled() && isMobileDevice()) {
      showInstallBanner();
    }
  }, 30000); // Show banner after 30 seconds
});

// Common install handler
async function handleInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    deferredPrompt = null;
    updateInstallUI();

    if (outcome === "accepted") {
      showMobileFeedback("🎉 App installed successfully!");
      localStorage.setItem("pwaInstalled", "true");

      // Show success message
      setTimeout(() => {
        showPopup(
          "Installation Complete!",
          "Tasbih Counter has been installed on your device. You can now access it from your home screen with offline support and quick actions.",
          [{ text: "Got it!", primary: true }]
        );
      }, 1000);
    } else {
      showMobileFeedback("Installation cancelled");
    }
  } else {
    // Fallback for manual install
    showMobileFeedback("Please use your browser's 'Add to Home Screen' option");
  }
}

// Check if PWA is already installed
function isPWAInstalled() {
  return (
    localStorage.getItem("pwaInstalled") === "true" ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

// Check if device is mobile
function isMobileDevice() {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth <= 768
  );
}

// Mobile gesture feedback
const mobileFeedback = document.getElementById("mobileFeedback");

function showMobileFeedback(message, duration = 1500) {
  mobileFeedback.textContent = message;
  mobileFeedback.classList.add("show");

  // Add haptic feedback if available
  if ("vibrate" in navigator) {
    navigator.vibrate(50);
  }

  setTimeout(() => {
    mobileFeedback.classList.remove("show");
  }, duration);
}

// Handle app shortcuts from manifest
function handleAppShortcut() {
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get("action");

  switch (action) {
    case "quick-dhikr":
      showMobileFeedback("🚀 Quick Dhikr Mode");
      setTimeout(() => {
        document.getElementById("newTasbih").focus();
      }, 500);
      break;
    case "view-progress":
      showMobileFeedback("📊 Viewing Progress");
      if (userId) {
        openDashboard();
      } else {
        showLogin();
      }
      break;
    case "sync-data":
      showMobileFeedback("🔄 Syncing Data");
      if (userId) {
        saveProgress();
      }
      break;
  }
}

// Touch gesture handling
let touchStartY = 0;
let touchStartX = 0;

document.addEventListener(
  "touchstart",
  (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  },
  { passive: true }
);

document.addEventListener(
  "touchend",
  (e) => {
    if (!touchStartY || !touchStartX) return;

    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaY = touchStartY - touchEndY;
    const deltaX = touchStartX - touchEndX;

    // Swipe down to refresh (pull to refresh)
    if (deltaY < -100 && Math.abs(deltaX) < 50) {
      showMobileFeedback("🔄 Refreshing...");
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }

    // Reset touch coordinates
    touchStartY = 0;
    touchStartX = 0;
  },
  { passive: true }
);

// Add haptic feedback to buttons on mobile
document.addEventListener("click", (e) => {
  if (isMobileDevice() && e.target.classList.contains("btn")) {
    if ("vibrate" in navigator) {
      navigator.vibrate(30);
    }
  }
});

// Handle visibility change for background sync
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && userId) {
    // App became visible, sync data if needed
    console.log("App visible, checking for data sync");
    loadProgress();
  }
});

// Handle online/offline status
window.addEventListener("online", () => {
  showMobileFeedback("🌐 Back online!");
  updateNetworkUI();
  if (userId) {
    saveProgress(); // Auto-sync when back online
  }
});

window.addEventListener("offline", () => {
  showMobileFeedback("📴 Offline mode");
  updateNetworkUI();
});

// ===== END MOBILE APP FEATURES =====

// PWA: register service worker (done in HTML bottom too)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .then((registration) => {
      console.log("SW registered successfully");

      // Handle service worker updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // New version available
            showPopup(
              "Update Available",
              "A new version of Tasbih Counter is available. Refresh to update.",
              [
                {
                  text: "Refresh",
                  primary: true,
                  action: () => window.location.reload(),
                },
                { text: "Later", action: () => {} },
              ]
            );
          }
        });
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SYNC_DATA") {
          console.log("Received sync message from SW:", event.data.message);
          loadProgress();
        }
      });
    })
    .catch((error) => console.log("SW registration failed:", error));
}

// Onboarding Flow
const onboardingOverlay = document.getElementById("onboardingOverlay");
const onboardingStep1 = document.getElementById("onboardingStep1");
const onboardingStep2 = document.getElementById("onboardingStep2");
const onboardingStep3 = document.getElementById("onboardingStep3");
const onboardingDots = document.querySelectorAll(".onboarding-dot");

let currentOnboardingStep = 1;

// Show onboarding for first-time users
function showOnboarding() {
  if (!localStorage.getItem("hasCompletedOnboarding")) {
    onboardingOverlay.style.display = "flex";
    updateOnboardingStep(1);
  }
}

// Update onboarding step display
function updateOnboardingStep(step) {
  currentOnboardingStep = step;

  // Hide all steps
  [onboardingStep1, onboardingStep2, onboardingStep3].forEach((stepEl) => {
    stepEl.classList.remove("active");
  });

  // Show current step
  document.getElementById(`onboardingStep${step}`).classList.add("active");

  // Update dots
  onboardingDots.forEach((dot, index) => {
    dot.classList.toggle("active", index + 1 === step);
  });
}

// Onboarding navigation
document.getElementById("onboardingNext1").addEventListener("click", () => {
  updateOnboardingStep(2);
});

document.getElementById("onboardingNext2").addEventListener("click", () => {
  updateOnboardingStep(3);
});

document.getElementById("onboardingBack1").addEventListener("click", () => {
  updateOnboardingStep(1);
});

document.getElementById("onboardingBack2").addEventListener("click", () => {
  updateOnboardingStep(2);
});

document.getElementById("onboardingSkip").addEventListener("click", () => {
  completeOnboarding();
});

document.getElementById("onboardingFinish").addEventListener("click", () => {
  completeOnboarding();
  // Show login/register after onboarding
  showLogin();
});

function completeOnboarding() {
  onboardingOverlay.style.display = "none";
  localStorage.setItem("hasCompletedOnboarding", "true");
}

// Confirmation Dialog
const confirmationOverlay = document.getElementById("confirmationOverlay");
const confirmationTitle = document.getElementById("confirmationTitle");
const confirmationMessage = document.getElementById("confirmationMessage");
const confirmationIcon = document.getElementById("confirmationIcon");

let currentConfirmationCallback = null;

// Show confirmation dialog
function showConfirmation(title, message, icon = "⚠️", callback = null) {
  confirmationTitle.textContent = title;
  confirmationMessage.textContent = message;
  confirmationIcon.textContent = icon;
  currentConfirmationCallback = callback;
  confirmationOverlay.style.display = "flex";
}

// Handle confirmation buttons
document.getElementById("confirmationConfirm").addEventListener("click", () => {
  confirmationOverlay.style.display = "none";
  if (currentConfirmationCallback) {
    currentConfirmationCallback(true);
  }
});

document.getElementById("confirmationCancel").addEventListener("click", () => {
  confirmationOverlay.style.display = "none";
  if (currentConfirmationCallback) {
    currentConfirmationCallback(false);
  }
});

// Enhanced user experience functions
function showLoadingSpinner(element, show = true) {
  if (show) {
    element.innerHTML =
      '<div class="loading-spinner"></div>' + element.innerHTML;
    element.disabled = true;
  } else {
    const spinner = element.querySelector(".loading-spinner");
    if (spinner) spinner.remove();
    element.disabled = false;
  }
}

function showTooltip(element, message, position = "top") {
  // Remove existing tooltip
  const existingTooltip = element.querySelector(".tooltip");
  if (existingTooltip) existingTooltip.remove();

  // Create tooltip
  const tooltip = document.createElement("div");
  tooltip.className = `tooltip tooltip-${position}`;
  tooltip.textContent = message;

  element.style.position = "relative";
  element.appendChild(tooltip);

  // Show tooltip
  setTimeout(() => tooltip.classList.add("show"), 100);

  // Hide tooltip after 3 seconds
  setTimeout(() => {
    tooltip.classList.remove("show");
    setTimeout(() => tooltip.remove(), 300);
  }, 3000);
}

// Add tooltips to important elements
function initializeTooltips() {
  // Add tooltips to buttons that might need explanation
  const helpElements = [
    {
      selector: "#installBtn",
      message: "Install the app for offline access and quick actions",
    },
    {
      selector: "#newTasbih",
      message: "Enter a name for your new tasbih counter",
    },
    { selector: "#saveBtn", message: "Save your progress to the cloud" },
    { selector: "#syncBtn", message: "Sync your data across devices" },
  ];

  helpElements.forEach(({ selector, message }) => {
    const element = document.querySelector(selector);
    if (element) {
      element.addEventListener("mouseenter", () =>
        showTooltip(element, message)
      );
      element.addEventListener("focus", () =>
        showTooltip(element, message, "bottom")
      );
    }
  });
}

// Add keyboard shortcuts for better UX
document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveProgress();
    showMobileFeedback("💾 Quick save triggered");
  }

  // Ctrl/Cmd + N for new tasbih
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    const newTasbihInput = document.getElementById("newTasbih");
    if (newTasbihInput) {
      newTasbihInput.focus();
      showMobileFeedback("📝 Ready to add new tasbih");
    }
  }

  // Escape to close modals
  if (e.key === "Escape") {
    [installModal, onboardingOverlay, confirmationOverlay].forEach((modal) => {
      if (modal && modal.style.display !== "none") {
        modal.style.display = "none";
      }
    });
  }
});

// Show contextual help for new users
function showContextualHelp() {
  const hasSeenHelp = localStorage.getItem("hasSeenContextualHelp");
  if (hasSeenHelp || userId) return; // Don't show if already seen or user is logged in

  setTimeout(() => {
    showTooltip(
      document.querySelector("#newTasbih") || document.body,
      "💡 Tip: Start by creating your first tasbih counter above!",
      "bottom"
    );
  }, 3000);

  localStorage.setItem("hasSeenContextualHelp", "true");
}

// Enhanced error handling with user-friendly messages
function handleError(error, context = "operation") {
  console.error(`Error in ${context}:`, error);

  let message = "Something went wrong. Please try again.";
  let icon = "❌";

  if (error.message?.includes("network") || error.message?.includes("fetch")) {
    message = "Connection problem. Check your internet and try again.";
    icon = "📡";
  } else if (
    error.message?.includes("auth") ||
    error.message?.includes("login")
  ) {
    message = "Authentication issue. Please log in again.";
    icon = "🔐";
  } else if (
    error.message?.includes("quota") ||
    error.message?.includes("storage")
  ) {
    message = "Storage full. Try clearing some old data.";
    icon = "💾";
  }

  showMobileFeedback(`${icon} ${message}`);
}

// Auto-save feature for better UX
let autoSaveTimeout;
function scheduleAutoSave() {
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    if (userId && navigator.onLine && Object.keys(counts).length > 0) {
      saveProgress();
    }
  }, 30000); // Auto-save after 30 seconds of inactivity
}

// Track user interactions for auto-save
document.addEventListener("click", scheduleAutoSave);
document.addEventListener("input", scheduleAutoSave);
document.addEventListener("change", scheduleAutoSave);

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  handleAppShortcut();
  initializeTooltips();
  showContextualHelp();

  // Show onboarding for first-time users after a brief delay
  setTimeout(() => {
    if (!userId && !localStorage.getItem("hasCompletedOnboarding")) {
      showOnboarding();
    }
  }, 2000);
});

// ===================== Analytics & Charts ===================== //
const ACTIVITY_KEY = "tasbih_activity_log_v1";
let dhikrChart = null;
let pendingChartUpdate = null;

function logDhikrActivity(name, delta) {
  try {
    const now = Date.now();
    const entry = { t: now, n: name, d: delta };
    const raw = localStorage.getItem(ACTIVITY_KEY);
    let arr = [];
    if (raw) {
      arr = JSON.parse(raw);
      // prune > 4000 entries to keep storage sane
      if (arr.length > 4000) arr = arr.slice(arr.length - 4000);
    }
    arr.push(entry);
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn("Activity log write failed", e);
  }
}

function getActivityData() {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function aggregateDay(data) {
  // last 7 days (including today) grouped by date
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      total: 0,
    });
  }
  const index = Object.fromEntries(days.map((d, i) => [d.key, i]));
  data.forEach((e) => {
    const dayKey = new Date(e.t).toISOString().slice(0, 10);
    if (index[dayKey] !== undefined) days[index[dayKey]].total += e.d;
  });
  return {
    labels: days.map((d) => d.label),
    values: days.map((d) => d.total),
  };
}

function aggregateMonth(data) {
  // last 30 days daily totals
  const now = new Date();
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: d.getDate().toString(), total: 0 });
  }
  const index = Object.fromEntries(days.map((d, i) => [d.key, i]));
  data.forEach((e) => {
    const dayKey = new Date(e.t).toISOString().slice(0, 10);
    if (index[dayKey] !== undefined) days[index[dayKey]].total += e.d;
  });
  return { labels: days.map((d) => d.label), values: days.map((d) => d.total) };
}

function aggregateYear(data) {
  // current year months
  const now = new Date();
  const year = now.getFullYear();
  const months = Array.from({ length: 12 }, (_, m) => ({ m, total: 0 }));
  data.forEach((e) => {
    const dt = new Date(e.t);
    if (dt.getFullYear() === year) months[dt.getMonth()].total += e.d;
  });
  return {
    labels: months.map((m) =>
      new Date(year, m.m, 1).toLocaleString(undefined, { month: "short" })
    ),
    values: months.map((m) => m.total),
  };
}

function ensureChart(range = "day") {
  const card = document.getElementById("chartsCard");
  if (!card) return;
  card.style.display = "block";
  const ctx = document.getElementById("dhikrChart").getContext("2d");
  const dataset = buildDataset(range);
  const emptyEl = document.getElementById("chartEmpty");
  const hasData = dataset.values.some((v) => v > 0);
  emptyEl.style.display = hasData ? "none" : "block";
  if (dhikrChart) {
    dhikrChart.data.labels = dataset.labels;
    dhikrChart.data.datasets[0].data = dataset.values;
    dhikrChart.options.plugins.title.text = dataset.title;
    dhikrChart.update();
    return;
  }
  dhikrChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dataset.labels,
      datasets: [
        {
          label: "Counts",
          data: dataset.values,
          fill: true,
          tension: 0.35,
          borderColor: getComputedStyle(document.documentElement)
            .getPropertyValue("--primary")
            .trim(),
          backgroundColor:
            getComputedStyle(document.documentElement)
              .getPropertyValue("--primary")
              .trim() + "22",
          pointRadius: 4,
          pointBackgroundColor: "#fff",
          pointBorderColor: getComputedStyle(document.documentElement)
            .getPropertyValue("--primary")
            .trim(),
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: dataset.title,
          padding: { top: 4, bottom: 8 },
        },
        tooltip: { mode: "index", intersect: false },
      },
      interaction: { mode: "nearest", intersect: false },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.08)" } },
        x: { grid: { display: false } },
      },
    },
  });
}

function buildDataset(range) {
  const data = getActivityData();
  if (range === "day") {
    const agg = aggregateDay(data);
    return { labels: agg.labels, values: agg.values, title: "Last 7 Days" };
  } else if (range === "month") {
    const agg = aggregateMonth(data);
    return { labels: agg.labels, values: agg.values, title: "Last 30 Days" };
  } else {
    const agg = aggregateYear(data);
    return { labels: agg.labels, values: agg.values, title: "This Year" };
  }
}

function scheduleChartUpdate(range) {
  if (pendingChartUpdate) cancelAnimationFrame(pendingChartUpdate);
  pendingChartUpdate = requestAnimationFrame(() =>
    ensureChart(currentChartRange)
  );
}

let currentChartRange = "day";

document.addEventListener("DOMContentLoaded", () => {
  // Tab handling
  document.querySelectorAll(".chart-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".chart-tab").forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      currentChartRange = tab.dataset.range;
      ensureChart(currentChartRange);
    });
  });
  // Initial render if any prior activity
  if (getActivityData().length) {
    ensureChart("day");
  }
  // Initialize password toggles
  initPasswordToggles();
});

function initPasswordToggles() {
  const toggles = document.querySelectorAll(".password-toggle");
  toggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password"
      );
      btn.setAttribute("data-state", isHidden ? "visible" : "hidden");
      const eye = btn.querySelector(".icon-eye");
      const eyeOff = btn.querySelector(".icon-eye-off");
      if (eye && eyeOff) {
        if (isHidden) {
          eye.style.display = "none";
          eyeOff.style.display = "block";
        } else {
          eye.style.display = "block";
          eyeOff.style.display = "none";
        }
      }
    });
  });
}
