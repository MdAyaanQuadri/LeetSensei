import Express from "express";
// middleWares
import { clerkMiddleware } from '@clerk/express'
import errorHandler from './middleware/errorMiddleware.js'

// routers 
import webhookRouter from "./modules/webhooks/webhooks.routes.js";

const app = Express() ;



app.use(clerkMiddleware()) ;


app.use('/api/webhook',webhookRouter); 

app.use(Express.json());

// error Handler
app.use(errorHandler);



export default app;
