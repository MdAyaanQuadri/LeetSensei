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
// ---- Reusable pieces ----

const submissionHistoryItemSchema = z.object({
    id: z.string(),
    title: z.string(),
    titleSlug: z.string(),
    status: z.number(),
    statusDisplay: z.string(),
    lang: z.string(),
    langName: z.string(),
    runtime: z.string(),
    timestamp: z.string(),          // LeetCode sends this as STRING in history!
    url: z.string(),
    isPending: z.string(),
    memory: z.string(),
    hasNotes: z.boolean(),
    notes: z.string(),
    flagType: z.string(),
    frontendId: z.number(),
    topicTags: z.array(z.any()),
});

const submissionDetailsSchema = z.object({
    runtimePercentile: z.number().nullable(),
    runtimeDistribution: z.string(),
    memoryPercentile: z.number().nullable(),
    memoryDistribution: z.string(),
    code: z.string(),
    timestamp: z.number(),          // LeetCode sends this as NUMBER in details!
    statusCode: z.number(),
    isCompiledLang: z.boolean().nullable(),
    lang: z.object({
        name: z.string(),
        verboseName: z.string().nullable(),
    }),
    question: z.object({
        questionId: z.string(),
        titleSlug: z.string(),
        hasFrontendPreview: z.boolean().nullable(),
    }),
    user: z.object({
        username: z.string(),
        profile: z.object({
            realName: z.string().nullable(),
            userAvatar: z.string().nullable(),
        }).nullable(),
    }).nullable(),
    runtimeError: z.string().nullable(),
    compileError: z.string().nullable(),
    lastTestcase: z.string().nullable(),
    codeOutput: z.string().nullable(),
    expectedOutput: z.string().nullable(),
    totalCorrect: z.number().nullable(),
    totalTestcases: z.number(),
    stdOutput: z.string().nullable(),
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
