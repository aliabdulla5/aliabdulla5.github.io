import { setupAuthMonitoring, handleLogin, logout } from './modules/authManager.js';
import { initProfile } from './modules/profileApp.js';

function initApp() {
  const isLoginPage = location.pathname.includes("index.html") || 
                      location.pathname.endsWith("/") || 
                      location.pathname === "";
  const isProfilePage = location.pathname.includes("profile");

  if (isLoginPage) {
    initLoginPage();
  } else if (isProfilePage) {
    initProfilePage();
  }
}

function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const errorEl = document.getElementById("error");
    const submitBtn = form.querySelector('button[type="submit"]');
    
    if (errorEl) errorEl.textContent = "";
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Loading...";
    }

    try {
      const identifier = document.getElementById("identifier").value.trim();
      const password = document.getElementById("password").value;
      
      await handleLogin(identifier, password);
      location.replace("profile.html");
      
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message || "Login failed";
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Start Game";
      }
    }
  });
}

function initProfilePage() {
  setupAuthMonitoring();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initProfile();
    });
  } else {
    initProfile();
  }

  if (typeof window !== 'undefined') {
    window.logout = logout;
  }
}

initApp();
