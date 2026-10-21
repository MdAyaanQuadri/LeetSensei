import { Router } from "express";

const router = Router();

// middleware
import requireAuth from "../../middleware/requireAuth.middleware.js";
import requireLeetCodeLinked from "../../middleware/requireLeetCodeLinked.middleware.js";
import requireLeetCodeVerified from "../../middleware/requireLeetCodeVerified.middleware.js";
import requireLeetCodeUsernameMatch from "../../middleware/requireLeetCodeUsernameMatch.middleware.js";

// controllers
import { linkLeetCodeAccount, verifyMyProfile, generateVerificationCode, syncQuestion, trackSubmission } from './leetcode.controller.js';

router.post("/link", requireAuth, linkLeetCodeAccount);
router.patch("/generate/verificationcode", requireAuth, requireLeetCodeLinked, generateVerificationCode);
router.get("/verify", requireAuth, requireLeetCodeLinked, verifyMyProfile);

// Extension Endpoints
router.post("/questions/sync", requireAuth, syncQuestion);
router.post(
    "/submissions/track",
    requireAuth,
    requireLeetCodeLinked,
    requireLeetCodeVerified,
    requireLeetCodeUsernameMatch,
    trackSubmission
);




export default router;
