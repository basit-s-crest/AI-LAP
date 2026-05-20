import { promises as fs } from "fs";
import path from "path";
import { Request, Response } from "express";
import prisma from "../lib/prisma";

const PLATFORM_ID = "platform";
const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");

type PlatformSettingsPatch = Partial<{
  brandTitle: string;
  brandTagline: string;
  logoUrl: string | null;
  loaderUrl: string | null;
  primaryColor: string;
  supportEmail: string;
  maxMembersPerCoach: number;
  sessionDurationDefault: number;
  allowSelfRegistration: boolean;
  maintenanceMode: boolean;
}>;

async function ensurePlatformSettings() {
  return prisma.platformSettings.upsert({
    where: { id: PLATFORM_ID },
    update: {},
    create: { id: PLATFORM_ID },
  });
}

function parseBase64Payload(input: string): { buffer: Buffer; ext: string } {
  const dataUrl = input.match(/^data:(.+);base64,(.+)$/);
  if (!dataUrl) throw new Error("Invalid base64 data URL");

  const mime = dataUrl[1].toLowerCase();
  const body = dataUrl[2];
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  };
  const ext = extMap[mime];
  if (!ext) throw new Error("Unsupported image type");

  return { buffer: Buffer.from(body, "base64"), ext };
}

async function saveUpload(base64Data: string, name: "logo" | "loader") {
  const { buffer, ext } = parseBase64Payload(base64Data);
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const fileName = `${name}.${ext}`;
  const absolutePath = path.join(UPLOADS_DIR, fileName);
  await fs.writeFile(absolutePath, buffer);
  return { url: `/uploads/${fileName}` };
}

export const getPlatformSettings = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const settings = await ensurePlatformSettings();
    return res.status(200).json({
      ...settings,
      emailFrom: process.env.GMAIL_USER ?? "",
    });
  } catch (error) {
    console.error("[getPlatformSettings]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getPublicPlatformSettings = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const settings = await ensurePlatformSettings();
    return res.status(200).json({
      brandTitle: settings.brandTitle,
      brandTagline: settings.brandTagline,
      primaryColor: settings.primaryColor,
      allowSelfRegistration: settings.allowSelfRegistration,
      maintenanceMode: settings.maintenanceMode,
    });
  } catch (error) {
    console.error("[getPublicPlatformSettings]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updatePlatformSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    await ensurePlatformSettings();

    const patch = req.body as PlatformSettingsPatch;
    const data: PlatformSettingsPatch = {};

    if (patch.brandTitle !== undefined) data.brandTitle = patch.brandTitle;
    if (patch.brandTagline !== undefined) data.brandTagline = patch.brandTagline;
    if (patch.logoUrl !== undefined) data.logoUrl = patch.logoUrl;
    if (patch.loaderUrl !== undefined) data.loaderUrl = patch.loaderUrl;
    if (patch.primaryColor !== undefined) data.primaryColor = patch.primaryColor;
    if (patch.supportEmail !== undefined) data.supportEmail = patch.supportEmail;
    if (patch.maxMembersPerCoach !== undefined) data.maxMembersPerCoach = Number(patch.maxMembersPerCoach);
    if (patch.sessionDurationDefault !== undefined) data.sessionDurationDefault = Number(patch.sessionDurationDefault);
    if (patch.allowSelfRegistration !== undefined) data.allowSelfRegistration = Boolean(patch.allowSelfRegistration);
    if (patch.maintenanceMode !== undefined) data.maintenanceMode = Boolean(patch.maintenanceMode);

    const settings = await prisma.platformSettings.update({
      where: { id: PLATFORM_ID },
      data,
    });

    return res.status(200).json({
      ...settings,
      emailFrom: process.env.GMAIL_USER ?? "",
    });
  } catch (error) {
    console.error("[updatePlatformSettings]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const uploadLogo = async (req: Request, res: Response): Promise<Response> => {
  try {
    const base64 = (req.body?.base64 ?? "") as string;
    if (!base64) return res.status(400).json({ message: "base64 is required" });
    const saved = await saveUpload(base64, "logo");
    return res.status(200).json(saved);
  } catch (error) {
    console.error("[uploadLogo]", error);
    return res.status(400).json({ message: "Invalid upload payload" });
  }
};

export const uploadLoader = async (req: Request, res: Response): Promise<Response> => {
  try {
    const base64 = (req.body?.base64 ?? "") as string;
    if (!base64) return res.status(400).json({ message: "base64 is required" });
    const saved = await saveUpload(base64, "loader");
    return res.status(200).json(saved);
  } catch (error) {
    console.error("[uploadLoader]", error);
    return res.status(400).json({ message: "Invalid upload payload" });
  }
};

