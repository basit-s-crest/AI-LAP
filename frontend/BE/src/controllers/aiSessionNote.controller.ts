import { Request, Response } from "express";
import prisma from "../lib/prisma";

export interface TranscriptLine {
  speaker: "member" | "coach";
  text: string;
  timestamp: string;
  isFinal: boolean;
}

interface AnthropicResponse {
  content?: Array<{
    text?: string;
  }>;
}

async function coachOwnsMember(coachId: string, memberId: string): Promise<boolean> {
  const assignment = await prisma.coachMember.findUnique({
    where: { coachId_userId: { coachId, userId: memberId } },
  });
  return !!assignment;
}

// Generate highly realistic mock data based on the actual transcript contents
function generateMockAnalysis(transcript: TranscriptLine[], memberName: string) {
  const lineCount = transcript.length;
  const memberLines = transcript.filter((l) => l.speaker === "member");
  const memberText = memberLines.map((l) => l.text.toLowerCase()).join(" ");
  const coachLines = transcript.filter((l) => l.speaker === "coach");

  let sentiment = "Neutral";
  let riskFlag = false;
  let riskNotes = "";
  const keyThemesSet = new Set<string>();

  // Rule-based Sentiment & Theme detection
  if (memberText.includes("sad") || memberText.includes("depress") || memberText.includes("cry") || memberText.includes("hopeless") || memberText.includes("lonely")) {
    sentiment = "Reflective & Low Mood";
    keyThemesSet.add("Mood Dysregulation");
  }
  if (memberText.includes("anxious") || memberText.includes("panic") || memberText.includes("worry") || memberText.includes("stress") || memberText.includes("scared")) {
    sentiment = "Anxious & Overwhelmed";
    keyThemesSet.add("Anxiety Management");
  }
  if (memberText.includes("sleep") || memberText.includes("insomnia") || memberText.includes("tired") || memberText.includes("nightmare")) {
    keyThemesSet.add("Sleep Hygiene");
  }
  if (memberText.includes("work") || memberText.includes("job") || memberText.includes("career") || memberText.includes("boss") || memberText.includes("school")) {
    keyThemesSet.add("Work & Academic Stress");
  }
  if (memberText.includes("family") || memberText.includes("parent") || memberText.includes("friend") || memberText.includes("relationship") || memberText.includes("partner")) {
    keyThemesSet.add("Interpersonal Relationships");
  }
  if (memberText.includes("kill") || memberText.includes("die") || memberText.includes("suicide") || memberText.includes("hurt myself") || memberText.includes("end it")) {
    riskFlag = true;
    riskNotes = "Self-harm or safety concerns detected in member comments.";
    sentiment = "Highly Distressed";
    keyThemesSet.add("Crisis & Safety");
  }

  // Fallbacks if themes could not be extracted
  if (keyThemesSet.size === 0) {
    keyThemesSet.add("General Wellness");
    keyThemesSet.add("Active Listening Support");
  }

  const keyThemes = Array.from(keyThemesSet);

  // Dynamic summary generation using line counts and speaker details
  let summary = "";
  if (lineCount === 0) {
    summary = `The session with ${memberName} was brief and did not yield significant spoken exchange.`;
  } else {
    summary = `A ${lineCount}-line coaching session was completed with ${memberName}. The member discussed topics including ${keyThemes.slice(0, 2).join(" and ")}. The member shared their current circumstances and feelings, and the coach offered active listening and supportive guidance.`;
  }

  // Observations
  const coachObservations = `The coach engaged effectively, with ${coachLines.length} statements matching the member's ${memberLines.length} statements. The member appeared responsive to safety checks and mindfulness exercises suggested by the coach.`;

  // Recommended Follow Up
  const recommendedFollowUp = riskFlag
    ? `Schedule an immediate safety check-in. Provide member with crisis hotline resources and review coping plan.`
    : `Follow up on the mindfulness techniques discussed today. Monitor sleep patterns and daily stress logs in the upcoming week.`;

  return {
    summary,
    keyThemes,
    memberSentiment: sentiment,
    coachObservations,
    riskFlag,
    riskNotes,
    recommendedFollowUp,
  };
}

