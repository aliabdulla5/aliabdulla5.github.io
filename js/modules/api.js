import { TOKEN_KEY } from './authManager.js';

const GRAPHQL_ENDPOINT = "https://learn.reboot01.com/api/graphql-engine/v1/graphql";

export async function graphqlRequest(query, variables = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });

  let data;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(response.ok ? "Invalid JSON response" : `Network error: ${response.status}`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("lastArea");
      location.replace("index.html");
      throw new Error("Session expired. Please login again.");
    }
    
    const message = data?.errors?.map(e => e.message).join("; ") || `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (data?.errors?.length) {
    const authError = data.errors.some(e => 
      e.message?.toLowerCase().includes("denied") ||
      e.message?.toLowerCase().includes("unauthorized") ||
      e.message?.toLowerCase().includes("invalid") ||
      e.extensions?.code === "invalid-jwt"
    );
    
    if (authError) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("lastArea");
      location.replace("index.html");
    }
    
    throw new Error(data.errors.map(e => e.message).join("; "));
  }

  return data;
}

export async function getUserIdFromAPI() {
  try {
    const res = await graphqlRequest(`{ user { id } }`);
    const user = Array.isArray(res.data.user) ? res.data.user[0] : res.data.user;
    return user?.id ? Number(user.id) : null;
  } catch (e) {
    return null;
  }
}

export async function fetchUserData(uid) {
  const query = `query($uid: Int!) {
    user(where: { id: { _eq: $uid } }) {
      id login firstName lastName email attrs auditRatio totalUp totalDown
    }
  }`;
  const res = await graphqlRequest(query, { uid });
  return Array.isArray(res.data.user) ? res.data.user[0] : res.data.user;
}

export async function fetchXPTransactions(uid) {
  const query = `query($uid: Int!) {
    transaction(where: { userId: { _eq: $uid }, type: { _eq: "xp" } }, order_by: { createdAt: asc }) {
      amount createdAt path
    }
  }`;
  const res = await graphqlRequest(query, { uid });
  const transactions = res.data?.transaction || [];
  
  return transactions.filter(t => {
    const path = (t.path || "").toLowerCase();
    const piscineIdx = path.indexOf("piscine");
    if (piscineIdx === -1) return true;
    return path.indexOf("/", piscineIdx + 7) === -1;
  });
}

export async function fetchLevelTransactions(uid) {
  const query = `query($uid: Int!) {
    transaction(where: { userId: { _eq: $uid }, type: { _eq: "level" } }, order_by: { createdAt: asc }) {
      amount createdAt
    }
  }`;
  const res = await graphqlRequest(query, { uid });
  return res.data?.transaction || [];
}

export async function fetchProgresses(uid) {
  const query = `query($uid: Int!) {
    progress(where: { userId: { _eq: $uid } }) {
      grade createdAt path objectId
    }
  }`;
  const res = await graphqlRequest(query, { uid });
  return res.data?.progress || [];
}

export async function fetchSkillTransactions(uid) {
  const query = `query($uid: Int!) {
    transaction(where: { userId: { _eq: $uid }, type: { _like: "skill_%" } }) {
      type amount createdAt path
    }
  }`;
  const res = await graphqlRequest(query, { uid });
  return res.data?.transaction || [];
}
