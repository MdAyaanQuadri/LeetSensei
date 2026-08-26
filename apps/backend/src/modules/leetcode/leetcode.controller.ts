import type { Request, Response } from "express"
import {z} from 'zod'
// validations
import { leetcodeUsernameInputSchema } from "./leetcode.validation"


// errors
import { ZodParsingError } from "../../errorHandler.js";

// services
import {fetchLeetCodeProfileData} from "./leetcode.service";

export const linkLeetCodeAccount = async ( req : Request ,res :  Response )=>{
    const {data,success,error} = leetcodeUsernameInputSchema.safeParse(req.body);
    if(!success){
        const message = error instanceof Error
            ? z.flattenError(error).fieldErrors.leetCodeUsername?.[0] ?? error.message
            : "Unidentified Zod Error";
        const code = "ZodError";
        const details = "leetCodeUsername parsing error";
        throw new ZodParsingError(message, code, details);
    }
    const userName = data.leetCodeUsername ;
    const leetcodeProfileData = await fetchLeetCodeProfileData(userName);
    


}