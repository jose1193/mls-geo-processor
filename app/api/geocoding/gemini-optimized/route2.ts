import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Optimized Gemini API for high-performance MLS processing
export async function POST(request: NextRequest) {
  const startTime = performance.now();

  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { address, city, county } = await request.json();

    if (!address || !city || !county) {
      return NextResponse.json(
        {
          error: "Address, city, and county are required",
        },
        { status: 400 }
      );
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Highly optimized prompt for speed and accuracy
    const optimizedPrompt = `FLORIDA ADDRESS ANALYSIS - JSON ONLY RESPONSE:

Address: ${address}, ${city}, ${county}, FL

Return exact JSON format (no explanations):
{
  "neighborhood": "neighborhood name or null",
  "community": "community/subdivision name or null", 
  "confidence": 0.85
}

Requirements:
- neighborhood: General area/district name
- community: Specific subdivision/development name  
- Use null for unknown values
- Clean names only (no "Sec 1", "Phase 2", etc.)
- confidence: 0.0 to 1.0
- Florida locations only
- JSON only, no other text`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: optimizedPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.1,
            maxOutputTokens: 150,
            stopSequences: ["}"],
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE",
            },
          ],
        }),
      }
    );

    const processingTime = performance.now() - startTime;

    if (!response.ok) {
      const status = response.status;
      const errorBody = await response
        .text()
        .catch(() => "Unable to read error body");

      let errorMessage = `Gemini API error: ${status}`;
      if (status === 401) {
        errorMessage = "Invalid Gemini API key";
      } else if (status === 403) {
        errorMessage = "Gemini API access denied";
      } else if (status === 429) {
        errorMessage = "Gemini rate limit exceeded";
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        status,
        processing_time_ms: Math.round(processingTime),
        debug_info: errorBody.substring(0, 500),
      });
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No response candidates from Gemini",
        processing_time_ms: Math.round(processingTime),
      });
    }

    const candidate = data.candidates[0];

    // Check if response was blocked
    if (candidate.finishReason === "SAFETY") {
      return NextResponse.json({
        success: false,
        error: "Response blocked by safety filters",
        processing_time_ms: Math.round(processingTime),
      });
    }

    const content = candidate.content?.parts?.[0]?.text;

    if (!content) {
      return NextResponse.json({
        success: false,
        error: "Empty content from Gemini",
        processing_time_ms: Math.round(processingTime),
      });
    }

    try {
      // Aggressive JSON extraction and cleaning
      let cleanedContent = content.trim();

      // Remove markdown formatting
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*/, "");
      cleanedContent = cleanedContent.replace(/\s*```$/, "");

      // Extract JSON object
      const jsonMatch = cleanedContent.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found");
      }

      const parsedResult = JSON.parse(jsonMatch[0]);

      // Validate and normalize
      const neighborhood = normalizeValue(parsedResult.neighborhood);
      const community = normalizeValue(parsedResult.community);
      const confidence = normalizeConfidence(parsedResult.confidence);

      return NextResponse.json({
        success: true,
        neighborhood,
        community,
        confidence,
        processing_time_ms: Math.round(processingTime),
        input_address: `${address}, ${city}, ${county}, FL`,
        response_quality: {
          json_parsed: true,
          has_neighborhood: neighborhood !== null,
          has_community: community !== null,
          raw_length: content.length,
        },
      });
    } catch (parseError) {
      console.error("Gemini JSON parsing failed:", parseError);

      // Regex fallback extraction
      const neighborhoodRegex =
        /(?:neighborhood|vecindario)['":\s]*["']([^"']+?)["']/i;
      const communityRegex =
        /(?:community|comunidad|subdivision)['":\s]*["']([^"']+?)["']/i;

      const neighborhoodMatch = content.match(neighborhoodRegex);
      const communityMatch = content.match(communityRegex);

      const neighborhood = neighborhoodMatch
        ? normalizeValue(neighborhoodMatch[1])
        : null;
      const community = communityMatch
        ? normalizeValue(communityMatch[1])
        : null;

      if (neighborhood || community) {
        return NextResponse.json({
          success: true,
          neighborhood,
          community,
          confidence: 0.3, // Lower confidence for regex parsing
          processing_time_ms: Math.round(processingTime),
          parsing_method: "regex_fallback",
          raw_content: content.substring(0, 200),
        });
      }

      return NextResponse.json({
        success: false,
        error: "Failed to parse Gemini response",
        processing_time_ms: Math.round(processingTime),
        raw_content: content.substring(0, 200),
        parse_error:
          parseError instanceof Error ? parseError.message : "Unknown error",
      });
    }
  } catch (error) {
    const processingTime = performance.now() - startTime;
    console.error("Gemini API request failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processing_time_ms: Math.round(processingTime),
      },
      { status: 500 }
    );
  }
}

// Utility functions for data normalization
function normalizeValue(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();

  // Check for null/empty indicators
  const nullIndicators = [
    "null",
    "n/a",
    "na",
    "none",
    "unknown",
    "not available",
    "no disponible",
  ];
  if (nullIndicators.includes(normalized) || normalized === "") {
    return null;
  }

  // Clean up the value
  let cleaned = value.trim();

  // Remove common suffixes that should be cleaned
  const suffixesToRemove = [
    /\s+sec\s+\d+$/i,
    /\s+section\s+\d+$/i,
    /\s+phase\s+\d+[a-z]*$/i,
    /\s+unit\s+\d+$/i,
    /\s+plat\s+\d+$/i,
    /\s+addition$/i,
    /\s+\d+(?:st|nd|rd|th)\s+sec$/i,
  ];

  for (const suffix of suffixesToRemove) {
    cleaned = cleaned.replace(suffix, "");
  }

  return cleaned.trim() || null;
}

function normalizeConfidence(value: unknown): number {
  if (typeof value === "number") {
    return Math.min(Math.max(value, 0), 1);
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return Math.min(Math.max(parsed, 0), 1);
    }
  }

  return 0.5; // Default confidence
}
