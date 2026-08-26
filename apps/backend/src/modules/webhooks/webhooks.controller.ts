import type { Request, Response } from 'express';
import { verifyWebhook } from '@clerk/express/webhooks';

// services
import { createUser, deleteUser } from "./webhooks.service.js";

//error
import { WebhookVerificationError } from '../../errorHandler.js';



export const handleClerkWebhook = async (req: Request, res: Response) => {
    try {
        const evt = await verifyWebhook(req);

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
        throw new WebhookVerificationError(message, "Clerk WebHook verification failed ");
    }


}