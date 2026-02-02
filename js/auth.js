/**
 * Authentication Module
 * Handles login, logout, and session management
 */

const DOMAIN = "https://learn.reboot01.com";
const TOKEN_KEY = "jwt";

// Redirect to login if not authenticated on profile page
if (location.pathname.includes("profile")) {
  if (!localStorage.getItem(TOKEN_KEY)) {
    location.href = "index.html";
  }
}

// Login form handler
const form = document.getElementById("loginForm");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const errorEl = document.getElementById("error");
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Clear previous errors
    if (errorEl) errorEl.textContent = "";
    
    // Disable button during login
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Loading...";
    }

    try {
      const identifier = document.getElementById("identifier").value.trim();
      const password = document.getElementById("password").value;
      const credentials = btoa(`${identifier}:${password}`);

      const res = await fetch(`${DOMAIN}/api/auth/signin`, {
        method: "POST",
        headers: { "Authorization": `Basic ${credentials}` }
      });

      if (!res.ok) {
        throw new Error("Invalid credentials. Please try again.");
      }

      const data = await res.json();
      const tokenValue = data.token || data.jwt || data.accessToken || data;
      localStorage.setItem(TOKEN_KEY, tokenValue);
      location.href = "profile.html";
      
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

/**
 * Log out the current user
 */
function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("lastArea");
  location.href = "index.html";
}
