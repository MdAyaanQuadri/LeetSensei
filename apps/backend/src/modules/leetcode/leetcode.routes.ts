import { Router } from "express";

const router = Router();

// middleware
import requireAuth from "../../middleware/requireAuth.middleware";

// controllers
import {linkLeetCodeAccount,verifyMyProfile , generateVerificationCode} from './leetcode.controller'


router.post("/link" ,requireAuth, linkLeetCodeAccount) ; 

router.patch("/generate/verificationcode" , requireAuth , generateVerificationCode) ;

router.get("/verify", requireAuth, verifyMyProfile) ;

export default router ;