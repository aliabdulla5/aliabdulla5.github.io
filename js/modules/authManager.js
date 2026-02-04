export const DOMAIN = "https://learn.reboot01.com";
export const TOKEN_KEY = "jwt";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }
    
    return true;
  } catch (e) {
    localStorage.removeItem(TOKEN_KEY);
    return false;
  }
}

export function clearAuthAndRedirect() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("lastArea");
  sessionStorage.clear();
  location.replace("index.html");
}

export function enforceAuth() {
  if (!isAuthenticated()) {
    clearAuthAndRedirect();
    return false;
  }
  return true;
}

export function getUserIdFromToken() {
  const token = getToken();
  if (!token) return null;
  
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1]));
      const id = payload.sub 
        || payload["https://hasura.io/jwt/claims"]?.["x-hasura-user-id"]
        || payload.user_id 
        || payload.id;
      if (id) return Number(id);
    }
  } catch (e) {
    return null;
  }
  
  return null;
}

export async function handleLogin(identifier, password) {
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
  
  return tokenValue;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("lastArea");
  sessionStorage.clear();
  location.replace("index.html");
}

export function setupAuthMonitoring() {
  const isLoginPage = location.pathname.includes("index.html") || 
                      location.pathname.endsWith("/") || 
                      location.pathname === "";
  const isProfilePage = location.pathname.includes("profile");
  
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      if (isProfilePage && !isAuthenticated()) {
        clearAuthAndRedirect();
      } else if (isLoginPage && isAuthenticated()) {
        location.replace("profile.html");
      }
    }
  });
  
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      if (isProfilePage && !isAuthenticated()) {
        clearAuthAndRedirect();
      } else if (isLoginPage && isAuthenticated()) {
        location.replace("profile.html");
      }
    }
  });
}
