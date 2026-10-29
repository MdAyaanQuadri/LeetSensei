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
        userStatus: z.object({
            isPremium: z.boolean().nullable().optional()
        }).nullable().optional(),
        question: z.object({
            questionId: z.coerce.string(),
            questionFrontendId: z.coerce.string(),
            title: z.string(),
            titleSlug: z.string(),
            content: z.string().nullable().optional(),
            difficulty: z.string(),
            isPaidOnly: z.boolean().nullable().optional(),
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

export const submissionHistoryItemSchema = z.object({
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
    isPending: z.union([z.string(), z.boolean()]).nullable().optional(),
    memory: z.string().nullable().optional(),
    hasNotes: z.boolean().nullable().optional(),
    notes: z.string().nullable().optional(),
    flagType: z.any().optional(),
    frontendId: z.coerce.number(),
    topicTags: z.array(z.any()).nullable().optional(),
}).passthrough();

export const submissionDetailsSchema = z.object({
    runtime: z.coerce.number().nullable().optional(),
    runtimeDisplay: z.string().nullable().optional(),
    runtimePercentile: z.number().nullable().optional(),
    runtimeDistribution: z.string().nullable().optional(),
    memory: z.coerce.number().nullable().optional(),
    memoryDisplay: z.string().nullable().optional(),
    memoryPercentile: z.number().nullable().optional(),
    memoryDistribution: z.string().nullable().optional(),
    code: z.string(),
    timestamp: z.coerce.number(),
    statusCode: z.coerce.number(),
    aiJudgeMessage: z.string().nullable().optional(),
    isCompiledLang: z.boolean().nullable().optional(),
    aiRecheckSubmitted: z.any().nullable().optional(),
    user: z.object({
        username: z.string(),
        profile: z.object({
            realName: z.string().nullable().optional(),
            userAvatar: z.string().nullable().optional(),
        }).passthrough().nullable().optional(),
    }).passthrough().nullable().optional(),
    lang: z.object({
        name: z.string(),
        verboseName: z.string().nullable().optional(),
    }).passthrough(),
    question: z.object({
        questionId: z.coerce.string(),
        titleSlug: z.string(),
        hasFrontendPreview: z.boolean().nullable().optional(),
    }).passthrough(),
    notes: z.string().nullable().optional(),
    flagType: z.string().nullable().optional(),
    topicTags: z.array(z.any()).nullable().optional(),
    runtimeError: z.string().nullable().optional(),
    compileError: z.string().nullable().optional(),
    lastTestcase: z.string().nullable().optional(),
    codeOutput: z.string().nullable().optional(),
    expectedOutput: z.string().nullable().optional(),
    totalCorrect: z.coerce.number().nullable().optional(),
    totalTestcases: z.coerce.number().nullable().optional(),
    fullCodeOutput: z.any().nullable().optional(),
    testDescriptions: z.any().nullable().optional(),
    testBodies: z.any().nullable().optional(),
    testInfo: z.any().nullable().optional(),
    stdOutput: z.string().nullable().optional(),
}).passthrough();

export const questionSubmissionListSchema = z.object({
    lastKey: z.string().nullable().optional(),
    hasNext: z.boolean().optional(),
    submissions: z.array(submissionHistoryItemSchema),
}).passthrough();

// ---- Final combined schema ----
// Accepts either `{ data: { submissionDetails, questionSubmissionList } }`
// OR `{ submissionDetails, questionSubmissionList }`
const directTrackPayloadSchema = z.object({
    submissionDetails: submissionDetailsSchema,
    questionSubmissionList: questionSubmissionListSchema,
}).passthrough();

export const submissionTrackSchema = z.union([
    z.object({
        data: directTrackPayloadSchema
    }).passthrough(),
    directTrackPayloadSchema.transform((val) => ({ data: val }))
]);

export type SubmissionTrackData = {
    data: {
        submissionDetails: z.infer<typeof submissionDetailsSchema>;
        questionSubmissionList: z.infer<typeof questionSubmissionListSchema>;
    };
};

export type submissionDetailsData = z.infer<typeof submissionDetailsSchema>;
export type submissionHistoryItemData = z.infer<typeof submissionHistoryItemSchema>;
export type questionSubmissionListData = z.infer<typeof questionSubmissionListSchema>;
export type QuestionSyncData = z.infer<typeof questionSyncSchema>;
