import {
  login,
  register,
  setToken,
  clearToken,
  sendMagicLink,
  getGoogleAuthUrl,
  exchangeAuthCode,
} from "./api.js";

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const messageEl = document.getElementById("auth-message");
const googleBtn = document.getElementById("google-login");
const magicBtn = document.getElementById("magic-link");

function setMessage(msg, isError = false) {
  if (!messageEl) return;
  messageEl.textContent = msg;
  messageEl.style.color = isError ? "#ff799a" : "#9aa8d4";
}

function switchTab(mode) {
  if (mode === "login") {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
  } else {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    tabLogin.classList.remove("active");
    tabRegister.classList.add("active");
  }
}

tabLogin?.addEventListener("click", () => switchTab("login"));
tabRegister?.addEventListener("click", () => switchTab("register"));

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(loginForm);
  try {
    const data = await login({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!data.session?.access_token) {
      setMessage("Login ok ma sessione non disponibile. Verifica email.");
      return;
    }
    setToken(data.session.access_token);
    window.location.href = "/app";
  } catch (err) {
    setMessage(err.message, true);
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(registerForm);
  try {
    const data = await register({
      email: form.get("email"),
      username: form.get("username"),
      password: form.get("password"),
    });
    if (data.session?.access_token) {
      setToken(data.session.access_token);
      window.location.href = "/app";
      return;
    }
    setMessage("Registrazione completata. Controlla email per conferma.");
  } catch (err) {
    setMessage(err.message, true);
  }
});

googleBtn?.addEventListener("click", async () => {
  try {
    const data = await getGoogleAuthUrl();
    if (data.url) window.location.href = data.url;
  } catch (err) {
    setMessage(err.message, true);
  }
});

magicBtn?.addEventListener("click", async () => {
  const email = loginForm?.querySelector("input[name='email']")?.value;
  if (!email) {
    setMessage("Inserisci email nel form login prima di inviare magic link", true);
    return;
  }
  try {
    await sendMagicLink(email);
    setMessage("Magic link inviato. Controlla la tua email.");
  } catch (err) {
    setMessage(err.message, true);
  }
});

const hash = window.location.hash;
if (hash.includes("access_token=")) {
  const params = new URLSearchParams(hash.replace("#", ""));
  const token = params.get("access_token");
  if (token) {
    clearToken();
    setToken(token);
    window.location.href = "/app";
  }
}
(async () => {
  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");
  if (!code) return;
  try {
    const data = await exchangeAuthCode(code);
    if (data.session?.access_token) {
      clearToken();
      setToken(data.session.access_token);
      window.history.replaceState({}, "", "/index.html");
      window.location.href = "/app";
      return;
    }
    setMessage("Conferma completata, ma sessione non disponibile. Esegui login.");
  } catch (err) {
    setMessage(`Errore conferma email: ${err.message}`, true);
  }
})();
