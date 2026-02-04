export const DOMAIN = "https://learn.reboot01.com";
export const TOKEN_KEY = "jwt";

export function isTokenValid() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return false;
  
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

export function clearAuthAndRedirect() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("lastArea");
  location.replace("index.html");
}

export function enforceAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    location.replace("index.html");
    return false;
  }
  
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid token");
    
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearAuthAndRedirect();
      return false;
    }
  } catch (e) {
    clearAuthAndRedirect();
    return false;
  }
  
  return true;
}

export function getUserIdFromToken() {
  const token = localStorage.getItem(TOKEN_KEY);
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
  location.replace("index.html");
}

export function setupAuthMonitoring() {
  if (!location.pathname.includes("profile")) return;
  
  if (!isTokenValid()) {
    clearAuthAndRedirect();
    throw new Error("Unauthorized");
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted && !isTokenValid()) {
      clearAuthAndRedirect();
    }
  });
  
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !isTokenValid()) {
      clearAuthAndRedirect();
    }
  });
}
