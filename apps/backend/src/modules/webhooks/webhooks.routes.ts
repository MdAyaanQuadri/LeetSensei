import { Router } from 'express'
import express from 'express'
import { handleClerkWebhook } from './webhooks.controller.js'

const router = Router();

// Raw body required for signature verification
router.use(express.raw({ type: 'application/json' }));

// clerk webhooks
router.post('/clerk', handleClerkWebhook);

export default router
