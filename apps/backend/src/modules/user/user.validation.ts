import { z } from "zod";

export const usernameParamSchema = z.object({
    username: z.string().min(4, "Username must be at least 4 characters").max(64, "Username cannot exceed 64 characters")
});
