import type { Request, Response, NextFunction } from "express"
import env from "../config/env.js"

const errorMiddleware = (error: any, req: Request, res: Response, next: NextFunction) => {
    const isProd = env.NODE_ENV === 'production';


    
    return res.status(error.status ).json(
        {
            success: false,
            message: isProd ? "Something Went Wrong" : error.message,
            code : error.code,
            details : error.details
        }
    );
}

export default errorMiddleware;