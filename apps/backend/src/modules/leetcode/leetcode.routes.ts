import { Router } from "express";

const router = Router();

// middleware
import requireAuth from "../../middleware/requireAuth.middleware";

// controllers
import {linkLeetCodeAccount} from './leetcode.controller'

// authnticated routes
// router.use(requireAuth) ;


router.post("/user/link" , linkLeetCodeAccount) ; 


export default router ;