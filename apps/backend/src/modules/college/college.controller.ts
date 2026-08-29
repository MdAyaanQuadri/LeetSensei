import type { Request, Response } from "express";
import { z } from "zod";

// validations
import { searchCollegeSchema, collegeIdSchema, suggestCollegeSchema, linkCollegeSchema } from "./college.validation.js";

// errors
import { ZodParsingError } from "../../errorHandler.js";

// services
import { searchCollegesService, getCollegeByIdService, suggestCollegeService, linkCollegeToUserService } from "./college.service.js";

// GET /api/college/search?query=VIT
export const searchColleges = async (req: Request, res: Response) => {
    const { data, success, error } = searchCollegeSchema.safeParse(req.query);
    if (!success) {
        const message = z.flattenError(error).fieldErrors.query?.[0] ?? "Invalid search query";
        throw new ZodParsingError(message, "ZodError", "search query validation error");
    }
    const colleges = await searchCollegesService(data.query);
    return res.status(200).json({
        success: true,
        status: "success",
        message: "Colleges fetched successfully",
        data: colleges
    });
};

// GET /api/college/:id
export const getCollegeById = async (req: Request, res: Response) => {
    const { data, success, error } = collegeIdSchema.safeParse(req.params);
    if (!success) {
        const message = z.flattenError(error).fieldErrors.id?.[0] ?? "Invalid college ID";
        throw new ZodParsingError(message, "ZodError", "college id validation error");
    }
    const college = await getCollegeByIdService(data.id);
    if (!college) {
        console.warn(`\n⚠️ [COLLEGE WARNING] Someone tried to fetch an invalid college ID: ${data.id}`);
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "College not found in our database.",
            data: null
        });
    }
    return res.status(200).json({
        success: true,
        status: "success",
        message: "College loaded successfully",
        data: college
    });
};

// POST /api/college/suggest — User adds their college if not in DB
export const suggestCollege = async (req: Request, res: Response) => {
    const { data, success, error } = suggestCollegeSchema.safeParse(req.body);
    if (!success) {
        const fieldErrors = z.flattenError(error).fieldErrors;
        const message = fieldErrors.name?.[0] ?? fieldErrors.city?.[0] ?? fieldErrors.state?.[0] ?? "Invalid college data";
        throw new ZodParsingError(message, "ZodError", "suggest college validation error");
    }
    const result = await suggestCollegeService(data.name, data.city, data.state);
    if (result.alreadyExists) {
        return res.status(200).json({
            success: true,
            status: "success",
            message: "College already exists in our database!",
            data: result.college
        });
    }
    return res.status(201).json({
        success: true,
        status: "success",
        message: "College added successfully!",
        data: result.college
    });
};

// PATCH /api/college/link — Link a college to the logged in user
export const linkCollegeToUser = async (req: Request, res: Response) => {
    const userId = res.locals.userId;
    const { data, success, error } = linkCollegeSchema.safeParse(req.body);
    if (!success) {
        const fieldErrors = z.flattenError(error).fieldErrors;
        const message = fieldErrors.collegeId?.[0] ?? fieldErrors.degree?.[0] ?? fieldErrors.branch?.[0] ?? fieldErrors.graduationYear?.[0] ?? "Invalid linking data";
        throw new ZodParsingError(message, "ZodError", "link college validation error");
    }
    const updatedUser = await linkCollegeToUserService(
        userId, 
        data.collegeId,
        data.degree,
        data.branch,
        data.graduationYear
    );
    if (!updatedUser) {
        console.warn(`\n⚠️ [COLLEGE WARNING] User ${userId} tried to link an invalid college ID: ${data.collegeId}`);
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "College not found! Please suggest it first.",
            data: null
        });
    }
    return res.status(200).json({
        success: true,
        status: "success",
        message: "College linked successfully!",
        data: updatedUser
    });
};
