import {
  csrfTokenMatches,
  getSession,
  tokenFromCookieHeader,
} from "../services/auth.service.js";

export async function requireSession(request, response, next) {
  try {
    const token = tokenFromCookieHeader(request.headers.cookie);
    const session = await getSession(token);
    if (!session) {
      response.status(401).json({ error: "Authentication required.", code: "UNAUTHENTICATED" });
      return;
    }
    request.auth = session;
    next();
  } catch (error) {
    console.error("Session lookup failed:", error?.code ?? error?.name ?? "unknown");
    response.status(503).json({ error: "Authentication is temporarily unavailable." });
  }
}

export function requireCsrf(request, response, next) {
  if (!csrfTokenMatches(request.auth?.csrfToken, request.get("x-csrf-token"))) {
    response.status(403).json({ error: "The request could not be verified.", code: "CSRF_INVALID" });
    return;
  }
  next();
}

export function requireTrustedOrigin(request, response, next) {
  if (request.get("origin") !== request.app.locals.clientUrl) {
    response.status(403).json({ error: "The request origin is not allowed.", code: "ORIGIN_INVALID" });
    return;
  }
  next();
}
