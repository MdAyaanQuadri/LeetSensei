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

export const submissionTrackSchema = z.object({
    data: z.object({
        submissionDetails: z.object({
            // Performance Metrics
            runtime: z.number().nullable(),
            runtimeDisplay: z.string().nullable(),
            runtimePercentile: z.number().nullable(),
            runtimeDistribution: z.string().nullable(),
            
            memory: z.number().nullable(),
            memoryDisplay: z.string().nullable(),
            memoryPercentile: z.number().nullable(),
            memoryDistribution: z.string().nullable(),
            
            // Core Details
            code: z.string(),
            timestamp: z.number(),
            statusCode: z.number(), // 10 = Accepted, 20 = Compile Error, etc.
            
            // Language Context
            isCompiledLang: z.boolean().nullable(),
            lang: z.object({
                name: z.string(),
                verboseName: z.string().nullable(),
            }),
            //user
            user: z.object({
                username: z.string(),
                profile: z.object({
                    realName: z.string().nullable(),
                    userAvatar: z.string().nullable(),
                }).nullable(),
            }).nullable(),
            // Question Context
            question: z.object({
                questionId: z.string(),
                titleSlug: z.string(),
                hasFrontendPreview: z.boolean().nullable(),
            }),
            
            // Errors and Execution Outputs (Null if Accepted)
            compileError: z.string().nullable(),
            runtimeError: z.string().nullable(),
            lastTestcase: z.string().nullable(),
            codeOutput: z.string().nullable(),
            expectedOutput: z.string().nullable(),
            stdOutput: z.string().nullable(),
            fullCodeOutput: z.string().nullable(),
            
            // Test Case Stats
            totalCorrect: z.number().nullable(),
            totalTestcases: z.number().nullable(),
            
        }) 
    })
});

// Automatically extract the TypeScript type!
export type SubmissionTrackData = z.infer<typeof submissionTrackSchema>;

export type QuestionSyncData = z.infer<typeof questionSyncSchema>;
