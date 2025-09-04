import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { address, context } = await request.json();

    if (!address) {
      return NextResponse.json({ error: "Address required" }, { status: 400 });
    }

    const geminiKey =
      process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // PROMPT PRINCIPAL
    const prompt = `Rol: Eres un especialista en enriquecimiento de datos geográficos con acceso a registros de propiedad, mapas de vecindarios y bases de datos del MLS 2025 (fecha actual).

Objetivo: Para la dirección proporcionada, identifica y proporciona dos niveles específicos de información geográfica:

DIRECCIÓN A ANALIZAR: ${address}
${context ? `\nContexto adicional (sugerencias de otras APIs / hints): ${context}` : ""}

Debes proporcionar:
1. **Vecindario general**: Área geográfica amplia dentro de la ciudad (ej: "Kendall Green", "Ives Estates", "Ocean Breeze")
2. **Subdivisión/Comunidad específica**: Desarrollo inmobiliario, subdivisión o comunidad específica (ej: "Kendall Lake", "Magnolia Gardens", "Pine Ridge At Delray Beach")

INSTRUCCIONES ESPECÍFICAS:
- Consulta bases de datos MLS 2025 fecha actual y registros de propiedad de Florida
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

    const callGemini = async (p: string) => {
      return fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: p,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 10,
            topP: 0.8,
            maxOutputTokens: 300, // suficiente para JSON pequeño
            // stopSequences eliminado para evitar truncar la llave de cierre prematuramente
          },
        }),
      });
    };

    let response = await callGemini(prompt);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorText}`);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No response from Gemini",
      });
    }

    const text = data.candidates[0].content.parts[0].text;

    try {
      // PARSING MEJORADO CON MÚLTIPLES ESTRATEGIAS (exact copy from config.js)
      const cleanText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .replace(/\n/g, " ")
        .trim();

      // Estrategia 1: Buscar JSON completo
      const jsonMatch = cleanText.match(
        /\{[^}]*"neighborhood"[^}]*"community"[^}]*\}/
      );

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        let neighborhood = parsed.neighborhood || null;
        let community = parsed.community || null;

        // Limpiar valores inválidos o genéricos
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

        // Limpiar sufijos innecesarios de comunidades/vecindarios
        const cleanCommunityName = (name: string): string => {
          if (!name) return name;

          // Patrones de sufijos a remover
          const suffixPatterns = [
            /\s+(Sec|Section)\s+\d+[A-Z]*/gi, // "Sec 1", "Section 2A"
            /\s+(Phase|Ph)\s+\d+[A-Z]*/gi, // "Phase 1A", "Ph 2B"
            /\s+\d+(st|nd|rd|th)\s+(Sec|Section)/gi, // "6th Sec", "1st Section"
            /\s+(Unit|Tract)\s+\d+[A-Z]*/gi, // "Unit 1", "Tract 2A"
            /\s+(Plat|Block)\s+\d+[A-Z]*/gi, // "Plat 1", "Block 2A"
            /\s+(Addition|Add)\s+\d*/gi, // "Addition 1", "Add"
            /\s+(Subdivision|Sub)\s+\d*/gi, // "Subdivision 1", "Sub"
            /\s+(Parcel|Lot)\s+\d+[A-Z]*/gi, // "Parcel 1A", "Lot 2B"
          ];

          let cleanName = name.trim();

          // Aplicar todos los patrones de limpieza
          suffixPatterns.forEach((pattern) => {
            cleanName = cleanName.replace(pattern, "");
          });

          // Limpiar espacios múltiples y trim final
          cleanName = cleanName.replace(/\s+/g, " ").trim();

          return cleanName;
        };

        // Aplicar limpieza a neighborhood y community
        if (neighborhood) {
          neighborhood = cleanCommunityName(neighborhood);
        }

        if (community) {
          community = cleanCommunityName(community);
        }

        const finalNeighborhood = neighborhood || "N/A";
        const finalCommunity = community || "N/A";

        // If both ended up as N/A treat as no data (so frontend can retry / use fallback)
        if (
          (!finalNeighborhood || finalNeighborhood === "N/A") &&
          (!finalCommunity || finalCommunity === "N/A")
        ) {
          // Segundo intento con prompt reforzado (menos permisivo con doble N/A)
          const fallbackPrompt = `${prompt}\nIMPORTANTE: Proporciona el MEJOR nombre plausible basado en conocimiento del área. SOLO devuelve 'N/A' en ambos campos si la dirección es imposible o completamente inválida. Evita respuestas genéricas. Si tienes solo uno de los dos niveles, completa ese y pon 'N/A' en el otro.`;
          response = await callGemini(fallbackPrompt);
          if (!response.ok) {
            return NextResponse.json({
              success: false,
              error: `Fallback Gemini API error: ${response.status}`,
              neighborhood: "N/A",
              community: "N/A",
              rawResponse: cleanText,
            });
          }
          const data2 = await response.json();
          const text2 = data2.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const cleanText2 = text2
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .replace(/\n/g, " ")
            .trim();
          const jsonMatch2 = cleanText2.match(
            /\{[^}]*"neighborhood"[^}]*"community"[^}]*\}/
          );
          if (jsonMatch2) {
            try {
              const parsed2 = JSON.parse(jsonMatch2[0]);
              const n2 = parsed2.neighborhood || "N/A";
              const c2 = parsed2.community || "N/A";
              if (n2 !== "N/A" || c2 !== "N/A") {
                return NextResponse.json({
                  success: true,
                  neighborhood: n2,
                  community: c2,
                  fallback: true,
                });
              }
            } catch {
              // ignore parse errors fallback
            }
          }
          return NextResponse.json({
            success: false,
            error: "No neighborhood/community data extracted",
            neighborhood: "N/A",
            community: "N/A",
            rawResponse: cleanText,
          });
        }

        return NextResponse.json({
          success: true,
          neighborhood: finalNeighborhood,
          community: finalCommunity,
        });
      } else {
        // Estrategia 2: Buscar patrones alternativos
        const neighborhoodMatch = cleanText.match(
          /"neighborhood":\s*"([^"]+)"/
        );
        const communityMatch = cleanText.match(/"community":\s*"([^"]+)"/);

        if (neighborhoodMatch || communityMatch) {
          const neighborhood = neighborhoodMatch ? neighborhoodMatch[1] : null;
          const community = communityMatch ? communityMatch[1] : null;
          const finalNeighborhood = neighborhood || "N/A";
          const finalCommunity = community || "N/A";

          if (
            (!finalNeighborhood || finalNeighborhood === "N/A") &&
            (!finalCommunity || finalCommunity === "N/A")
          ) {
            // Intento fallback también para este caso
            const fallbackPrompt = `${prompt}\nIMPORTANTE: Proporciona el MEJOR nombre plausible basado en conocimiento del área. SOLO devuelve 'N/A' en ambos campos si la dirección es imposible.`;
            response = await callGemini(fallbackPrompt);
            if (response.ok) {
              const d3 = await response.json();
              const t3 = d3.candidates?.[0]?.content?.parts?.[0]?.text || "";
              const ct3 = t3
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .replace(/\n/g, " ")
                .trim();
              const jm3 = ct3.match(
                /\{[^}]*"neighborhood"[^}]*"community"[^}]*\}/
              );
              if (jm3) {
                try {
                  const p3 = JSON.parse(jm3[0]);
                  const n3 = p3.neighborhood || "N/A";
                  const c3 = p3.community || "N/A";
                  if (n3 !== "N/A" || c3 !== "N/A") {
                    return NextResponse.json({
                      success: true,
                      neighborhood: n3,
                      community: c3,
                      fallback: true,
                    });
                  }
                } catch {}
              }
            }
            return NextResponse.json({
              success: false,
              error: "No neighborhood/community data extracted (pattern match)",
              neighborhood: "N/A",
              community: "N/A",
              rawResponse: cleanText,
            });
          }

          return NextResponse.json({
            success: true,
            neighborhood: finalNeighborhood,
            community: finalCommunity,
          });
        }

        throw new Error("No se encontró JSON válido en la respuesta");
      }
    } catch {
      // If JSON parsing fails, return error
      return NextResponse.json({
        success: false,
        error: "Failed to parse Gemini response",
        rawResponse: text,
      });
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