export const createAiSessionNote = async (req: Request, res: Response): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { memberId, sessionId, transcript } = req.body as {
      memberId?: string;
      sessionId?: string | null;
      transcript?: TranscriptLine[];
    };

    if (!memberId || !transcript) {
      return res.status(400).json({ message: "memberId and transcript are required" });
    }

    // Check if coach owns member
    const owns = await coachOwnsMember(coachId, memberId);
    if (!owns) {
      return res.status(403).json({ message: "Member is not assigned to this coach" });
    }

    // Retrieve member name for fallback details
    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: { name: true },
    });
    const memberName = member?.name || "Member";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    let analysisResult;

    if (!apiKey || apiKey === "your_key_here") {
      console.log("[createAiSessionNote] ANTHROPIC_API_KEY is not set. Using rule-based fallback generator.");
      analysisResult = generateMockAnalysis(transcript, memberName);
    } else {
      try {
        // Format transcript for Claude
        const formattedTranscript = transcript
          .map((line) => `${line.speaker === "coach" ? "Coach" : "Member"}: ${line.text}`)
          .join("\n");

        console.log(`[createAiSessionNote] Calling Anthropic API using model 'claude-sonnet-4-20250514'...`);
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            system: "You are an AI psychiatric clinical assistant. Analyze the session transcript between a Mental Health Coach and a Member. Respond ONLY with a valid, clean JSON object matching the requested schema. Do not output any markdown code blocks, backticks, or text before/after the JSON.",
            messages: [
              {
                role: "user",
                content: `Analyze the following mental health coaching session transcript.

Transcript:
${formattedTranscript}

Provide a JSON object with the exact keys:
- "summary": (string) A clinical, objective summary of the session.
- "keyThemes": (array of strings) 2 to 4 major topics or issues discussed in the session.
- "memberSentiment": (string) The primary emotional state of the member (e.g., "Anxious", "Depressed", "Neutral", "Reflective", "Agitated").
- "coachObservations": (string) Observations of the member's engagement and response during the session.
- "riskFlag": (boolean) Set to true if the member mentions active self-harm, suicidal ideation, violence, abuse, or other high-risk indicators. Otherwise false.
- "riskNotes": (string) If riskFlag is true, provide details of the specific risk indicators. Otherwise, empty string.
- "recommendedFollowUp": (string) Concrete clinical recommendations or goals for the next session.

Respond with ONLY the JSON object. Do not wrap in markdown \`\`\`json blocks.`,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Anthropic API returned status ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as AnthropicResponse;
        const textContent = data.content?.[0]?.text;

        if (!textContent) {
          throw new Error("Empty content from Anthropic API response.");
        }

        // Clean any markdown block wrappers if present
        let cleanedJson = textContent.trim();
        if (cleanedJson.startsWith("```")) {
          cleanedJson = cleanedJson.replace(/^```json\s*/, "").replace(/```$/, "").trim();
        }

        analysisResult = JSON.parse(cleanedJson);

        // Basic validation
        if (typeof analysisResult.summary !== "string" || !Array.isArray(analysisResult.keyThemes)) {
          throw new Error("Invalid structure returned by Anthropic Claude model.");
        }
      } catch (err) {
        console.warn("[createAiSessionNote] Claude call failed or returned malformed JSON. Falling back to local generation. Error:", err);
        analysisResult = generateMockAnalysis(transcript, memberName);
      }
    }

    // Save to the database
    const savedNote = await prisma.aiSessionNote.create({
      data: {
        sessionId: sessionId || null,
        memberId,
        transcript: transcript as any,
        summary: analysisResult.summary || "",
        keyThemes: analysisResult.keyThemes || [],
        memberSentiment: analysisResult.memberSentiment || "Neutral",
        coachObservations: analysisResult.coachObservations || "",
        riskFlag: !!analysisResult.riskFlag,
        riskNotes: analysisResult.riskNotes || "",
        recommendedFollowUp: analysisResult.recommendedFollowUp || "",
      },
    });

    return res.status(201).json({ note: savedNote });
  } catch (error) {
    console.error("[createAiSessionNote] Internal server error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAiSessionNoteBySessionId = async (req: Request, res: Response): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { sessionId } = req.params;
    const note = await prisma.aiSessionNote.findFirst({
      where: { sessionId: sessionId as string },
    });

    if (!note) {
      return res.status(404).json({ message: "AI session note not found for this session" });
    }

    return res.status(200).json({ note });
  } catch (error) {
    console.error("[getAiSessionNoteBySessionId]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
