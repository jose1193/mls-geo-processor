import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, city, county } = body;

    if (!address || !city || !county) {
      return NextResponse.json(
        { error: "Missing required fields: address, city, county" },
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

    // Ultra-specific fallback prompt for difficult cases
    const fallbackPrompt = `ESPECIALISTA EN COMUNIDADES DE FLORIDA - ANÁLISIS ESPECÍFICO REQUERIDO

DIRECCIÓN PROBLEMÁTICA: ${address}, ${city}, ${county}, FL

Esta dirección ha fallado en detección automática. Requiere análisis manual experto.

ESTRATEGIAS DE ANÁLISIS PRIORITARIAS:

1. BÚSQUEDA POR PROXIMIDAD GEOGRÁFICA:
   - Busca subdivisiones/comunidades dentro de 0.5 millas del área
   - Consulta vecindarios adyacentes y extiende búsqueda

2. PATRONES ESPECÍFICOS POR CONDADO:

BROWARD COUNTY (Hollywood, Dania Beach, Hallandale, Pompano):
- Hollywood: "Hollywood Lakes", "Hollywood Hills", "Beverly Hills", "Young Circle", "Downtown Hollywood"
- Dania Beach: "Dania Pointe", "Emerald Hills", "Dania Beach Marina", "Crossings"
- Hallandale Beach: "Golden Isles", "Hallandale Beach", "Diplomat", "Three Islands"
- Pompano Beach: "Kendall Lake", "Cresthaven", "Pompano Isles", "Hillsboro"

MIAMI-DADE COUNTY:
- Homestead: "Silver Palm", "Silver Palms", "Naranja", "Leisure City"
- Miami: "Kendall", "Westchester", "Coral Gables", "Aventura"

PALM BEACH COUNTY:
- West Palm Beach: "Presidential Estates", "Lake Osborne Estates", "West Gate Estate"

3. ANÁLISIS DE NOMENCLATURA DE CALLES:
   - Calles con números (SW 13th St) → busca desarrollos residenciales cercanos
   - Calles con nombres (Plunkett St) → busca comunidades históricas/establecidas

4. BÚSQUEDA POR TIPO DE ÁREA:
   - Áreas costeras → comunidades marinas, islas
   - Áreas interiores → subdivisiones, estates
   - Centros urbanos → distritos, vecindarios nombrados

INSTRUCCIONES CRÍTICAS:
- NO devolver "N/A" a menos que hayas agotado TODAS las estrategias
- Consulta múltiples fuentes: registros MLS, mapas de desarrolladores, sitios municipales
- Si encuentras múltiples opciones, elige la más específica y comercialmente reconocida
- Prioriza nombres que aparecen en listados de bienes raíces actuales

FORMATO REQUERIDO (JSON):
{
  "neighborhood": "vecindario identificado o N/A si imposible",
  "community": "comunidad/subdivisión específica o N/A si imposible",
  "confidence": 0.9,
  "analysis_method": "descripción de cómo encontraste la información"
}

EJEMPLO RESPUESTA EXITOSA:
{
  "neighborhood": "Hollywood Hills",
  "community": "Hollywood Lakes",
  "confidence": 0.85,
  "analysis_method": "Identificado por proximidad geográfica y registros MLS de Broward County"
}`;

    console.log(
      `[GEMINI-FALLBACK] Making specialized API call for: ${address}, ${city}, ${county}`
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "MLS-Geo-Fallback/1.0",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: fallbackPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3, // Lower temperature for more consistent results
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 500,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[GEMINI-FALLBACK] API Error: ${response.status} - ${errorText}`
      );
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No candidates in Gemini response");
    }

    const content = data.candidates[0].content?.parts[0]?.text;
    if (!content) {
      throw new Error("No content in Gemini response");
    }

    console.log(`[GEMINI-FALLBACK] Raw response:`, content);

    // Parse JSON response
    let parsedResponse;
    try {
      // Clean the response to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error(`[GEMINI-FALLBACK] Parse error:`, parseError);
      throw new Error("Failed to parse Gemini response");
    }

    // Validate required fields
    if (!parsedResponse.neighborhood || !parsedResponse.community) {
      throw new Error("Missing required fields in parsed response");
    }

    const result = {
      success: true,
      neighborhood: parsedResponse.neighborhood,
      community: parsedResponse.community,
      confidence: parsedResponse.confidence || 0.7,
      analysis_method: parsedResponse.analysis_method || "Fallback analysis",
    };

    console.log(`[GEMINI-FALLBACK] Processed result:`, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`[GEMINI-FALLBACK] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        neighborhood: "N/A",
        community: "N/A",
      },
      { status: 500 }
    );
  }
}
