import { Router } from "express";
import {
  getCurrentSession,
  listRooms,
  login,
  logout,
  register,
} from "../controllers/auth.controller.js";
import {
  requireCsrf,
  requireSession,
  requireTrustedOrigin,
} from "../middleware/auth.js";
import { authRateLimit } from "../middleware/auth-rate-limit.js";
import {
  getSession,
  tokenFromCookieHeader,
} from "../services/auth.service.js";

const router = Router();

router.use((_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});
router.post("/register", requireTrustedOrigin, authRateLimit, register);
router.post("/login", requireTrustedOrigin, authRateLimit, login);
router.get("/session", async (request, response, next) => {
  try {
    request.auth = await getSession(tokenFromCookieHeader(request.headers.cookie));
    next();
  } catch (error) {
    next(error);
  }
}, getCurrentSession);
router.post("/logout", requireSession, requireTrustedOrigin, requireCsrf, logout);
router.get("/rooms", requireSession, listRooms);

export default router;
