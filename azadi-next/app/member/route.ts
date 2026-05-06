/**
 * GET /member
 * Serves the original Azadi HTML prototype with a small injected script
 * that silently hooks into sendChatMsg() to forward member messages
 * through BullMQ → LLM inference → dashboard.
 *
 * The member sees ZERO difference — the chat works exactly as before.
 * The injection only adds a background fetch to /api/chat.
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

// Member token for "Amara Johnson" — the logged-in member in the prototype
const MEMBER_TOKEN = process.env.MEMBER_TOKEN_AMARA ?? "mbr_bf18c4d442624cd09a06";
const ORG_ID = process.env.ORG_ID ?? "org_univ_maryland";

// The injection script — patches sendChatMsg after the page loads.
// It wraps the original function: original behaviour runs first (so the
// member sees the normal chat), then silently fires off the BullMQ job.
// No result is ever shown in the member chat.
const INJECTION = `
<script>
(function() {
  // Wait for the prototype's render engine to be ready
  function patchSendChatMsg() {
    if (typeof sendChatMsg === 'undefined') {
      setTimeout(patchSendChatMsg, 100);
      return;
    }

    const _original = sendChatMsg;

    window.sendChatMsg = function() {
      // 1. Run the original — member sees normal chat behaviour
      const input = document.getElementById('chat-input');
      const text = (input?.value || '').trim();

      _original.apply(this, arguments);

      // 2. Only fire inference when the member is in a coaching chat
      //    (S.role === 'user' and S.coachView === 'chat')
      if (!text) return;
      if (typeof S === 'undefined') return;
      if (S.role !== 'user') return;
      if (S.coachView !== 'chat' || !S.selCoach) return;

      // 3. Silently enqueue via BullMQ — no UI feedback to member
      const eventId = 'evt_' + Math.random().toString(36).slice(2, 18);
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          org_id: '${ORG_ID}',
          member_token: '${MEMBER_TOKEN}',
          session_id: 'sess_member_coach_' + S.selCoach,
          text: text,
          client_name: 'Amara Johnson',
          role: 'member',
        }),
      }).catch(function() {
        // Silently ignore — never surface errors to the member
      });
    };
  }

  // Patch after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchSendChatMsg);
  } else {
    patchSendChatMsg();
  }
})();
</script>
`;

export async function GET(_req: NextRequest) {
  try {
    // Read the HTML file from the frontend directory
    const htmlPath = join(process.cwd(), "..", "frontend", "azadi-v5-prototype 2.html");
    let html = readFileSync(htmlPath, "utf-8");

    // Inject our script just before </body>
    html = html.replace("</body>", `${INJECTION}\n</body>`);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/member] Failed to read HTML file:", err);
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px">
        <h2>Could not load member app</h2>
        <p>Make sure <code>frontend/azadi-v5-prototype 2.html</code> exists at the project root.</p>
        <p style="color:#999;font-size:12px">${String(err)}</p>
      </body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
