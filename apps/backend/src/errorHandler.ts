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