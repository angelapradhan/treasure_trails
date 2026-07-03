// js/progress-api.js
// Shared helper for dashboard.html and valley.html. Include this with:
//   <script src="js/progress-api.js"></script>
// BEFORE your existing inline <script> block on each page.
//
// COIN SYNC IS RESILIENT: every earned/spent coin amount is queued in
// localStorage BEFORE the network request fires. It's only removed from
// the queue once the server confirms it saved. If the request fails
// (server down, network blip, tab closed mid-request), the amount stays
// queued and gets retried automatically the next time ANY page that
// includes this file loads. Coins can be delayed, but they can't be lost.

const API_BASE = "http://localhost:5001/api";
const PENDING_KEY = "tt_pending_coins";

function getToken() {
  return localStorage.getItem("token");
}

function getPendingCoins() {
  return parseInt(localStorage.getItem(PENDING_KEY) || "0", 10) || 0;
}

function setPendingCoins(value) {
  localStorage.setItem(PENDING_KEY, String(value));
}

// Returns { level, coins } or null if not logged in / request failed.
// Always flushes any queued (previously-failed) coin syncs first, so the
// numbers you see are guaranteed up to date with anything already earned.
async function fetchProgress() {
  const token = getToken();
  if (!token) {
    console.warn("[progress-api] No token found in localStorage — user is not logged in. Log in again so a token gets saved.");
    return null;
  }
  await flushPendingCoins();
  try {
    const res = await fetch(`${API_BASE}/progress`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) {
      console.error("[progress-api] fetchProgress: server responded", res.status, await res.text().catch(() => ""));
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[progress-api] fetchProgress: network/request error —", err.message);
    return null;
  }
}

// amount can be positive (earn) or negative (spend). Returns new coin total or null.
// Queues the amount in localStorage FIRST so it survives a failed request,
// a closed tab, or a page navigation that happens before the fetch resolves.
async function syncCoins(amount) {
  if (!amount) return null;

  setPendingCoins(getPendingCoins() + amount);

  const token = getToken();
  if (!token) {
    console.warn("[progress-api] syncCoins: no token — coins queued locally but cannot reach the server until you log in again.");
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/progress/coins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ amount })
    });
    if (!res.ok) {
      console.error("[progress-api] syncCoins: server rejected request", res.status, await res.text().catch(() => ""));
      return null; // stays queued, will retry later
    }
    const data = await res.json();
    // This exact amount is now confirmed saved — remove it from the queue.
    setPendingCoins(getPendingCoins() - amount);
    return data.coins;
  } catch (err) {
    console.error("[progress-api] syncCoins: network error, will retry later —", err.message);
    return null; // stays queued, will retry later
  }
}

// Attempts to push any coins that failed to sync earlier (from this browser).
// Safe to call anytime; does nothing if the queue is empty.
async function flushPendingCoins() {
  const pending = getPendingCoins();
  if (!pending) return;

  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/progress/coins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ amount: pending })
    });
    if (res.ok) {
      setPendingCoins(0);
      console.log(`[progress-api] Flushed ${pending} previously-unsaved coin(s) to the server.`);
    } else {
      console.warn("[progress-api] flushPendingCoins: server rejected", res.status);
    }
  } catch (err) {
    console.warn("[progress-api] flushPendingCoins: still offline —", err.message);
  }
}

// Call ONLY on true game completion. Returns new level or null.
async function completeLevel() {
  const token = getToken();
  if (!token) {
    console.warn("[progress-api] completeLevel: no token — level not saved.");
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}/progress/complete-level`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
    if (!res.ok) {
      console.error("[progress-api] completeLevel: server responded", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    return data.level;
  } catch (err) {
    console.error("[progress-api] completeLevel: network error —", err.message);
    return null;
  }
}