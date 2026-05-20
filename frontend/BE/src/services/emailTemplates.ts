/** VASL / Azadi Health email layout — matches app palette (canvas, sage, ink). */

export interface AppEmailContent {
  title: string;
  greeting?: string;
  lines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

const BRAND = {
  sage: "#4E8C58",
  canvas: "#F4EFE6",
  card: "#FDFAF5",
  ink: "#1E1A16",
  mid: "#5C5248",
  dim: "#9C9188",
  line: "rgba(60,50,40,0.10)",
};

export function buildAppEmailHtml(content: AppEmailContent): string {
  const greeting = content.greeting
    ? `<p style="margin:0 0 16px;color:${BRAND.mid};font-size:15px;line-height:1.5;">${escapeHtml(content.greeting)}</p>`
    : "";

  const bodyLines = content.lines
    .map(
      (line) =>
        `<p style="margin:0 0 12px;color:${BRAND.mid};font-size:15px;line-height:1.55;">${escapeHtml(line)}</p>`
    )
    .join("");

  const cta =
    content.ctaLabel && content.ctaUrl
      ? `<p style="margin:28px 0 0;text-align:center;">
          <a href="${escapeHtml(content.ctaUrl)}" style="display:inline-block;padding:12px 28px;background:${BRAND.sage};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:9px;">${escapeHtml(content.ctaLabel)}</a>
        </p>`
      : "";

  const footer = content.footerNote
    ? `<p style="margin:24px 0 0;color:${BRAND.dim};font-size:12px;line-height:1.5;">${escapeHtml(content.footerNote)}</p>`
    : `<p style="margin:24px 0 0;color:${BRAND.dim};font-size:12px;line-height:1.5;">You can manage email alerts in your portal settings.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${BRAND.canvas};font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.canvas};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
        <tr><td style="padding:0 0 20px;text-align:center;">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:${BRAND.ink};">Azadi Health</span>
          <div style="margin-top:6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.sage};">VASL</div>
        </td></tr>
        <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:14px;padding:28px 26px;box-shadow:0 2px 12px rgba(30,26,22,0.06);">
          <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:${BRAND.ink};line-height:1.3;">${escapeHtml(content.title)}</h1>
          ${greeting}
          ${bodyLines}
          ${cta}
          ${footer}
        </td></tr>
        <tr><td style="padding:20px 8px 0;text-align:center;font-size:11px;color:${BRAND.dim};">
          © ${new Date().getFullYear()} Azadi Health · Culturally responsive mental wellness
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatEmailDateTime(iso: Date | string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
