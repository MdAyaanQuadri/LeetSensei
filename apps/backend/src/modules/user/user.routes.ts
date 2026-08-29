import { Router } from "express";

// controllers
import { getMyProfile, getPublicProfile } from "./user.controller.js";

// middleware
import requireAuth from "../../middleware/requireAuth.middleware.js";

const router = Router();

// Profile endpoints
router.get("/profile/:username", getPublicProfile);
router.get("/profile", requireAuth, getMyProfile);

export default router;

