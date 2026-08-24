import type { Request, Response } from 'express'
import { verifyWebhook } from '@clerk/backend/webhooks'
import db from '../../config/db.js'

export const handleClerkWebhook = async (req: Request, res: Response) => {
    
}