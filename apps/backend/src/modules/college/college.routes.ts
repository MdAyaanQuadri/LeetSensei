import { Router } from "express";

// middleware
import requireAuth from "../../middleware/requireAuth.middleware.js";

// controllers
import { searchColleges, getCollegeById, suggestCollege, linkCollegeToUser } from "./college.controller.js";

const router = Router();

// Public routes (no auth needed)
router.get("/search", searchColleges);           // GET /api/college/search?query=VIT
router.get("/:id", getCollegeById);              // GET /api/college/:id

// Protected routes (auth required)
router.post("/suggest", requireAuth, suggestCollege);      // POST /api/college/suggest
router.patch("/link", requireAuth, linkCollegeToUser);     // PATCH /api/college/link

export default router;
