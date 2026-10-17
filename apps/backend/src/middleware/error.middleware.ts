import type { Request, Response, NextFunction } from "express"
import env from "../config/env.js"
import logger from "../utils/logger.js"

const errorMiddleware = (error: any, req: Request, res: Response, next: NextFunction) => {
    const isProd = env.NODE_ENV === 'production';

    const userId = res.locals?.userId || 'UNAUTHENTICATED_USER';

    logger.error(error.message || "An unknown error occurred", {
        userId: userId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent') || 'Unknown',
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorDetails: error.details || null,
        error: error
    });
    
    return res.status(error.status || 500).json(
        {
            success: false,
            message: isProd ? "Something Went Wrong" : error.message,
            code : error.code,
            details : error.details
        }
    );
}

export default errorMiddleware;