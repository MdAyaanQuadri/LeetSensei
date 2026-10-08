import type { Request, Response } from 'express';
import { verifyWebhook } from '@clerk/express/webhooks';

// services
import { createUser, deleteUser } from "./webhooks.service.js";

//error
import { WebhookVerificationError } from '../../errorHandler.js';



export const handleClerkWebhook = async (req: Request, res: Response) => {
    try {
        const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
        if (!secret) {
            throw new Error("Missing CLERK_WEBHOOK_SIGNING_SECRET in environment");
        }
        
        const evt = await verifyWebhook(req, { secretKey: secret });

        // create and update user

        if (evt.type === 'user.created' || evt.type === 'user.updated') {
            await createUser(evt.data);
        }

        // delete user
        
        else if (evt.type === 'user.deleted') {
            await deleteUser(evt.data.id as string);
        }
        res.status(200).send("Ok");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown webhook verification error';
        console.error("\n❌ Webhook Error:", message, error); throw new WebhookVerificationError(message, "Clerk WebHook verification failed ");
    }


}