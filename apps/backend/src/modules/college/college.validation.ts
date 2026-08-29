import { z } from 'zod';

// For GET /search?query=VIT
export const searchCollegeSchema = z.object({
    query: z.string()
        .trim()
        .min(2, "Search query must be at least 2 characters.")
        .max(100, "Search query is too long.")
});

// For GET /:id
export const collegeIdSchema = z.object({
    id: z.uuid("Invalid college ID format.")
});

// For POST /suggest
export const suggestCollegeSchema = z.object({
    name: z.string()
        .trim()
        .min(3, "College name must be at least 3 characters.")
        .max(200, "College name is too long."),
    city: z.string()
        .trim()
        .min(2, "City must be at least 2 characters.")
        .max(100, "City name is too long."),
    state: z.string()
        .trim()
        .min(2, "State must be at least 2 characters.")
        .max(100, "State name is too long.")
});

// For PATCH /link
export const linkCollegeSchema = z.object({
    collegeId: z.string()
        .uuid("Invalid college ID format."),
    degree: z.string()
        .trim()
        .min(2, "Degree is required."),
    branch: z.string()
        .trim()
        .min(2, "Branch is required."),
    graduationYear: z.number()
        .int("Graduation year must be a whole number.")
        .min(2000, "Invalid graduation year.")
        .max(2100, "Invalid graduation year.")
});
