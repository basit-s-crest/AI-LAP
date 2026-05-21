"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = exports.generateOtp = void 0;
exports.isEmailConfigured = isEmailConfigured;
exports.sendAppEmail = sendAppEmail;
exports.sendAppEmailSafe = sendAppEmailSafe;
exports.portalUrl = portalUrl;
const nodemailer_1 = __importDefault(require("nodemailer"));
const emailTemplates_1 = require("./emailTemplates");
const prisma_1 = __importDefault(require("../lib/prisma"));
/**
 * Gmail SMTP transporter.
 *
 * Requirements in .env:
 *   GMAIL_USER  — your Gmail address  e.g. yourname@gmail.com
 *   GMAIL_PASS  — a Gmail App Password (NOT your normal password)
 *
 * How to get an App Password:
 *   1. Enable 2-Step Verification on your Google account
 *   2. Go to https://myaccount.google.com/apppasswords
 *   3. Create a new app password → copy the 16-char code
 *   4. Paste it as GMAIL_PASS in your .env
 */
function isEmailConfigured() {
    return Boolean(process.env.GMAIL_USER && process.env.GMAIL_PASS);
}
const createTransporter = () => {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_PASS;
    if (!user || !pass) {
        throw new Error("GMAIL_USER and GMAIL_PASS must be set in environment variables");
    }
    return nodemailer_1.default.createTransport({
        service: "gmail",
        auth: { user, pass },
    });
};
function appBaseUrl() {
    return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
async function getEmailBranding() {
    try {
        const settings = await prisma_1.default.platformSettings.findUnique({
            where: { id: "platform" },
            select: {
                brandTitle: true,
                brandTagline: true,
                primaryColor: true,
            },
        });
        return {
            brandTitle: settings?.brandTitle ?? "Azadi Health",
            brandTagline: settings?.brandTagline ?? "Mental Wellness Platform",
            primaryColor: settings?.primaryColor ?? "#4E8C58",
        };
    }
    catch {
        return {
            brandTitle: "Azadi Health",
            brandTagline: "Mental Wellness Platform",
            primaryColor: "#4E8C58",
        };
    }
}
/**
 * Branded transactional email (Azadi / VASL styling).
 */
async function sendAppEmail(toEmail, subject, content) {
    const transporter = createTransporter();
    const branding = await getEmailBranding();
    const from = `"${branding.brandTitle}" <${process.env.GMAIL_USER}>`;
    const textBody = [
        content.title,
        content.greeting ?? "",
        ...content.lines,
        content.ctaUrl ? `\n${content.ctaLabel ?? "Open"}: ${content.ctaUrl}` : "",
    ]
        .filter(Boolean)
        .join("\n\n");
    await transporter.sendMail({
        from,
        to: toEmail,
        subject,
        text: textBody,
        html: (0, emailTemplates_1.buildAppEmailHtml)({
            ...content,
            ctaUrl: content.ctaUrl ? content.ctaUrl : undefined,
        }, branding),
    });
}
/** Fire-and-forget; skips when Gmail is not configured. */
function sendAppEmailSafe(toEmail, subject, content) {
    if (!isEmailConfigured() || !toEmail)
        return;
    void sendAppEmail(toEmail, subject, content).catch((err) => {
        console.error("[sendAppEmailSafe]", subject, err);
    });
}
function portalUrl(path) {
    const base = appBaseUrl();
    return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
/**
 * Generates a cryptographically random 6-digit OTP string.
 */
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.generateOtp = generateOtp;
/**
 * Sends a verification OTP email via Gmail.
 */
const sendVerificationEmail = async (toEmail, name, otp) => {
    const transporter = createTransporter();
    const branding = await getEmailBranding();
    const from = `"${branding.brandTitle}" <${process.env.GMAIL_USER}>`;
    await transporter.sendMail({
        from,
        to: toEmail,
        subject: `Your ${branding.brandTitle} verification code`,
        text: `Hi ${name},\n\nYour verification code is: ${otp}\n\nThis code expires in 15 minutes.\n\nIf you did not create an account, please ignore this email.`,
        html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: ${branding.primaryColor}; margin-bottom: 8px;">Verify your ${branding.brandTitle} account</h2>
        <p style="color: #444;">Hi <strong>${name}</strong>,</p>
        <p style="color: #444;">Use the code below to verify your email. It expires in <strong>15 minutes</strong>.</p>
        <div style="
          font-size: 40px;
          font-weight: bold;
          letter-spacing: 10px;
          text-align: center;
          padding: 28px 16px;
          background: #f0f7f1;
          border: 2px dashed ${branding.primaryColor};
          border-radius: 10px;
          margin: 28px 0;
          color: #2d5a35;
        ">${otp}</div>
        <p style="color: #888; font-size: 13px;">
          If you did not sign up for ${branding.brandTitle}, you can safely ignore this email.
        </p>
      </div>
    `,
    });
};
exports.sendVerificationEmail = sendVerificationEmail;
