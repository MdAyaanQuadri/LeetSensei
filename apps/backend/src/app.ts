import Express from "express";
// middleWares
import { clerkMiddleware } from '@clerk/express'
import errorHandler from './middleware/error.middleware.js'

// routers 
import webhookRouter from "./modules/webhooks/webhooks.routes.js";
import leetCodeRouter from "./modules/leetcode/leetcode.routes.js";
import userRouter from "./modules/user/user.routes.js";
import collegeRouter from "./modules/college/college.routes.js";

const app = Express();

// webhooks module calls
app.use('/api/webhook', webhookRouter);

// clerk builtin middleware
app.use(clerkMiddleware());

// parse json
app.use(Express.json());

// module routes
app.use('/api/leetcode', leetCodeRouter);
app.use('/api/user', userRouter);
app.use('/api/college', collegeRouter);

// error Handler
app.use(errorHandler);

export default app;

