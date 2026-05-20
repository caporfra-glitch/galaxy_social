import { clearToken, getProfile, updateProfile } from "./api.js";

const statsEl = document.getElementById("profile-stats");
const form = document.getElementById("profile-form");
const statusEl = document.getElementById("profile-status");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#ff799a" : "#9aa8d4";
}

function renderStats(stats = {}) {
  statsEl.innerHTML = `
    <div class="stat-box"><span>Stelle create</span><strong>${stats.stars_created || 0}</strong></div>
    <div class="stat-box"><span>Pianeti caricati</span><strong>${stats.planets_uploaded || 0}</strong></div>
    <div class="stat-box"><span>Like ricevuti</span><strong>${stats.likes_received || 0}</strong></div>
  `;
}

async function load() {
  try {
    const data = await getProfile();
    renderStats(data.stats);
    form.username.value = data.profile?.username || "";
    form.avatar_url.value = data.profile?.avatar_url || "";
    form.bio.value = data.profile?.bio || "";
  } catch (_) {
    clearToken();
    window.location.href = "/index.html";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Salvataggio...");
  try {
    const formData = new FormData(form);
    await updateProfile({
      username: String(formData.get("username") || "").trim(),
      avatar_url: String(formData.get("avatar_url") || "").trim(),
      bio: String(formData.get("bio") || "").trim(),
    });
    setStatus("Profilo aggiornato");
    await load();
  } catch (err) {
    setStatus(err.message, true);
  }
});

load();
