"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

// Types
export interface MLSData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ProcessedResult extends MLSData {
  original_address: string;
  status: "success" | "error";
  api_source?: string;
  processed_at: string;
  formatted_address?: string;
  latitude?: number;
  longitude?: number;
  neighbourhood?: string;
  neighborhoods?: string;
  comunidades?: string;
  neighborhood_source?: string;
  community_source?: string;
  error?: string;
}

export interface Stats {
  totalProcessed: number;
  successRate: string;
  mapboxCount: number;
  geoapifyCount: number;
  geminiCount: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

export interface Progress {
  current: number;
  total: number;
  percentage: number;
  currentAddress: string;
}

export interface DetectedColumns {
  address: string | null;
  zip: string | null;
  city: string | null;
  county: string | null;
}

export interface FileData {
  data: MLSData[];
  columns: string[];
  fileName: string;
}

// Constants
const DELAY_BETWEEN_REQUESTS = 1100;
const GEMINI_DELAY = 2000;
export function useMLSProcessor() {
  // Counter to ensure unique log IDs
  const logIdCounter = useRef(0);
  // Control flag to stop processing
  const shouldStopProcessing = useRef(false);

  const [stats, setStats] = useState<Stats>({
    totalProcessed: 0,
    successRate: "0%",
    mapboxCount: 0,
    geoapifyCount: 0,
    geminiCount: 0,
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    current: 0,
    total: 0,
    percentage: 0,
    currentAddress: "",
  });
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<DetectedColumns>({
    address: null,
    zip: null,
    city: null,
    county: null,
  });
  const [fileData, setFileData] = useState<FileData | null>(null);

  // Initialize log only on client side to avoid hydration mismatch
  useEffect(() => {
    setLogs([
      {
        id: "1",
        timestamp: new Date().toLocaleTimeString(),
        message: "System V4 started. APIs preconfigured. Waiting for file...",
        type: "info",
      },
    ]);
  }, []);

  const addLog = useCallback(
    (message: string, type: LogEntry["type"] = "info") => {
      logIdCounter.current += 1;
      const newLog: LogEntry = {
        id: `${Date.now()}-${logIdCounter.current}`,
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
      };
      setLogs((prev) => [...prev, newLog]);
      console.log(`[${type.toUpperCase()}] ${message}`);
    },
    []
  );

  // Auto-detect columns from file data
  const detectColumns = useCallback(
    (columns: string[]): DetectedColumns => {
      addLog("Starting automatic column detection...", "info");

      const detected: DetectedColumns = {
        address:
          columns.find(
            (col) =>
              col.toLowerCase().includes("address") ||
              col.toLowerCase().includes("street") ||
              col.toLowerCase().includes("direccion") ||
              col.toLowerCase().includes("display")
          ) || null,

        zip:
          columns.find(
            (col) =>
              col.toLowerCase().includes("zip") ||
              col.toLowerCase().includes("postal") ||
              col.toLowerCase().includes("code")
          ) || null,

        city:
          columns.find(
            (col) =>
              col.toLowerCase().includes("city") ||
              col.toLowerCase().includes("ciudad") ||
              col.toLowerCase().includes("name")
          ) || null,

        county:
          columns.find(
            (col) =>
              col.toLowerCase().includes("county") ||
              col.toLowerCase().includes("condado")
          ) || null,
      };

      addLog(
        `Detected columns: Address=${detected.address}, Zip=${detected.zip}, City=${detected.city}, County=${detected.county}`,
        "info"
      );

      setDetectedColumns(detected);
      return detected;
    },
    [addLog]
  );

  // Read Excel/CSV file
  const readFile = useCallback((file: File): Promise<MLSData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          if (!e.target?.result) {
            throw new Error("Could not read file");
          }
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData as MLSData[]);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  // Geocode with Mapbox as primary source
  const geocodeWithMapbox = useCallback(
    async (address: string, zip: string, city: string, county: string) => {
      const fullAddress = `${address}, ${zip}, ${city}, ${county}`;
      const encodedAddress = encodeURIComponent(fullAddress);
      const apiKey = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;

      if (!apiKey) {
        return { success: false, error: "Mapbox API key not configured" };
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${apiKey}&country=us&types=address&limit=1`;

      try {
        addLog(`🗺️ Geocoding with Mapbox: ${fullAddress}`, "info");
        setStats((prev) => ({
          ...prev,
          mapboxCount: prev.mapboxCount + 1,
        }));

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const props = feature.properties;
          const coords = feature.geometry.coordinates;
          const context = feature.context || [];

          // Extract context information
          let neighborhood = null;
          let locality = null;
          let place = null;
          let district = null;
          let region = null;
          let postcode = null;
          let country = null;

          context.forEach((item: { id: string; text: string }) => {
            const id = item.id;
            if (id.startsWith("neighborhood")) neighborhood = item.text;
            else if (id.startsWith("locality")) locality = item.text;
            else if (id.startsWith("place")) place = item.text;
            else if (id.startsWith("district")) district = item.text;
            else if (id.startsWith("region")) region = item.text;
            else if (id.startsWith("postcode")) postcode = item.text;
            else if (id.startsWith("country")) country = item.text;
          });

          // Extract house number using the robust strategy from Mapbox-2.html
          let house_number = null;
          let street_name = null;

          // Strategy 1: Extract from original address using regex
          const addressMatch = fullAddress.match(/^(\d+)\s+(.+?)(?:,|$)/);
          if (addressMatch) {
            house_number = addressMatch[1];
            street_name = addressMatch[2].trim();
          }

          // Strategy 2: If not found, try from Mapbox formatted response
          if (!house_number) {
            const formattedMatch = feature.place_name.match(
              /^(\d+)\s+(.+?)(?:,|$)/
            );
            if (formattedMatch) {
              house_number = formattedMatch[1];
              street_name = formattedMatch[2].trim();
            }
          }

          // Strategy 3: Use street name from feature.text if available
          if (!street_name && feature.text && !feature.text.match(/^\d/)) {
            street_name = feature.text;
          }

          return {
            success: true,
            formatted: feature.place_name,
            latitude: coords[1],
            longitude: coords[0],
            neighborhood: neighborhood,
            locality: locality,
            place: place,
            district: district,
            region: region,
            postcode: postcode,
            country: country,
            confidence: feature.relevance || null,
            accuracy: props.accuracy || null,
            mapbox_id: feature.id,
            full_context: context,
            "House Number": house_number,
            street_name: street_name,
          };
        } else {
          return { success: false, error: "No results found" };
        }
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [addLog]
  );

  // Geocode with Geoapify as backup
  const geocodeWithGeoapify = useCallback(
    async (address: string, zip: string, city: string, county: string) => {
      const fullAddress = `${address}, ${zip}, ${city}, ${county}`;
      const encodedAddress = encodeURIComponent(fullAddress);
      const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodedAddress}&apiKey=${apiKey}`;

      try {
        addLog(`Geocoding with Geoapify: ${fullAddress}`, "info");
        setStats((prev) => ({
          ...prev,
          geoapifyCount: prev.geoapifyCount + 1,
        }));

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const props = feature.properties;
          const coords = feature.geometry.coordinates;

          return {
            success: true,
            formatted: props.formatted || fullAddress,
            latitude: coords[1],
            longitude: coords[0],
            neighbourhood: props.neighbourhood || null,
            suburb: props.suburb || null,
            district: props.district || null,
            confidence: props.confidence || null,
            result_type: props.result_type || null,
            "House Number": props.housenumber || null,
          };
        } else {
          return { success: false, error: "No results found" };
        }
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [addLog]
  );

  // Get neighborhood from Gemini with optimized prompt (exact copy from config.js)
  const getNeighborhoodFromGemini = useCallback(
    async (address: string, city: string, county: string) => {
      const fullAddress = `${address}, ${city}, ${county}, FL`;

      // PROMPT OPTIMIZADO BASADO EN GOOGLE AI STUDIO (exact copy from config.js)
      const optimizedPrompt = `Rol: Eres un especialista en enriquecimiento de datos geográficos con acceso a registros de propiedad, mapas de vecindarios y bases de datos del MLS 2025 fecha actual.

Objetivo: Para la dirección proporcionada, identifica y proporciona dos niveles específicos de información geográfica:

DIRECCIÓN A ANALIZAR: ${fullAddress}

Debes proporcionar:
1. **Vecindario general**: Área geográfica amplia dentro de la ciudad (ej: "Kendall Green", "Ives Estates", "Ocean Breeze")
2. **Subdivisión/Comunidad específica**: Desarrollo inmobiliario, subdivisión o comunidad específica (ej: "Kendall Lake Addition", "Magnolia Gardens Consolid", "Pine Ridge At Delray Beach")

INSTRUCCIONES ESPECÍFICAS:
- Consulta bases de datos MLS 2025 fecha actual y registros de propiedad de Florida
- Proporciona nombres exactos tal como aparecen en registros oficiales
- Si una dirección tiene múltiples opciones, selecciona la más específica
- Para subdivisiones, incluye números de sección si están disponibles
- Si no tienes datos específicos para algún campo, usa "No disponible"

FORMATO DE RESPUESTA (JSON únicamente):
{
  "neighborhood": "nombre exacto del vecindario general",
  "community": "nombre exacto de la subdivisión/comunidad específica"
}

Ejemplo de respuesta correcta:
{
  "neighborhood": "Kendall Green",
  "community": "Kendall Lake Addition"
}`;

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

      try {
        addLog(
          `🤖 Consulting Gemini with optimized prompt for: ${fullAddress}`,
          "info"
        );
        setStats((prev) => ({ ...prev, geminiCount: prev.geminiCount + 1 }));

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: optimizedPrompt }] }],
              generationConfig: {
                temperature: 0.1, // Más determinístico
                topK: 10,
                topP: 0.8,
                maxOutputTokens: 500, // Incrementado para respuestas más completas
                stopSequences: ["}"], // Detener después del JSON
              },
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Gemini API Error:", response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log("🤖 Gemini Full Response:", JSON.stringify(data, null, 2));

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const text = data.candidates[0].content.parts[0].text.trim();
          console.log("🤖 Gemini Raw Text:", text);

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
              ];

              if (
                neighborhood &&
                invalidValues.some((invalid) =>
                  neighborhood.toLowerCase().includes(invalid.toLowerCase())
                )
              ) {
                neighborhood = null;
              }

              if (
                community &&
                invalidValues.some((invalid) =>
                  community.toLowerCase().includes(invalid.toLowerCase())
                )
              ) {
                community = null;
              }

              // Validar que tenemos al menos uno de los campos
              if (!neighborhood && !community) {
                return {
                  success: false,
                  error:
                    "No se encontraron datos específicos de vecindario o comunidad",
                };
              }

              const result = {
                success: true,
                neighborhood: neighborhood,
                community: community,
              };

              console.log("✅ Gemini Parsed Result:", result);
              return result;
            } else {
              // Estrategia 2: Buscar patrones alternativos
              const neighborhoodMatch = cleanText.match(
                /"neighborhood":\s*"([^"]+)"/
              );
              const communityMatch = cleanText.match(
                /"community":\s*"([^"]+)"/
              );

              if (neighborhoodMatch || communityMatch) {
                return {
                  success: true,
                  neighborhood: neighborhoodMatch ? neighborhoodMatch[1] : null,
                  community: communityMatch ? communityMatch[1] : null,
                };
              }

              throw new Error("No se encontró JSON válido en la respuesta");
            }
          } catch (parseError) {
            console.error("❌ Parse Error:", (parseError as Error).message);
            console.error("❌ Raw text was:", text);

            return {
              success: false,
              error: `Error de parsing: ${(parseError as Error).message}`,
            };
          }
        } else {
          console.error("❌ Gemini response structure invalid:", data);
          return {
            success: false,
            error: "Estructura de respuesta de Gemini inválida",
          };
        }
      } catch (error) {
        console.error("❌ Gemini Error:", error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
    [addLog]
  );

  // Process individual address with simplified Mapbox + Gemini strategy
  const processAddress = useCallback(
    async (
      addressData: MLSData,
      columns: DetectedColumns
    ): Promise<ProcessedResult> => {
      const address = addressData[columns.address!] as string;
      const zip = columns.zip ? (addressData[columns.zip] as string) : "";
      const city = columns.city ? (addressData[columns.city] as string) : "";
      const county = columns.county
        ? (addressData[columns.county] as string)
        : "";

      try {
        let result: ProcessedResult = {
          ...addressData,
          original_address: address,
          status: "success",
          api_source: "Mapbox + Gemini",
          processed_at: new Date().toISOString(),
        };

        // Step 1: Try Mapbox first (Primary for geocoding)
        addLog(`🔄 Step 1: Trying Mapbox for: ${address}`, "info");
        const mapboxResult = await geocodeWithMapbox(
          address,
          zip,
          city,
          county
        );

        if (mapboxResult.success) {
          result = {
            ...result,
            formatted_address: mapboxResult.formatted,
            latitude: mapboxResult.latitude,
            longitude: mapboxResult.longitude,
            neighbourhood: mapboxResult.neighborhood || undefined,
            "House Number": mapboxResult["House Number"],
            api_source: "Mapbox + Gemini",
          };

          addLog(`✅ Mapbox success for: ${address}`, "success");

          // Step 2: Always use Gemini to get neighborhood and community data
          addLog(
            `🔄 Step 2: Using Gemini for neighborhood/community data`,
            "info"
          );
          const geminiResult = await getNeighborhoodFromGemini(
            address,
            city,
            county
          );

          if (geminiResult.success && "neighborhood" in geminiResult) {
            // Prioritize Mapbox neighborhoods if available, supplement with Gemini
            result.neighborhoods =
              mapboxResult.neighborhood || geminiResult.neighborhood;
            result.comunidades = geminiResult.community;

            // Set sources appropriately
            if (mapboxResult.neighborhood) {
              result.neighborhood_source = "Mapbox";
            } else {
              result.neighborhood_source = "Gemini AI";
            }
            result.community_source = "Gemini AI";

            addLog(
              `✅ Combined result: N=${result.neighborhoods} (${result.neighborhood_source}), C=${geminiResult.community} (Gemini)`,
              "success"
            );
          } else {
            // Use only Mapbox data if Gemini fails
            result.neighborhoods = mapboxResult.neighborhood || undefined;
            result.neighborhood_source = "Mapbox";
            result.api_source = "Mapbox Only";

            const errorMsg =
              "error" in geminiResult
                ? geminiResult.error
                : "No valid data returned";
            addLog(
              `⚠️ Gemini failed, using Mapbox only: ${errorMsg}`,
              "warning"
            );
          }

          // Add delay between requests
          await new Promise((resolve) => setTimeout(resolve, GEMINI_DELAY));
        } else {
          // If Mapbox fails, try Geoapify as backup, then Gemini
          addLog(`⚠️ Mapbox failed: ${mapboxResult.error}`, "warning");
          addLog(`🔄 Fallback: Trying Geoapify`, "info");

          const geocodeResult = await geocodeWithGeoapify(
            address,
            zip,
            city,
            county
          );

          if (geocodeResult.success) {
            result = {
              ...result,
              formatted_address: geocodeResult.formatted,
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
              neighbourhood: geocodeResult.neighbourhood,
              "House Number": geocodeResult["House Number"],
              api_source: "Geoapify + Gemini",
            };

            // Use Gemini for neighborhood/community data
            const geminiResult = await getNeighborhoodFromGemini(
              address,
              city,
              county
            );

            if (geminiResult.success && "neighborhood" in geminiResult) {
              result.neighborhoods = geminiResult.neighborhood;
              result.comunidades = geminiResult.community;
              result.neighborhood_source = "Gemini AI";
              result.community_source = "Gemini AI";

              addLog(
                `✅ Geoapify + Gemini result: N=${geminiResult.neighborhood}, C=${geminiResult.community}`,
                "success"
              );
            } else {
              result.neighborhoods = geocodeResult.neighbourhood;
              result.neighborhood_source = "Geoapify";
              result.api_source = "Geoapify Only";
            }

            await new Promise((resolve) => setTimeout(resolve, GEMINI_DELAY));
          } else {
            result.status = "error";
            result.error = `All APIs failed - Mapbox: ${mapboxResult.error}, Geoapify: ${geocodeResult.error}`;
            result.api_source = "Failed";
          }
        }

        return result;
      } catch (error) {
        return {
          ...addressData,
          original_address: address,
          status: "error",
          error: (error as Error).message,
          processed_at: new Date().toISOString(),
          api_source: "Error",
        };
      }
    },
    [geocodeWithMapbox, geocodeWithGeoapify, getNeighborhoodFromGemini, addLog]
  );

  const processFile = useCallback(
    async (file: File) => {
      try {
        addLog(`Loading file: ${file.name}`, "info");
        setIsProcessing(true);
        setResults([]);
        shouldStopProcessing.current = false; // Reset stop flag

        // Read file
        const data = await readFile(file);

        if (data.length === 0) {
          throw new Error("The file is empty");
        }

        // Store file data for preview
        const columns = Object.keys(data[0] || {});
        setFileData({
          data,
          columns,
          fileName: file.name,
        });

        // Detect columns
        const detectedCols = detectColumns(columns);

        if (!detectedCols.address) {
          throw new Error("Could not detect address column");
        }

        // Filter valid addresses
        const validAddresses = data.filter(
          (row) =>
            row[detectedCols.address!] &&
            String(row[detectedCols.address!]).trim()
        );

        addLog(`Processing ${validAddresses.length} valid addresses`, "info");

        // Process each address
        const results: ProcessedResult[] = [];
        let successCount = 0;

        for (let i = 0; i < validAddresses.length; i++) {
          // Check if processing should stop
          if (shouldStopProcessing.current) {
            addLog("Processing stopped by user", "warning");
            break;
          }

          const addressData = validAddresses[i];

          // Update progress
          setProgress({
            current: i + 1,
            total: validAddresses.length,
            percentage: Math.round(((i + 1) / validAddresses.length) * 100),
            currentAddress: String(addressData[detectedCols.address!]),
          });

          // Process address
          const result = await processAddress(addressData, detectedCols);
          results.push(result);

          if (result.status === "success") {
            successCount++;
          }

          // Update stats
          setStats((prev) => ({
            ...prev,
            totalProcessed: i + 1,
            successRate: `${Math.round((successCount / (i + 1)) * 100)}%`,
          }));

          // Add to results immediately for real-time display
          setResults((prev) => [...prev, result]);

          // Delay between requests
          if (i < validAddresses.length - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, DELAY_BETWEEN_REQUESTS)
            );
          }
        }

        if (!shouldStopProcessing.current) {
          addLog(
            `Processing completed: ${results.length} addresses`,
            "success"
          );
        }
      } catch (error) {
        addLog(`Error: ${(error as Error).message}`, "error");
      } finally {
        setIsProcessing(false);
        shouldStopProcessing.current = false;
      }
    },
    [addLog, readFile, detectColumns, processAddress]
  );

  const clearLogs = useCallback(() => {
    logIdCounter.current += 1;
    setLogs([
      {
        id: `${Date.now()}-${logIdCounter.current}`,
        timestamp: new Date().toLocaleTimeString(),
        message: "Logs cleared.",
        type: "info",
      },
    ]);
  }, []);

  const stopProcessing = useCallback(() => {
    shouldStopProcessing.current = true;
    addLog("Requesting to stop processing...", "warning");
  }, [addLog]);

  const downloadResults = useCallback(() => {
    if (results.length === 0) {
      alert("No results to download");
      return;
    }

    const headers = [
      "ML#",
      "Address",
      "Internet Display",
      "Zip Code",
      "City Name",
      "County",
      "House Number",
      "Latitude",
      "Longitude",
      "Neighborhoods",
      "Fuente Neighborhood",
      "Comunidades",
      "Fuente Community",
      "Estado",
      "Fuente API",
      "Mapbox Requests",
      "Geoapify Requests",
      "Gemini Requests",
    ];

    const csvContent = [
      headers.join(","),
      ...results.map((result) =>
        [
          `"${result["ML#"] || ""}"`,
          `"${result["Address"] || ""}"`,
          `"${result["Internet Display"] || ""}"`,
          `"${result["Zip Code"] || ""}"`,
          `"${result["City Name"] || ""}"`,
          `"${result["County"] || ""}"`,
          `"${result["House Number"] || ""}"`,
          result.latitude || "",
          result.longitude || "",
          `"${result.neighborhoods || ""}"`,
          `"${result.neighborhood_source || ""}"`,
          `"${result.comunidades || ""}"`,
          `"${result.community_source || ""}"`,
          result.status || "",
          `"${result.api_source || ""}"`,
          stats.mapboxCount,
          stats.geoapifyCount,
          stats.geminiCount,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `geographic_results_${new Date().getTime()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    addLog("Results downloaded successfully", "success");
  }, [results, stats, addLog]);

  const clearResults = useCallback(() => {
    setResults([]);
    setFileData(null);
    setStats({
      totalProcessed: 0,
      successRate: "0%",
      mapboxCount: 0,
      geoapifyCount: 0,
      geminiCount: 0,
    });
    setDetectedColumns({
      address: null,
      zip: null,
      city: null,
      county: null,
    });
    addLog("Results cleared", "info");
  }, [addLog]);

  const previewFile = useCallback(() => {
    if (!fileData) {
      alert("No file loaded");
      return;
    }

    const preview = fileData.data.slice(0, 5);
    const previewText = JSON.stringify(preview, null, 2);

    const previewWindow = window.open("", "_blank", "width=800,height=600");
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head>
            <title>File Preview</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
                background: #f5f5f5; 
              }
              h2 { 
                color: #2c3e50; 
                border-bottom: 2px solid #3498db; 
                padding-bottom: 10px; 
              }
              pre { 
                background: #fff; 
                padding: 20px; 
                border-radius: 8px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                overflow-x: auto; 
                font-size: 12px; 
                line-height: 1.4; 
              }
            </style>
          </head>
          <body>
            <h2>📋 Preview - ${fileData.fileName}</h2>
            <p><strong>First 5 rows of ${fileData.data.length} total</strong></p>
            <pre>${previewText}</pre>
          </body>
        </html>
      `);
    }
    addLog("File preview opened", "info");
  }, [fileData, addLog]);

  return {
    stats,
    logs,
    isProcessing,
    progress,
    results,
    detectedColumns,
    fileData,
    processFile,
    previewFile,
    clearLogs,
    clearResults,
    downloadResults,
    stopProcessing,
  };
}
