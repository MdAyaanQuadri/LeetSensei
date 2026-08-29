export class AppError extends Error {
    status: number
    code: string
    details?: string
    constructor(
        message: string,
        { status = 500, code = 'INTERNAL_ERROR', details }: { status?: number; code?: string; details?: string } = {}
    ) {
        super(message)
        this.name = this.constructor.name
        this.status = status
        this.code = code
        if (details !== undefined) {
            this.details = details
        }
    }
}

// all errors related to webhooks
export class WebhookVerificationError extends AppError{
    constructor(
        message = "WEBHOOK NOT VERIFIED" ,
        details : string
    ){
        super(message, { status: 400, code: "WEBHOOK_NOT_VERIFIED", details })
    }
}

// all errors related to zod 
export class ZodParsingError extends AppError {
    constructor (
        message : string ,
        code : string ,
        details :string 
    ){
        super(message, { status: 400, code , details })
    }
}

// all errors related to rate limiting
export class RateLimitError extends AppError {
    constructor(
        message = "RATE_LIMITED",
        details : string
    ) {
        super(message, { status: 429, code: "RATE_LIMITED", details })
    }
}

// all errors related to user
export class UserNotFoundError extends AppError {
    constructor(
        message = "User not found in database",
        details: string
    ) {
        super(message, { status: 404, code: "USER_NOT_FOUND", details })
    }
}

// all errors related to LeetCode fetching and state
export class LeetCodeUserNotFoundError extends AppError {
    constructor(
        message = "Leetcode user doesn't exist in our system",
        details: string
    ) {
        super(message, { status: 404, code: "LEETCODE_USER_NOT_FOUND", details })
    }
}

export class LeetCodeProfileFetchError extends AppError {
    constructor(
        message = "Unable to fetch Leetcode account",
        details: string
    ) {
        super(message, { status: 404, code: "NOT_FOUND", details })
    }
}

export class LeetCodeCalendarFetchError extends AppError {
    constructor(
        message = "Unable to fetch Leetcode accounts submission calender",
        details: string
    ) {
        super(message, { status: 404, code: "NOT_FOUND", details })
    }
}

export class LeetCodeUsernameChangedError extends AppError {
    constructor(
        message = "Unable to fetch Leetcode account due to username change",
        details: string
    ) {
        super(message, { status: 404, code: "Username_Changed", details })
    }
}