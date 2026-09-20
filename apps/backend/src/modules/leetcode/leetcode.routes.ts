import { Router } from "express";

const router = Router();

// middleware
import requireAuth from "../../middleware/requireAuth.middleware.js";

// controllers
import { linkLeetCodeAccount, verifyMyProfile, generateVerificationCode, syncQuestion, trackSubmission, } from './leetcode.controller.js';

router.post("/link", requireAuth, linkLeetCodeAccount);
router.patch("/generate/verificationcode", requireAuth, generateVerificationCode);
router.get("/verify", requireAuth, verifyMyProfile);

// Extension Endpoints
router.post("/questions/sync", requireAuth, syncQuestion);
router.post("/submissions/track", requireAuth, trackSubmission);



// extention end point

export default router;
