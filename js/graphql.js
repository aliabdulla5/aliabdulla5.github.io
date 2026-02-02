/**
 * GraphQL Client Module
 * Handles all GraphQL API requests
 */

const GRAPHQL_ENDPOINT = "https://learn.reboot01.com/api/graphql-engine/v1/graphql";

/**
 * Execute a GraphQL query
 * @param {string} query - The GraphQL query string
 * @param {object} variables - Query variables (optional)
 * @returns {Promise<object>} - The response data
 */
async function graphqlRequest(query, variables = {}) {
  const token = localStorage.getItem("jwt");

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });

  // Parse response
  let data;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(response.ok ? "Invalid JSON response" : `Network error: ${response.status}`);
  }

  // Handle HTTP errors
  if (!response.ok) {
    // Token expired or invalid - clear auth and redirect to login
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("jwt");
      localStorage.removeItem("lastArea");
      location.replace("index.html");
      throw new Error("Session expired. Please login again.");
    }
    
    const message = data?.errors?.map(e => e.message).join("; ") || `HTTP ${response.status}`;
    throw new Error(message);
  }

  // Handle GraphQL errors (check for auth-related errors)
  if (data?.errors?.length) {
    const authError = data.errors.some(e => 
      e.message?.toLowerCase().includes("denied") ||
      e.message?.toLowerCase().includes("unauthorized") ||
      e.message?.toLowerCase().includes("invalid") ||
      e.extensions?.code === "invalid-jwt"
    );
    
    if (authError) {
      localStorage.removeItem("jwt");
      localStorage.removeItem("lastArea");
      location.replace("index.html");
    }
    
    throw new Error(data.errors.map(e => e.message).join("; "));
  }

  return data;
}
