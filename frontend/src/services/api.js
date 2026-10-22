const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

async function request(path, {
  method = "GET",
  body,
  csrfToken,
  headers,
} = {}) {
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      credentials: "include",
      method,
      ...(body ? { body } : {}),
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...headers,
      },
    });
  } catch {
    throw new Error("The server could not be reached. Check your connection and try again.");
  }
  if (response.status === 204) return {};
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
  return result;
}

export async function getHealth(signal) {
  const response = await fetch(`${apiUrl}/api/health`, { signal });
  const result = await response.json();
  return { ok: response.ok, ...result };
}

export function getCurrentSession() {
  return request("/api/auth/session");
}

export function register(credentials) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function login(credentials) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function logout(csrfToken) {
  return request("/api/auth/logout", {
    method: "POST",
    csrfToken,
  });
}
