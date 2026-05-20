import {
  clearToken,
  getStars,
  createStar,
  getPlanets,
  getProfile,
} from "./api.js";
import { GalaxyRenderer } from "./universe.js";
import { initPlanetModal } from "./solar.js";
import { initUploadDialog } from "./upload.js";

const logoutBtn = document.getElementById("logout-btn");
const createStarBtn = document.getElementById("create-star-btn");
const backBtn = document.getElementById("back-to-universe");
const searchInput = document.getElementById("star-search");
const suggestions = document.getElementById("search-suggestions");

let starsCache = [];
let currentStar = null;

async function ensureAuth() {
  try {
    await getProfile();
  } catch (_) {
    clearToken();
    window.location.href = "/index.html";
  }
}

const renderer = new GalaxyRenderer(document.getElementById("universe-canvas"), {
  onStarClick: async (star) => {
    currentStar = star;
    backBtn.classList.remove("hidden");
    uploadController.showButton(true);
    uploadController.setStar(star.id);
    await loadSolar(star.id);
  },
  onPlanetClick: async (planet) => {
    await openPlanetModal(planet);
  },
});

const openPlanetModal = initPlanetModal({ renderer });
const uploadController = initUploadDialog({
  onUploaded: async () => {
    if (currentStar) await loadSolar(currentStar.id);
  },
});

async function loadUniverse(params = {}) {
  const data = await getStars({ page: 1, limit: 300, ...params });
  starsCache = data.items || [];
  renderer.setUniverse(starsCache);
}

async function loadSolar(starId) {
  const planets = await getPlanets(starId);
  const star = starsCache.find((s) => s.id === starId) || currentStar;
  renderer.setSolar(star, planets);
}

logoutBtn.addEventListener("click", () => {
  clearToken();
  window.location.href = "/index.html";
});

backBtn.addEventListener("click", async () => {
  backBtn.classList.add("hidden");
  uploadController.showButton(false);
  currentStar = null;
  await loadUniverse();
});

createStarBtn.addEventListener("click", async () => {
  const name = window.prompt("Nome nuova stella/topic (#design #food ...):");
  if (!name) return;
  const color = `hsl(${Math.floor(Math.random() * 360)} 100% 70%)`;
  try {
    await createStar({ name, color });
    await loadUniverse();
  } catch (err) {
    window.alert(`Errore creazione stella: ${err.message}`);
  }
});

let searchTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (!q) {
    suggestions.innerHTML = "";
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const data = await getStars({ q, page: 1, limit: 8 });
      suggestions.innerHTML = "";
      for (const star of data.items) {
        const item = document.createElement("div");
        item.className = "suggestion-item";
        item.textContent = `${star.name} (🪐 ${star.planet_count})`;
        item.addEventListener("click", () => {
          renderer.focusOnStar(star);
          suggestions.innerHTML = "";
        });
        suggestions.appendChild(item);
      }
    } catch (_) {
      suggestions.innerHTML = "";
    }
  }, 180);
});

document.addEventListener("click", (e) => {
  if (!suggestions.contains(e.target) && e.target !== searchInput) {
    suggestions.innerHTML = "";
  }
});

(async function init() {
  await ensureAuth();
  uploadController.showButton(false);
  await loadUniverse();
})();
