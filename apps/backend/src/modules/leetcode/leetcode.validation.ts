import { z } from 'zod';

export const leetcodeUsernameInputSchema = z.object({
    leetCodeUsername: z.string()
        .trim()
        .min(4, "LeetCode username must be at least 4 characters long.")
        .max(20, "LeetCode username cannot exceed 20 characters.")
        .regex(/^[a-zA-Z0-9_.-]+$/, "LeetCode username can only contain letters, numbers, dashes, underscores, and periods.")

});

export const questionSyncSchema = z.object({
    data: z.object({
        question: z.object({
            questionId: z.string(),
            questionFrontendId: z.string(),
            title: z.string(),
            titleSlug: z.string(),
            content: z.string(),
            difficulty: z.enum(["Easy", "Medium", "Hard"]),
            topicTags: z.array(
                z.object({
                    name: z.string(),
                    slug: z.string(),
                })
            ).default([])
        })
    })
});

export type QuestionSyncData = z.infer<typeof questionSyncSchema>;
