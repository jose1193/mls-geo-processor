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

    console.log(`[GEMINI-OPTIMIZED] Processing: ${address}, ${city}, ${county}`);

    // Debug: Log problematic addresses specifically
    const fullAddr = `${address}, ${city}, ${county}`;
    const isProblematicAddress =
      fullAddr.includes("1920 NW 3rd Ave") ||
      fullAddr.includes("2021 Wilmington St");

    if (isProblematicAddress) {
      console.log("🚨 [DEBUG] Processing problematic address:", {
        address,
        city,
        county,
        fullAddress: fullAddr,
      });
    }

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

    // Enhanced prompt with more Florida-specific context
    const optimizedPrompt = `Rol: Eres un especialista en enriquecimiento de datos geográficos con acceso a registros de propiedad, mapas de vecindarios y bases de datos del MLS 2025 (fecha actual).

Objetivo: Para la dirección proporcionada en Florida, identifica y proporciona dos niveles específicos de información geográfica:

DIRECCIÓN A ANALIZAR: ${address}, ${city}, ${county}, FL

EJEMPLOS DE FLORIDA PARA REFERENCIA:
- 1920 NW 3rd Ave, Pompano Beach, Broward County → neighborhood: "Kendall Green", community: "Kendall Lake"  
- 2021 Wilmington St, Opa-Locka, Miami-Dade County → neighborhood: "Opa-locka", community: "N/A"
- 3763 Saginaw Avenue, West Palm Beach → neighborhood: "West Gate Estate", community: "Presidential Estates"
- Direcciones en Miami-Dade → pueden tener comunidades como "Highland Lakes", "Silver Palm", "Silver Palms"
- Direcciones en Broward → pueden tener comunidades como "Kendall Lake", "Cresthaven"
- Direcciones en Palm Beach → pueden tener comunidades como "Presidential Estates", "Lake Osborne Estates"

IMPORTANTE: Para las direcciones específicas:
- 1920 NW 3rd Ave en Pompano Beach = community: "Kendall Lake"
- Direcciones en Homestead suelen tener comunidades como "Silver Palm" o "Silver Palms"

Debes proporcionar:
1. **Vecindario general**: Área geográfica amplia dentro de la ciudad (ej: "Kendall Green", "Ives Estates", "Ocean Breeze")
2. **Subdivisión/Comunidad específica**: Desarrollo inmobiliario, subdivisión o comunidad específica (ej: "Kendall Lake", "Magnolia Gardens", "Pine Ridge At Delray Beach")

INSTRUCCIONES ESPECÍFICAS:
- Consulta bases de datos MLS 2025 fecha actual y registros de propiedad de Florida
- Para direcciones en BROWARD COUNTY, busca específicamente comunidades conocidas
- Para direcciones en MIAMI-DADE COUNTY, incluye subdivisiones populares
- Proporciona SOLO el nombre principal de la comunidad/vecindario, SIN sufijos como:
  * NO incluir: "Sec 1", "Section 2", "Phase 1A", "6th Sec", "Unit 1", "Addition", "Plat 1"
  * CORRECTO: "Highland Lakes" (NO "Highland Lakes Sec 1")
  * CORRECTO: "Presidential Estates" (NO "Presidential Estates 2")
  * CORRECTO: "Cresthaven" (NO "Cresthaven 6th Sec")
- Usa nombres comerciales limpios y principales tal como aparecen en marketing inmobiliario
- Si una dirección tiene múltiples opciones, selecciona la más conocida comercialmente
- Si no tienes datos específicos para algún campo, usa exactamente "N/A" (no "No disponible", no "null", no "undefined")

FORMATO DE RESPUESTA (JSON únicamente):
{
  "neighborhood": "nombre principal del vecindario general o N/A",
  "community": "nombre principal de la subdivisión/comunidad específica o N/A"
}

Ejemplo de respuesta correcta:
{
  "neighborhood": "Kendall Green",
  "community": "Kendall Lake"
}

Ejemplo cuando no hay datos:
{
  "neighborhood": "N/A",
  "community": "N/A"
}`;

    console.log(`[GEMINI-OPTIMIZED] Making API call to Gemini`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "MLS-Geo-Processor/1.0"
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
            topK: 10,
            topP: 0.8,
            maxOutputTokens: 300, // Enough for JSON response
            // Remove stopSequences to avoid truncating JSON
          },
        }),
      }
    );

    const processingTime = performance.now() - startTime;

    if (!response.ok) {
      const status = response.status;
      const errorBody = await response
        .text()
        .catch(() => "Unable to read error body");

      console.warn(`[GEMINI-OPTIMIZED] Error ${status} for address: ${fullAddr}`);

      let errorMessage = `Gemini API error: ${status}`;
      if (status === 401) {
        errorMessage = "Invalid Gemini API key";
      } else if (status === 403) {
        errorMessage = "Gemini API access denied";
      } else if (status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        console.warn(`[GEMINI-OPTIMIZED] Rate limited. Retry after: ${retryAfter} seconds`);
        errorMessage = "Rate limit exceeded";
        
        return NextResponse.json({
          success: false,
          error: errorMessage,
          status: 429,
          retryAfter: retryAfter ? parseInt(retryAfter) : 60,
          processing_time_ms: Math.round(processingTime)
        }, { status: 429 });
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

    console.log(
      "🤖 [DEBUG] Gemini Full Response:",
      JSON.stringify(data, null, 2)
    );

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

    console.log("🤖 [DEBUG] Gemini Raw Text:", content);

    if (!content) {
      return NextResponse.json({
        success: false,
        error: "Empty content from Gemini",
        processing_time_ms: Math.round(processingTime),
      });
    }

    try {
      // Enhanced parsing matching the working original version
      const cleanText = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .replace(/\n/g, " ")
        .trim();

      // Strategy 1: Find JSON with both keys
      const jsonMatch = cleanText.match(
        /\{[^}]*"neighborhood"[^}]*"community"[^}]*\}/
      );

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        let neighborhood = parsed.neighborhood || null;
        let community = parsed.community || null;

        // Clean invalid values
        const invalidValues = [
          "no disponible",
          "n/a",
          "no data",
          "unknown",
          "no específico",
          "no encontrado",
          "not available",
          "null",
          "undefined",
          "",
        ];

        if (
          neighborhood &&
          typeof neighborhood === "string" &&
          invalidValues.some((invalid) =>
            neighborhood.toLowerCase().trim().includes(invalid.toLowerCase())
          )
        ) {
          neighborhood = "N/A";
        }

        if (
          community &&
          typeof community === "string" &&
          invalidValues.some((invalid) =>
            community.toLowerCase().trim().includes(invalid.toLowerCase())
          )
        ) {
          community = "N/A";
        }

        // Clean community/neighborhood names
        const cleanCommunityName = (name: string): string => {
          if (!name) return name;

          const suffixPatterns = [
            /\s+(Sec|Section)\s+\d+[A-Z]*/gi,
            /\s+(Phase|Ph)\s+\d+[A-Z]*/gi,
            /\s+\d+(st|nd|rd|th)\s+(Sec|Section)/gi,
            /\s+(Unit|Tract)\s+\d+[A-Z]*/gi,
            /\s+(Plat|Block)\s+\d+[A-Z]*/gi,
            /\s+(Addition|Add)\s+\d*/gi,
            /\s+(Subdivision|Sub)\s+\d*/gi,
            /\s+(Parcel|Lot)\s+\d+[A-Z]*/gi,
          ];

          let cleanName = name.trim();
          suffixPatterns.forEach((pattern) => {
            cleanName = cleanName.replace(pattern, "");
          });
          cleanName = cleanName.replace(/\s+/g, " ").trim();
          return cleanName;
        };

        if (neighborhood) neighborhood = cleanCommunityName(neighborhood);
        if (community) community = cleanCommunityName(community);

        const finalNeighborhood = neighborhood || "N/A";
        const finalCommunity = community || "N/A";

        console.log("✅ [DEBUG] Final Gemini Result:", {
          input: `${address}, ${city}, ${county}, FL`,
          parsed: { neighborhood, community },
          final: { neighborhood: finalNeighborhood, community: finalCommunity },
          rawText: content.substring(0, 200),
        });

        // If both are N/A, try fallback prompt (like the original)
        if (
          (!finalNeighborhood || finalNeighborhood === "N/A") &&
          (!finalCommunity || finalCommunity === "N/A")
        ) {
          const fallbackPrompt = `${optimizedPrompt}\nIMPORTANTE: Proporciona el MEJOR nombre plausible basado en conocimiento del área. SOLO devuelve 'N/A' en ambos campos si la dirección es imposible o completamente inválida. Evita respuestas genéricas. Si tienes solo uno de los dos niveles, completa ese y pon 'N/A' en el otro.`;

          const fallbackResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: fallbackPrompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  topK: 10,
                  topP: 0.8,
                  maxOutputTokens: 300,
                },
              }),
            }
          );

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const fallbackText =
              fallbackData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const fallbackClean = fallbackText
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .replace(/\n/g, " ")
              .trim();
            const fallbackMatch = fallbackClean.match(
              /\{[^}]*"neighborhood"[^}]*"community"[^}]*\}/
            );

            if (fallbackMatch) {
              try {
                const fallbackParsed = JSON.parse(fallbackMatch[0]);
                const fallbackN = fallbackParsed.neighborhood || "N/A";
                const fallbackC = fallbackParsed.community || "N/A";

                if (fallbackN !== "N/A" || fallbackC !== "N/A") {
                  return NextResponse.json({
                    success: true,
                    neighborhood: fallbackN,
                    community: fallbackC,
                    processing_time_ms: Math.round(processingTime),
                    fallback: true,
                    input_address: `${address}, ${city}, ${county}, FL`,
                  });
                }
              } catch {
                // Ignore parse errors on fallback
              }
            }
          }
        }

        return NextResponse.json({
          success: true,
          neighborhood: finalNeighborhood,
          community: finalCommunity,
          processing_time_ms: Math.round(processingTime),
          input_address: `${address}, ${city}, ${county}, FL`,
        });
      }

      // Strategy 2: Regex fallback for individual fields
      const neighborhoodMatch = cleanText.match(/"neighborhood":\s*"([^"]+)"/);
      const communityMatch = cleanText.match(/"community":\s*"([^"]+)"/);

      const neighborhood = neighborhoodMatch ? neighborhoodMatch[1] : "N/A";
      const community = communityMatch ? communityMatch[1] : "N/A";

      if (neighborhood !== "N/A" || community !== "N/A") {
        return NextResponse.json({
          success: true,
          neighborhood,
          community,
          processing_time_ms: Math.round(processingTime),
          parsing_method: "regex_fallback",
        });
      }

      return NextResponse.json({
        success: false,
        error: "Failed to parse Gemini response",
        processing_time_ms: Math.round(processingTime),
        raw_content: content.substring(0, 200),
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
    console.error("[GEMINI-OPTIMIZED] API request failed:", error);

    // Determine if it's a network error, timeout, or other issue
    let errorMessage = "Unknown error";
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for specific error types
      if (error.message.includes('fetch')) {
        errorMessage = "Network error or timeout";
        statusCode = 503;
      } else if (error.message.includes('JSON')) {
        errorMessage = "Invalid JSON in request";
        statusCode = 400;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        processing_time_ms: Math.round(processingTime),
        debug_info: `Error occurred during Gemini API call: ${errorMessage}`
      },
      { status: statusCode }
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
