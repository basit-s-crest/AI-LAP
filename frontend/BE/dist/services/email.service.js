"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = exports.generateOtp = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
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
    const from = `"VASL" <${process.env.GMAIL_USER}>`;
    await transporter.sendMail({
        from,
        to: toEmail,
        subject: "Your VASL verification code",
        text: `Hi ${name},\n\nYour verification code is: ${otp}\n\nThis code expires in 15 minutes.\n\nIf you did not create an account, please ignore this email.`,
        html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #4E8C58; margin-bottom: 8px;">Verify your VASL account</h2>
        <p style="color: #444;">Hi <strong>${name}</strong>,</p>
        <p style="color: #444;">Use the code below to verify your email. It expires in <strong>15 minutes</strong>.</p>
        <div style="
          font-size: 40px;
          font-weight: bold;
          letter-spacing: 10px;
          text-align: center;
          padding: 28px 16px;
          background: #f0f7f1;
          border: 2px dashed #4E8C58;
          border-radius: 10px;
          margin: 28px 0;
          color: #2d5a35;
        ">${otp}</div>
        <p style="color: #888; font-size: 13px;">
          If you did not sign up for VASL, you can safely ignore this email.
        </p>
      </div>
    `,
    });
};
exports.sendVerificationEmail = sendVerificationEmail;
