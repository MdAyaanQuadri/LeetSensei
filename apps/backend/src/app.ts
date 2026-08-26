import Express from "express";
// middleWares
import { clerkMiddleware } from '@clerk/express'
import errorHandler from './middleware/error.middleware.js'

// routers 
import webhookRouter from "./modules/webhooks/webhooks.routes.js";
import leetCodeRouter from "./modules/leetcode/leetcode.routes.js"

const app = Express() ;

// webhooks module calls
app.use('/api/webhook',webhookRouter); 

// clerk builtin middleware
app.use(clerkMiddleware()) ;

// parse json
app.use(Express.json());

// leetcode module calls 
app.use('/api/leetcode',leetCodeRouter);


// error Handler
app.use(errorHandler);



export default app;
