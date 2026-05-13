"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminArchiveGroup = exports.adminUpdateGroup = exports.adminCreateGroup = exports.adminGetGroups = exports.removeCoach = exports.updateCoach = exports.createCoach = exports.getAllCoaches = exports.createSuperAdmin = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getAllUsers = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_service_1 = require("../services/auth.service");
// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
            where: {
                role: {
                    not: "superadmin",
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        groupMemberships: {
                            where: {
                                isActive: true,
                            },
                        },
                        sentMessages: true,
                    },
                },
            },
        });
        return res.status(200).json(users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            avatar: u.avatar,
            isVerified: u.isVerified,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            groupCount: u._count.groupMemberships,
            messageCount: u._count.sentMessages,
        })));
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.getAllUsers = getAllUsers;
const getUserById = async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: {
                id: req.params.id,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
                groupMemberships: {
                    where: {
                        isActive: true,
                    },
                    include: {
                        group: {
                            select: {
                                id: true,
                                name: true,
                                emoji: true,
                            },
                        },
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }
        return res.status(200).json(user);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.getUserById = getUserById;
const createUser = async (req, res) => {
    try {
        const { email, name, password, avatar, role, isVerified, } = req.body;
        if (!email || !name || !password) {
            return res.status(400).json({
                message: "Email, name and password are required",
            });
        }
        const allowedRoles = ["member", "superadmin"];
        const userRole = allowedRoles.includes(role) ? role : "member";
        const existingUser = await prisma_1.default.user.findUnique({
            where: {
                email,
            },
        });
        if (existingUser) {
            return res.status(409).json({
                message: "User already exists",
            });
        }
        const hashedPassword = await (0, auth_service_1.hashPassword)(password);
        const user = await prisma_1.default.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                avatar: avatar ?? null,
                role: userRole,
                isVerified: isVerified ?? true,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        groupMemberships: {
                            where: {
                                isActive: true,
                            },
                        },
                        sentMessages: true,
                    },
                },
            },
        });
        return res.status(201).json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            groupCount: user._count.groupMemberships,
            messageCount: user._count.sentMessages,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    try {
        const { name, email, role, isVerified, } = req.body;
        const allowedRoles = [
            "member",
            "coach",
            "superadmin",
        ];
        const updatedData = {};
        if (name)
            updatedData.name = name;
        if (email)
            updatedData.email = email;
        if (role &&
            allowedRoles.includes(role)) {
            updatedData.role = role;
        }
        if (isVerified !== undefined) {
            updatedData.isVerified = isVerified;
        }
        const user = await prisma_1.default.user.update({
            where: {
                id: req.params.id,
            },
            data: updatedData,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return res.status(200).json(user);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        await prisma_1.default.user.delete({
            where: {
                id: req.params.id,
            },
        });
        return res.status(200).json({
            message: "User deleted",
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.deleteUser = deleteUser;
// ─── SUPERADMIN MANAGEMENT ────────────────────────────────────────────────────
const createSuperAdmin = async (req, res) => {
    try {
        const { email, name, password, avatar, } = req.body;
        if (!email ||
            !name ||
            !password) {
            return res.status(400).json({
                message: "Email, name and password required",
            });
        }
        const existingUser = await prisma_1.default.user.findUnique({
            where: {
                email,
            },
        });
        if (existingUser) {
            return res.status(409).json({
                message: "User already exists",
            });
        }
        const hashedPassword = await (0, auth_service_1.hashPassword)(password);
        const superadmin = await prisma_1.default.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                avatar: avatar ?? null,
                role: "superadmin",
                isVerified: true,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                isVerified: true,
                createdAt: true,
            },
        });
        return res.status(201).json(superadmin);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.createSuperAdmin = createSuperAdmin;
// ─── COACH MANAGEMENT ─────────────────────────────────────────────────────────
const getAllCoaches = async (req, res) => {
    try {
        const coaches = await prisma_1.default.coach.findMany({
            orderBy: {
                createdAt: "desc",
            },
            include: {
                _count: {
                    select: {
                        members: true,
                    },
                },
            },
        });
        return res.status(200).json(coaches.map((c) => ({
            id: c.id,
            email: c.email,
            name: c.name,
            avatar: c.avatar,
            bio: c.bio,
            speciality: c.speciality,
            isActive: c.isActive,
            createdAt: c.createdAt,
            memberCount: c._count.members,
        })));
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.getAllCoaches = getAllCoaches;
const createCoach = async (req, res) => {
    try {
        const { email, name, password, bio, speciality, avatar, } = req.body;
        if (!email ||
            !name ||
            !password) {
            return res.status(400).json({
                message: "Email, name and password required",
            });
        }
        const exists = await prisma_1.default.coach.findUnique({
            where: {
                email,
            },
        });
        if (exists) {
            return res.status(409).json({
                message: "Coach email already exists",
            });
        }
        const hashedPassword = await (0, auth_service_1.hashPassword)(password);
        const coach = await prisma_1.default.coach.create({
            data: {
                email,
                name,
                password: hashedPassword,
                bio: bio ?? null,
                speciality: speciality ?? null,
                avatar: avatar ?? null,
                isActive: true,
            },
        });
        return res.status(201).json({
            id: coach.id,
            email: coach.email,
            name: coach.name,
            bio: coach.bio,
            speciality: coach.speciality,
            avatar: coach.avatar,
            isActive: coach.isActive,
            createdAt: coach.createdAt,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.createCoach = createCoach;
const updateCoach = async (req, res) => {
    try {
        const { name, email, bio, speciality, avatar, isActive, } = req.body;
        const coach = await prisma_1.default.coach.update({
            where: {
                id: req.params.id,
            },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(bio !== undefined && {
                    bio,
                }),
                ...(speciality !==
                    undefined && {
                    speciality,
                }),
                ...(avatar !== undefined && {
                    avatar,
                }),
                ...(isActive !== undefined && {
                    isActive,
                }),
            },
        });
        return res.status(200).json(coach);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.updateCoach = updateCoach;
const removeCoach = async (req, res) => {
    try {
        await prisma_1.default.coach.update({
            where: {
                id: req.params.id,
            },
            data: {
                isActive: false,
            },
        });
        return res.status(200).json({
            message: "Coach removed",
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.removeCoach = removeCoach;
// ─── GROUP MANAGEMENT ─────────────────────────────────────────────────────────
const adminGetGroups = async (req, res) => {
    try {
        const groups = await prisma_1.default.communityGroup.findMany({
            orderBy: {
                createdAt: "desc",
            },
            include: {
                _count: {
                    select: {
                        memberships: {
                            where: {
                                isActive: true,
                            },
                        },
                        posts: true,
                    },
                },
            },
        });
        return res.status(200).json(groups.map((g) => ({
            id: g.id,
            name: g.name,
            emoji: g.emoji,
            description: g.description,
            color: g.color,
            tags: g.tags,
            mod: g.mod,
            status: g.status,
            memberCount: g._count.memberships,
            postCount: g._count.posts,
            createdAt: g.createdAt,
        })));
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.adminGetGroups = adminGetGroups;
const adminCreateGroup = async (req, res) => {
    try {
        const { name, emoji, description, color, tags, mod, } = req.body;
        if (!name) {
            return res.status(400).json({
                message: "Name required",
            });
        }
        const group = await prisma_1.default.communityGroup.create({
            data: {
                name,
                emoji: emoji ?? "👥",
                description: description ?? null,
                color: color ?? "#4E8C58",
                tags: Array.isArray(tags)
                    ? tags
                    : [],
                mod: mod ?? null,
                memberIds: [],
                status: "active",
            },
        });
        return res.status(201).json(group);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.adminCreateGroup = adminCreateGroup;
const adminUpdateGroup = async (req, res) => {
    try {
        const { name, emoji, description, color, tags, mod, status, } = req.body;
        const group = await prisma_1.default.communityGroup.update({
            where: {
                id: req.params.id,
            },
            data: {
                ...(name && { name }),
                ...(emoji && { emoji }),
                ...(description !==
                    undefined && {
                    description,
                }),
                ...(color && { color }),
                ...(tags && { tags }),
                ...(mod !== undefined && {
                    mod,
                }),
                ...(status && {
                    status,
                }),
            },
        });
        return res.status(200).json(group);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.adminUpdateGroup = adminUpdateGroup;
const adminArchiveGroup = async (req, res) => {
    try {
        const group = await prisma_1.default.communityGroup.update({
            where: {
                id: req.params.id,
            },
            data: {
                status: "archived",
            },
        });
        return res.status(200).json(group);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.adminArchiveGroup = adminArchiveGroup;
