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

// Lista de Property Appraiser Sites para Florida
const floridaAppraisers = [
  { name: "Broward", site: "https://web.bcpa.net/bcpaclient/#/Record-Search" },
  {
    name: "Miami-Dade",
    site: "https://www.miamidade.gov/Apps/PA/PropertySearch/#/",
  },
  { name: "Palm Beach", site: "https://www.pbcgov.org/papa" },
];
export function useMLSProcessor() {
  // Counter to ensure unique log IDs
  const logIdCounter = useRef(0);
  // Control flag to stop processing
  const shouldStopProcessing = useRef(false);

  const [stats, setStats] = useState<Stats>({
    totalProcessed: 0,
    successRate: "0%",
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

  // Geocode with Geoapify
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

  // Get neighborhood from Gemini with optimized prompt
  const getNeighborhoodFromGemini = useCallback(
    async (address: string, city: string, county: string) => {
      const fullAddress = `${address}, ${city}, ${county}, FL`;
      const currentTime = new Date().toLocaleString("es-ES", {
        timeZone: "America/New_York",
      });
      const appraiserSites = floridaAppraisers
        .map((a) => `- ${a.name}: ${a.site}`)
        .join("\n");

      // OPTIMIZED PROMPT: prioritize sources and indicate source for each field
      const optimizedPrompt = `Role: You are a geographic data enrichment specialist with priority access to official property records, Florida Property Appraisers, MLS and real estate platforms like Zillow/Realtor.com (CurrentTime: ${currentTime}).

SOURCE PRIORITY (in order of reliability):
1. **Official County Property Appraiser** (most reliable)
2. **MLS/Multiple Listing Service** 
3. **Zillow Property Records**
4. **Realtor.com**
5. **Local Public Records**

Recommended official websites:
${appraiserSites}

ADDRESS TO ANALYZE: ${fullAddress}

CRITICAL INSTRUCTIONS:
- For **BROWARD COUNTY**: Prioritize https://web.bcpa.net/bcpaclient/#/Record-Search
- For **MIAMI-DADE COUNTY**: Check https://www.miamidade.gov/Apps/PA/PropertySearch/#/
  * Search by complete address to find exact subdivisions
  * Verify subdivision names in "Legal Description" or "Subdivision" field
- For **PALM BEACH**: Check https://www.pbcgov.org/papa
- Validate information by cross-referencing with Zillow and Realtor.com
- If there are discrepancies between sources, prioritize official Property Appraiser
- Avoid generic city names when specific subdivisions are available

OBJECTIVE: Provide two levels of geographic information:

1. **NEIGHBORHOOD (General area)**: 
   - Geographic area recognized by Zillow/Realtor as a neighborhood
   - Must be more specific than the city name
   - Avoid duplicating the main city name

2. **COMMUNITY (Specific subdivision)**:
   - Official subdivision name according to Property Appraiser
   - Specific development/community officially registered
   - Include section/phase if available in official records

METHODOLOGY:
1. Consult the official Property Appraiser of the corresponding county
2. Search for the exact address in the records
3. Extract the subdivision name from "Legal Description" or "Subdivision" field
4. For the neighborhood, consult Zillow/Realtor to get the general area name
5. Validate that the names are not generic city names

RESPONSE FORMAT (JSON only):
{
  "neighborhood": { "value": "neighborhood name according to Zillow/Realtor", "source": "Zillow|Realtor|MLS" },
  "community": { "value": "official subdivision name according to Property Appraiser", "source": "Appraiser|MLS|Unknown" }
}

VALIDATION: If you don't find specific data, prefer "Not available" over generic city names.`;

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
                temperature: 0.1, // More deterministic
                topK: 10,
                topP: 0.8,
                maxOutputTokens: 800, // Increased to avoid truncation
                stopSequences: [], // Removed stopSequences to avoid premature cuts
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
            const cleanText = text
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .replace(/\n/g, " ")
              .trim();

            console.log("🤖 Gemini Clean Text:", cleanText);

            // Strategy 1: Try to complete truncated JSON
            if (
              cleanText.includes('"neighborhood"') &&
              !cleanText.includes('"community"')
            ) {
              // Truncated JSON, try to complete
              const neighborhoodMatch = cleanText.match(
                /"neighborhood":\s*\{\s*"value":\s*"([^"]+)"\s*,?\s*"source":\s*"([^"]*)"?/
              );

              if (neighborhoodMatch) {
                addLog(
                  `✅ Truncated JSON detected, extracting neighborhood: ${neighborhoodMatch[1]}`,
                  "warning"
                );
                return {
                  success: true,
                  neighborhood: neighborhoodMatch[1],
                  neighborhood_source: neighborhoodMatch[2] || "Unknown",
                  community: null,
                  community_source: null,
                };
              }
            }

            // Strategy 2: Search for complete JSON with sources
            const jsonMatch = cleanText.match(
              /\{[^}]*"neighborhood"[^}]*"community"[^}]*\}/
            );

            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0]);

                // Validate response structure
                if (!parsed.neighborhood || !parsed.community) {
                  throw new Error("Incomplete JSON structure");
                }

                let neighborhood = parsed.neighborhood?.value || null;
                let neighborhoodSource =
                  parsed.neighborhood?.source || "Unknown";
                let community = parsed.community?.value || null;
                let communitySource = parsed.community?.source || "Unknown";

                // Clean invalid or generic values
                const invalidValues = [
                  "not available",
                  "n/a",
                  "no data",
                  "unknown",
                  "not specific",
                  "not found",
                ];

                // Generic city names that should be avoided as neighborhoods
                const genericCityNames = [
                  "pompano beach",
                  "miami",
                  "opa locka",
                  "fort lauderdale",
                  "coral springs",
                  "davie",
                  "plantation",
                  "sunrise",
                  "hollywood",
                  "pembroke pines",
                  "miramar",
                  "aventura",
                  "doral",
                  "homestead",
                  "pinecrest",
                  "hialeah",
                  "kendall",
                  "westchester",
                  "cutler bay",
                ];

                if (
                  neighborhood &&
                  (invalidValues.some((invalid) =>
                    neighborhood.toLowerCase().includes(invalid.toLowerCase())
                  ) ||
                    genericCityNames.some(
                      (city) =>
                        neighborhood.toLowerCase().includes(city) &&
                        neighborhood.toLowerCase().split(" ").length <= 2
                    ))
                ) {
                  console.log(
                    `🚫 Generic neighborhood rejected: ${neighborhood}`
                  );
                  neighborhood = null;
                  neighborhoodSource = null;
                }

                if (
                  community &&
                  invalidValues.some((invalid) =>
                    community.toLowerCase().includes(invalid.toLowerCase())
                  )
                ) {
                  console.log(`🚫 Invalid community rejected: ${community}`);
                  community = null;
                  communitySource = null;
                }

                const result = {
                  success: true,
                  neighborhood,
                  neighborhood_source: neighborhoodSource,
                  community,
                  community_source: communitySource,
                };

                console.log("✅ Gemini Parsed Result:", result);
                return result;
              } catch (jsonError) {
                console.error("❌ JSON Parse Error:", jsonError);
                // Continue with alternative strategy
              }
            }

            // Strategy 3: Extract individual values with regex
            const neighborhoodValueMatch = cleanText.match(
              /"neighborhood"[^}]*"value":\s*"([^"]+)"/
            );
            const neighborhoodSourceMatch = cleanText.match(
              /"neighborhood"[^}]*"source":\s*"([^"]+)"/
            );
            const communityValueMatch = cleanText.match(
              /"community"[^}]*"value":\s*"([^"]+)"/
            );
            const communitySourceMatch = cleanText.match(
              /"community"[^}]*"source":\s*"([^"]+)"/
            );

            if (neighborhoodValueMatch || communityValueMatch) {
              const result = {
                success: true,
                neighborhood: neighborhoodValueMatch
                  ? neighborhoodValueMatch[1]
                  : null,
                neighborhood_source: neighborhoodSourceMatch
                  ? neighborhoodSourceMatch[1]
                  : "Unknown",
                community: communityValueMatch ? communityValueMatch[1] : null,
                community_source: communitySourceMatch
                  ? communitySourceMatch[1]
                  : "Unknown",
              };

              addLog(
                `✅ Successful regex extraction: N=${result.neighborhood}, C=${result.community}`,
                "success"
              );
              return result;
            }

            // Strategy 4: Search for simple patterns without JSON structure
            const simpleNeighborhoodMatch = cleanText.match(
              /neighborhood[^:]*:\s*([^,}]+)/i
            );
            const simpleCommunityMatch = cleanText.match(
              /community[^:]*:\s*([^,}]+)/i
            );

            if (simpleNeighborhoodMatch || simpleCommunityMatch) {
              return {
                success: true,
                neighborhood: simpleNeighborhoodMatch
                  ? simpleNeighborhoodMatch[1].replace(/["']/g, "").trim()
                  : null,
                neighborhood_source: "Unknown",
                community: simpleCommunityMatch
                  ? simpleCommunityMatch[1].replace(/["']/g, "").trim()
                  : null,
                community_source: "Unknown",
              };
            }

            throw new Error("No valid information found in the response");
          } catch (parseError) {
            console.error("❌ Parse Error:", parseError);
            console.error("❌ Raw text was:", text);

            return {
              success: false,
              error: `Parsing error: ${(parseError as Error).message}`,
            };
          }
        } else {
          console.error("❌ Gemini response structure invalid:", data);
          return {
            success: false,
            error: "Invalid Gemini response structure",
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

  // Process individual address
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
        // Step 1: Geocode with Geoapify
        const geocodeResult = await geocodeWithGeoapify(
          address,
          zip,
          city,
          county
        );

        let result: ProcessedResult = {
          ...addressData,
          original_address: address,
          status: "success",
          api_source: "Geoapify + Gemini",
          processed_at: new Date().toISOString(),
        };

        if (geocodeResult.success) {
          result = {
            ...result,
            formatted_address: geocodeResult.formatted,
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
            neighbourhood: geocodeResult.neighbourhood,
            "House Number": geocodeResult["House Number"],
          };

          // Step 2: Enrich with Gemini
          const geminiResult = await getNeighborhoodFromGemini(
            address,
            city,
            county
          );

          console.log("🔍 Gemini Result in processAddress:", geminiResult);

          if (geminiResult.success && "neighborhood" in geminiResult) {
            result.neighborhoods = geminiResult.neighborhood;
            result.comunidades = geminiResult.community;
            result.neighborhood_source = geminiResult.neighborhood_source;
            result.community_source = geminiResult.community_source;

            addLog(
              `✅ Gemini data assigned: N=${geminiResult.neighborhood}, C=${geminiResult.community}`,
              "success"
            );
          } else {
            const errorMsg =
              "error" in geminiResult
                ? geminiResult.error
                : "No valid data returned";
            addLog(
              `⚠️ Gemini did not return valid data: ${errorMsg}`,
              "warning"
            );
          }

          // Add delay between requests
          await new Promise((resolve) => setTimeout(resolve, GEMINI_DELAY));
        } else {
          result.status = "error";
          result.error = geocodeResult.error;
        }

        return result;
      } catch (error) {
        return {
          ...addressData,
          original_address: address,
          status: "error",
          error: (error as Error).message,
          processed_at: new Date().toISOString(),
        };
      }
    },
    [geocodeWithGeoapify, getNeighborhoodFromGemini, addLog]
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
  }, [results, addLog]);

  const clearResults = useCallback(() => {
    setResults([]);
    setFileData(null);
    setStats({
      totalProcessed: 0,
      successRate: "0%",
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
