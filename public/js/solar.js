import { getMoons, createMoon, likePlanet, unlikePlanet } from "./api.js";

export function initPlanetModal({ renderer }) {
  const modal = document.getElementById("planet-modal");
  const closeBtn = document.getElementById("close-planet-modal");
  const videoEl = document.getElementById("planet-video");
  const titleEl = document.getElementById("planet-title");
  const descriptionEl = document.getElementById("planet-description");
  const likeBtn = document.getElementById("like-btn");
  const likeCountEl = document.getElementById("like-count");
  const moonCountEl = document.getElementById("moon-count");
  const moonForm = document.getElementById("moon-form");
  const moonsList = document.getElementById("moons-list");

  let currentPlanet = null;

  function renderMoons(moons) {
    moonsList.innerHTML = "";
    if (!moons.length) {
      moonsList.innerHTML = `<p class="status-text">Nessuna luna ancora. Sii il primo a commentare.</p>`;
      return;
    }
    for (const moon of moons) {
      const div = document.createElement("div");
      div.className = "moon-item";
      const username = moon.profile?.username || "utente";
      div.innerHTML = `<strong>@${username}</strong><p>${moon.content}</p><small>${new Date(moon.created_at).toLocaleString()}</small>`;
      moonsList.appendChild(div);
    }
  }

  async function refreshMoons() {
    if (!currentPlanet) return;
    const moons = await getMoons(currentPlanet.id);
    renderMoons(moons);
    moonCountEl.textContent = `${moons.length} lune`;
  }

  function makeHearts() {
    for (let i = 0; i < 6; i += 1) {
      const heart = document.createElement("span");
      heart.textContent = "💖";
      heart.style.position = "fixed";
      heart.style.left = `${Math.random() * 80 + 10}%`;
      heart.style.top = "70%";
      heart.style.pointerEvents = "none";
      heart.style.zIndex = "9999";
      heart.style.transition = "all .9s ease";
      document.body.appendChild(heart);
      requestAnimationFrame(() => {
        heart.style.top = `${Math.random() * 25 + 20}%`;
        heart.style.opacity = "0";
      });
      setTimeout(() => heart.remove(), 900);
    }
  }

  async function onLikeClick() {
    if (!currentPlanet) return;
    if (currentPlanet.has_liked) {
      await unlikePlanet(currentPlanet.id);
      currentPlanet.has_liked = false;
      currentPlanet.like_count = Math.max(0, (currentPlanet.like_count || 0) - 1);
    } else {
      await likePlanet(currentPlanet.id);
      currentPlanet.has_liked = true;
      currentPlanet.like_count = (currentPlanet.like_count || 0) + 1;
      makeHearts();
    }
    likeBtn.textContent = currentPlanet.has_liked ? "💔 Unlike" : "❤️ Like";
    likeCountEl.textContent = `${currentPlanet.like_count} like`;
    renderer.updatePlanetStats(currentPlanet.id, {
      like_count: currentPlanet.like_count,
      has_liked: currentPlanet.has_liked,
    });
  }

  likeBtn.addEventListener("click", onLikeClick);
  closeBtn.addEventListener("click", () => modal.close());

  moonForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentPlanet) return;
    const form = new FormData(moonForm);
    const content = String(form.get("content") || "").trim();
    if (!content) return;
    await createMoon({ planet_id: currentPlanet.id, content });
    moonForm.reset();
    currentPlanet.moon_count = (currentPlanet.moon_count || 0) + 1;
    renderer.updatePlanetStats(currentPlanet.id, { moon_count: currentPlanet.moon_count });
    await refreshMoons();
  });

  return async function openPlanetModal(planet) {
    currentPlanet = { ...planet };
    titleEl.textContent = planet.title;
    descriptionEl.textContent = planet.description || "";
    likeCountEl.textContent = `${planet.like_count || 0} like`;
    moonCountEl.textContent = `${planet.moon_count || 0} lune`;
    likeBtn.textContent = planet.has_liked ? "💔 Unlike" : "❤️ Like";
    videoEl.src = planet.video_url;
    modal.showModal();
    await refreshMoons();
  };
}
