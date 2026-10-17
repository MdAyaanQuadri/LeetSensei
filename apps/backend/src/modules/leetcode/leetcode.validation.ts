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
            questionId: z.coerce.string(),
            questionFrontendId: z.coerce.string(),
            title: z.string(),
            titleSlug: z.string(),
            content: z.string().nullable().optional(),
            difficulty: z.string(), // Some questions might have weird difficulties, string is safer
            topicTags: z.array(
                z.object({
                    name: z.string(),
                    slug: z.string(),
                }).passthrough()
            ).nullable().optional().default([])
        }).passthrough()
    }).passthrough()
});
// ---- Reusable pieces ----

const submissionHistoryItemSchema = z.object({
    id: z.coerce.string(),
    title: z.string(),
    titleSlug: z.string(),
    status: z.coerce.number(),
    statusDisplay: z.string(),
    lang: z.string(),
    langName: z.string(),
    runtime: z.string().nullable().optional(),
    timestamp: z.coerce.string(),          
    url: z.string(),
    isPending: z.any(),
    memory: z.string().nullable().optional(),
    hasNotes: z.boolean().nullable().optional(),
    notes: z.string().nullable().optional(),
    flagType: z.any(),
    frontendId: z.coerce.number(),
    topicTags: z.array(z.any()).nullable().optional(),
});

const submissionDetailsSchema = z.object({
    runtimePercentile: z.number().nullable().optional(),
    runtimeDistribution: z.string().nullable().optional(),
    memoryPercentile: z.number().nullable().optional(),
    memoryDistribution: z.string().nullable().optional(),
    code: z.string(),
    timestamp: z.coerce.number(),
    statusCode: z.coerce.number(),
    isCompiledLang: z.boolean().nullable().optional(),
    lang: z.object({
        name: z.string(),
        verboseName: z.string().nullable().optional(),
    }),
    question: z.object({
        questionId: z.coerce.string(),
        titleSlug: z.string(),
        hasFrontendPreview: z.boolean().nullable().optional(),
    }),
    user: z.object({
        username: z.string(),
        profile: z.any(),
    }).nullable().optional(),
    runtimeError: z.string().nullable().optional(),
    compileError: z.string().nullable().optional(),
    lastTestcase: z.string().nullable().optional(),
    codeOutput: z.string().nullable().optional(),
    expectedOutput: z.string().nullable().optional(),
    totalCorrect: z.coerce.number().nullable().optional(),
    totalTestcases: z.coerce.number().nullable().optional(),
    stdOutput: z.string().nullable().optional(),
});

// ---- Final combined schema ----

export const submissionTrackSchema = z.object({
    data: z.object({
        submissionDetails: submissionDetailsSchema,
        questionSubmissionList: z.object({
            lastKey: z.string().nullable(),
            hasNext: z.boolean(),
            submissions: z.array(submissionHistoryItemSchema),
        }),
    }),
});

export type SubmissionTrackData = z.infer<typeof submissionTrackSchema>;

// sub types 

export type submissionDetailsData = z.infer<typeof submissionDetailsSchema> ;
export type submissionHistoryItemData = z.infer<typeof submissionHistoryItemSchema> ;

export type QuestionSyncData = z.infer<typeof questionSyncSchema>;
