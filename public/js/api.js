const tokenKey = "galaxy_token";

export function getToken() {
  return localStorage.getItem(tokenKey);
}

export function setToken(token) {
  if (token) localStorage.setItem(tokenKey, token);
}

export function clearToken() {
  localStorage.removeItem(tokenKey);
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Errore API");
  }
  return data;
}

export async function register(payload) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendMagicLink(email) {
  return request("/api/auth/magic-link", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
export async function exchangeAuthCode(code) {
  return request("/api/auth/exchange", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getGoogleAuthUrl() {
  return request("/api/auth/google");
}

export async function getStars(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/stars${query ? `?${query}` : ""}`);
}

export async function createStar(payload) {
  return request("/api/stars", { method: "POST", body: JSON.stringify(payload) });
}

export async function getPlanets(star_id) {
  return request(`/api/planets?star_id=${encodeURIComponent(star_id)}`);
}

export async function createPlanet(formData) {
  return request("/api/planets", { method: "POST", body: formData });
}

export async function getMoons(planet_id) {
  return request(`/api/moons?planet_id=${encodeURIComponent(planet_id)}`);
}

export async function createMoon(payload) {
  return request("/api/moons", { method: "POST", body: JSON.stringify(payload) });
}

export async function likePlanet(planet_id) {
  return request("/api/likes", { method: "POST", body: JSON.stringify({ planet_id }) });
}

export async function unlikePlanet(planet_id) {
  return request("/api/likes", { method: "DELETE", body: JSON.stringify({ planet_id }) });
}

export async function getProfile() {
  return request("/api/user/profile");
}

export async function updateProfile(payload) {
  return request("/api/user/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
