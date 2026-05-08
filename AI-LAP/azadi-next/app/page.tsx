import Link from "next/link";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "#1E1A16", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "32px", padding: "40px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 64, fontWeight: 700, color: "#FDFAF5", letterSpacing: "2px", lineHeight: 1 }}>
          VASL Health
        </div>
        <div style={{ color: "rgba(253,250,245,0.42)", fontSize: "12px", letterSpacing: "3px", textTransform: "uppercase", marginTop: "10px" }}>
          Mental Wellness Platform
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/member" style={{ padding: "14px 28px", background: "#4E8C58", color: "white", borderRadius: "12px", textDecoration: "none", fontWeight: 700, fontSize: "15px", fontFamily: "'Nunito', sans-serif" }}>
          🌿 Member App
        </Link>
        <Link href="/dashboard" style={{ padding: "14px 28px", background: "rgba(255,255,255,0.08)", color: "#FDFAF5", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: "12px", textDecoration: "none", fontWeight: 700, fontSize: "15px", fontFamily: "'Nunito', sans-serif" }}>
          📊 Live Dashboard
        </Link>
        <Link href="/coach/messages" style={{ padding: "14px 28px", background: "rgba(58,110,153,0.25)", color: "#5A9EC8", border: "1.5px solid rgba(58,110,153,0.4)", borderRadius: "12px", textDecoration: "none", fontWeight: 700, fontSize: "15px", fontFamily: "'Nunito', sans-serif" }}>
          🧑‍⚕️ Coach Messages
        </Link>
      </div>

      <div style={{ color: "rgba(253,250,245,0.28)", fontSize: "13px", textAlign: "center", maxWidth: "480px", lineHeight: 1.7 }}>
        <strong style={{ color: "rgba(253,250,245,0.55)" }}>Flow:</strong> Member App → Coaching → select coach → send message<br />
        → BullMQ → LLM inference → scores update live on Dashboard
      </div>
    </div>
  );
}
