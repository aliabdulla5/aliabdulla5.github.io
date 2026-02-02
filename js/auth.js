/**
 * Authentication Module
 * Handles login, logout, and session management
 */

const DOMAIN = "https://learn.reboot01.com";
const TOKEN_KEY = "jwt";

/**
 * Validate JWT token expiration and structure
 * Returns true if token is valid and not expired
 */
function isTokenValid() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return false;
  
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration (exp is in seconds, Date.now() is in milliseconds)
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return false; // Token expired
    }
    
    return true;
  } catch (e) {
    return false; // Malformed token
  }
}

/**
 * Clear invalid auth state and redirect to login
 */
function clearAuthAndRedirect() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("lastArea");
  location.replace("index.html"); // Replace history to prevent back button loop
}

// Validate token before loading protected pages
if (location.pathname.includes("profile")) {
  if (!isTokenValid()) {
    clearAuthAndRedirect();
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
      // Replace history so back button doesn't return to login
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

/**
 * Log out the current user
 */
function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("lastArea");
  location.href = "index.html";
}
