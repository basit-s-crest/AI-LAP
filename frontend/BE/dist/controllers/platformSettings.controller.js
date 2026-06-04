"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLogo = exports.updatePlatformSettings = exports.getPublicPlatformSettings = exports.getPlatformSettings = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const PLATFORM_ID = "platform";
const UPLOADS_DIR = path_1.default.resolve(process.cwd(), "public", "uploads");
async function ensurePlatformSettings() {
    return prisma_1.default.platformSettings.upsert({
        where: { id: PLATFORM_ID },
        update: {},
        create: { id: PLATFORM_ID },
    });
}
function parseBase64Payload(input) {
    const dataUrl = input.match(/^data:(.+);base64,(.+)$/);
    if (!dataUrl)
        throw new Error("Invalid base64 data URL");
    const mime = dataUrl[1].toLowerCase();
    const body = dataUrl[2];
    const extMap = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/svg+xml": "svg",
    };
    const ext = extMap[mime];
    if (!ext)
        throw new Error("Unsupported image type");
    return { buffer: Buffer.from(body, "base64"), ext };
}
async function saveUpload(base64Data, name) {
    const { buffer, ext } = parseBase64Payload(base64Data);
    await fs_1.promises.mkdir(UPLOADS_DIR, { recursive: true });
    const fileName = `${name}.${ext}`;
    const absolutePath = path_1.default.join(UPLOADS_DIR, fileName);
    await fs_1.promises.writeFile(absolutePath, buffer);
    return { url: `/uploads/${fileName}` };
}
const getPlatformSettings = async (_req, res) => {
    try {
        const settings = await ensurePlatformSettings();
        return res.status(200).json({
            ...settings,
            emailFrom: process.env.GMAIL_USER ?? "",
        });
    }
    catch (error) {
        console.error("[getPlatformSettings]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPlatformSettings = getPlatformSettings;
const getPublicPlatformSettings = async (_req, res) => {
    try {
        const settings = await ensurePlatformSettings();
        return res.status(200).json({
            brandTitle: settings.brandTitle,
            brandTagline: settings.brandTagline,
            primaryColor: settings.primaryColor,
            logoUrl: settings.logoUrl,
            allowSelfRegistration: settings.allowSelfRegistration,
            maintenanceMode: settings.maintenanceMode,
            sessionDurationMax: settings.sessionDurationMax,
            sessionDurationMin: settings.sessionDurationMin,
        });
    }
    catch (error) {
        console.error("[getPublicPlatformSettings]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPublicPlatformSettings = getPublicPlatformSettings;
const updatePlatformSettings = async (req, res) => {
    try {
        await ensurePlatformSettings();
        const patch = req.body;
        const data = {};
        if (patch.brandTitle !== undefined)
            data.brandTitle = patch.brandTitle;
        if (patch.brandTagline !== undefined)
            data.brandTagline = patch.brandTagline;
        if (patch.logoUrl !== undefined)
            data.logoUrl = patch.logoUrl;
        if (patch.primaryColor !== undefined)
            data.primaryColor = patch.primaryColor;
        if (patch.supportEmail !== undefined)
            data.supportEmail = patch.supportEmail;
        if (patch.maxMembersPerCoach !== undefined)
            data.maxMembersPerCoach = Number(patch.maxMembersPerCoach);
        if (patch.sessionDurationDefault !== undefined)
            data.sessionDurationDefault = Number(patch.sessionDurationDefault);
        if (patch.sessionDurationMax !== undefined)
            data.sessionDurationMax = Number(patch.sessionDurationMax);
        if (patch.sessionDurationMin !== undefined)
            data.sessionDurationMin = Number(patch.sessionDurationMin);
        if (patch.allowSelfRegistration !== undefined)
            data.allowSelfRegistration = Boolean(patch.allowSelfRegistration);
        if (patch.maintenanceMode !== undefined)
            data.maintenanceMode = Boolean(patch.maintenanceMode);
        const settings = await prisma_1.default.platformSettings.update({
            where: { id: PLATFORM_ID },
            data,
        });
        return res.status(200).json({
            ...settings,
            emailFrom: process.env.GMAIL_USER ?? "",
        });
    }
    catch (error) {
        console.error("[updatePlatformSettings]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.updatePlatformSettings = updatePlatformSettings;
const uploadLogo = async (req, res) => {
    try {
        const base64 = (req.body?.base64 ?? "");
        if (!base64)
            return res.status(400).json({ message: "base64 is required" });
        const saved = await saveUpload(base64, "logo");
        return res.status(200).json(saved);
    }
    catch (error) {
        console.error("[uploadLogo]", error);
        return res.status(400).json({ message: "Invalid upload payload" });
    }
};
exports.uploadLogo = uploadLogo;
