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

// Gemini API response types
export interface GeminiSuccessResult {
  success: true;
  neighborhood: string | null;
  community: string | null;
}

export interface GeminiErrorResult {
  success: false;
  error: string;
}

export type GeminiResult = GeminiSuccessResult | GeminiErrorResult;

// Mapbox API response types
export interface MapboxSuccessResult {
  success: true;
  formatted: string;
  latitude: number;
  longitude: number;
  neighborhood: string | null;
  locality?: string | null;
  place?: string | null;
  district?: string | null;
  region?: string | null;
  postcode?: string | null;
  country?: string | null;
  confidence?: number | null;
  accuracy?: string | null;
  mapbox_id?: string;
  full_context?: Array<{ id: string; text: string }>;
  "House Number": string | null;
  street_name?: string | null;
}

export interface MapboxErrorResult {
  success: false;
  error: string;
}

export type MapboxResult = MapboxSuccessResult | MapboxErrorResult;

// Geocodio API response types
export interface GeocodioSuccessResult {
  success: true;
  formatted: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  accuracy_type?: string;
  source?: string;
  number?: string | null;
  predirectional?: string | null;
  street?: string | null;
  suffix?: string | null;
  postdirectional?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  zip?: string | null;
  congressional_district?: number | null;
  state_legislative_district?: number | null;
  census_tract?: string | null;
  census_block?: string | null;
  "House Number": string | null;
  neighbourhood?: string | null;
}

export interface GeocodioErrorResult {
  success: false;
  error: string;
}

export type GeocodioResult = GeocodioSuccessResult | GeocodioErrorResult;

export interface Stats {
  totalProcessed: number;
  successRate: string;
  mapboxCount: number;
  geocodioCount: number;
  geminiCount: number;
}

// API Limits Configuration
export interface APILimits {
  mapbox: number;
  geocodio: number;
  gemini: number;
}

// API Usage Tracking
export interface APIUsage {
  mapboxUsed: number;
  geocodioUsed: number;
  geminiUsed: number;
  mapboxRemaining: number;
  geocodioRemaining: number;
  geminiRemaining: number;
  mapboxPercentage: number;
  geocodioPercentage: number;
  geminiPercentage: number;
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

// Constants - Dynamic delays based on environment
const isDevelopment = process.env.NODE_ENV === "development";
const DELAY_BETWEEN_REQUESTS = isDevelopment ? 500 : 1500; // Shorter delay in dev, longer in production
const GEMINI_DELAY = isDevelopment ? 1000 : 3000; // Shorter delay in dev, longer in production

// API Limits Configuration - Configurable limits for each service
const API_LIMITS: APILimits = {
  mapbox: 50000, // Mapbox free tier limit
  geocodio: 50000, // Geocodio premium tier limit
  gemini: 100000, // Gemini premium - 100k requests
};

// Storage keys
const SAVE_INTERVAL = 5; // Auto-save every 5 processed records (more frequent)
const STORAGE_KEY = "mls_processing_progress";
const CACHE_KEY = "mls_address_cache";
const GEMINI_CACHE_KEY = "mls_gemini_cache"; // Separate cache for Gemini results
const API_USAGE_KEY = "mls_api_usage"; // New key for API usage tracking

// Recovery interface
interface ProcessingProgress {
  results: ProcessedResult[];
  currentIndex: number;
  totalAddresses: number;
  fileName: string;
  timestamp: number;
  stats: Stats;
  detectedColumns: DetectedColumns;
  validAddresses: MLSData[];
}
export function useMLSProcessor() {
  // Counter to ensure unique log IDs
  const logIdCounter = useRef(0);
  // Control flag to stop processing
  const shouldStopProcessing = useRef(false);
  // Flag to prevent multiple recovery dialogs
  const hasShownRecoveryDialog = useRef(false);

  const [stats, setStats] = useState<Stats>({
    totalProcessed: 0,
    successRate: "0%",
    mapboxCount: 0,
    geocodioCount: 0,
    geminiCount: 0,
  });

  // API Usage tracking state
  const [apiUsage, setApiUsage] = useState<APIUsage>({
    mapboxUsed: 0,
    geocodioUsed: 0,
    geminiUsed: 0,
    mapboxRemaining: API_LIMITS.mapbox,
    geocodioRemaining: API_LIMITS.geocodio,
    geminiRemaining: API_LIMITS.gemini,
    mapboxPercentage: 0,
    geocodioPercentage: 0,
    geminiPercentage: 0,
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
  const [recoveryData, setRecoveryData] = useState<ProcessingProgress | null>(
    null
  );
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Helper function to normalize neighborhood/community values
  const normalizeValue = useCallback(
    (value: string | null | undefined): string => {
      if (
        value === null ||
        value === undefined ||
        value === "" ||
        value === "null" ||
        value === "undefined" ||
        value === "No disponible" ||
        value === "no disponible" ||
        value === "not available" ||
        value === "unknown"
      ) {
        return "N/A";
      }
      return String(value).trim();
    },
    []
  );

  // API Usage Management Functions
  const loadApiUsage = useCallback((): APIUsage => {
    try {
      const saved = localStorage.getItem(API_USAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        // Check if data is from today (reset daily)
        const today = new Date().toDateString();
        const savedDate = new Date(data.timestamp || 0).toDateString();

        if (today === savedDate) {
          return {
            mapboxUsed: data.mapboxUsed || 0,
            geocodioUsed: data.geocodioUsed || 0,
            geminiUsed: data.geminiUsed || 0,
            mapboxRemaining: API_LIMITS.mapbox - (data.mapboxUsed || 0),
            geocodioRemaining: API_LIMITS.geocodio - (data.geocodioUsed || 0),
            geminiRemaining: API_LIMITS.gemini - (data.geminiUsed || 0),
            mapboxPercentage: Math.round(
              ((data.mapboxUsed || 0) / API_LIMITS.mapbox) * 100
            ),
            geocodioPercentage: Math.round(
              ((data.geocodioUsed || 0) / API_LIMITS.geocodio) * 100
            ),
            geminiPercentage: Math.round(
              ((data.geminiUsed || 0) / API_LIMITS.gemini) * 100
            ),
          };
        }
      }
    } catch (error) {
      console.warn("⚠️ Failed to load API usage:", error);
    }

    // Return default values if no saved data or different day
    return {
      mapboxUsed: 0,
      geocodioUsed: 0,
      geminiUsed: 0,
      mapboxRemaining: API_LIMITS.mapbox,
      geocodioRemaining: API_LIMITS.geocodio,
      geminiRemaining: API_LIMITS.gemini,
      mapboxPercentage: 0,
      geocodioPercentage: 0,
      geminiPercentage: 0,
    };
  }, []);

  const saveApiUsage = useCallback((usage: APIUsage) => {
    try {
      const dataToSave = {
        ...usage,
        timestamp: Date.now(),
      };
      localStorage.setItem(API_USAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.warn("⚠️ Failed to save API usage:", error);
    }
  }, []);

  const updateApiUsage = useCallback(
    (service: "mapbox" | "geocodio" | "gemini", increment = 1) => {
      setApiUsage((prev) => {
        const newUsage = { ...prev };

        switch (service) {
          case "mapbox":
            newUsage.mapboxUsed += increment;
            newUsage.mapboxRemaining = Math.max(
              0,
              API_LIMITS.mapbox - newUsage.mapboxUsed
            );
            newUsage.mapboxPercentage = Math.round(
              (newUsage.mapboxUsed / API_LIMITS.mapbox) * 100
            );
            break;
          case "geocodio":
            newUsage.geocodioUsed += increment;
            newUsage.geocodioRemaining = Math.max(
              0,
              API_LIMITS.geocodio - newUsage.geocodioUsed
            );
            newUsage.geocodioPercentage = Math.round(
              (newUsage.geocodioUsed / API_LIMITS.geocodio) * 100
            );
            break;
          case "gemini":
            newUsage.geminiUsed += increment;
            newUsage.geminiRemaining = Math.max(
              0,
              API_LIMITS.gemini - newUsage.geminiUsed
            );
            newUsage.geminiPercentage = Math.round(
              (newUsage.geminiUsed / API_LIMITS.gemini) * 100
            );
            break;
        }

        // Save to localStorage
        saveApiUsage(newUsage);
        return newUsage;
      });
    },
    [saveApiUsage]
  );

  const checkApiLimit = useCallback(
    (service: "mapbox" | "geocodio" | "gemini"): boolean => {
      switch (service) {
        case "mapbox":
          return apiUsage.mapboxUsed < API_LIMITS.mapbox;
        case "geocodio":
          return apiUsage.geocodioUsed < API_LIMITS.geocodio;
        case "gemini":
          return apiUsage.geminiUsed < API_LIMITS.gemini;
        default:
          return false;
      }
    },
    [apiUsage]
  );

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

  // Cache and Recovery Functions
  const saveProgress = useCallback(
    (
      results: ProcessedResult[],
      currentIndex: number,
      totalAddresses: number,
      fileName: string,
      stats: Stats,
      detectedColumns: DetectedColumns,
      validAddresses: MLSData[]
    ) => {
      try {
        const progressData: ProcessingProgress = {
          results,
          currentIndex,
          totalAddresses,
          fileName,
          timestamp: Date.now(),
          stats,
          detectedColumns,
          validAddresses,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
        console.log(
          `💾 Progress saved: ${currentIndex}/${totalAddresses} (${Math.round(
            (currentIndex / totalAddresses) * 100
          )}%)`
        );
      } catch (error) {
        console.error("❌ Failed to save progress:", error);
        addLog("Warning: Could not save progress to storage", "warning");
      }
    },
    [addLog]
  );

  // Initialize log only on client side to avoid hydration mismatch
  useEffect(() => {
    // Initialize logs with environment info
    const environmentInfo = `Environment: ${
      process.env.NODE_ENV || "development"
    } | Delays: Requests=${DELAY_BETWEEN_REQUESTS}ms, Gemini=${GEMINI_DELAY}ms`;

    setLogs([
      {
        id: "1",
        timestamp: new Date().toLocaleTimeString(),
        message: "System V4 started. APIs preconfigured. Waiting for file...",
        type: "info",
      },
      {
        id: "2",
        timestamp: new Date().toLocaleTimeString(),
        message: environmentInfo,
        type: "info",
      },
    ]);

    // Check for recovery data on startup with multiple attempts
    const checkRecovery = () => {
      console.log("🔍 Starting recovery check...");

      // Prevent showing dialog if it's already been shown
      if (hasShownRecoveryDialog.current) {
        console.log("⏸️ Recovery check skipped - dialog already shown");
        return;
      }

      try {
        // Check if localStorage is available
        if (typeof window === "undefined" || !window.localStorage) {
          console.log("❌ localStorage not available");
          return;
        }

        console.log("✅ localStorage is available, checking for saved data...");
        const saved = localStorage.getItem(STORAGE_KEY);
        console.log(
          "🔍 Checking for saved progress with key:",
          STORAGE_KEY,
          saved ? `Found data (${saved.length} chars)` : "No data"
        );

        if (saved) {
          console.log("📄 Raw saved data:", saved.substring(0, 200) + "...");

          const data: ProcessingProgress = JSON.parse(saved);
          console.log("📄 Parsed recovery data:", {
            currentIndex: data.currentIndex,
            totalAddresses: data.totalAddresses,
            fileName: data.fileName,
            timestamp: new Date(data.timestamp).toLocaleString(),
            hasResults: data.results?.length || 0,
            hasValidAddresses: data.validAddresses?.length || 0,
          });

          // Validate data structure
          console.log("🔍 Validating data structure:", {
            hasCurrentIndex:
              data.currentIndex !== undefined && data.currentIndex !== null,
            currentIndexValue: data.currentIndex,
            hasTotalAddresses: !!data.totalAddresses,
            totalAddressesValue: data.totalAddresses,
            hasFileName: !!data.fileName,
            fileNameValue: data.fileName,
          });

          if (
            data.currentIndex === undefined ||
            data.currentIndex === null ||
            !data.totalAddresses ||
            !data.fileName
          ) {
            console.log("❌ Invalid data structure, removing...", {
              currentIndex: data.currentIndex,
              totalAddresses: data.totalAddresses,
              fileName: data.fileName,
            });
            localStorage.removeItem(STORAGE_KEY);
            return;
          }

          // Validate data is recent (within 7 days)
          const daysSinceLastSave =
            (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);

          if (daysSinceLastSave > 7) {
            console.log("⏰ Recovery data too old, removing...");
            localStorage.removeItem(STORAGE_KEY);
            return;
          }

          console.log("✅ Valid recovery data found, setting states...");

          // Mark that we've shown the recovery dialog
          hasShownRecoveryDialog.current = true;

          // Set recovery data first
          setRecoveryData(data);

          // Show dialog with multiple attempts
          setTimeout(() => {
            console.log("📱 Attempt 1: Showing recovery dialog...");
            setShowRecoveryDialog(true);
          }, 50);

          setTimeout(() => {
            console.log("📱 Attempt 2: Ensuring recovery dialog is shown...");
            setShowRecoveryDialog(true);
          }, 200);

          setTimeout(() => {
            console.log(
              "📱 Attempt 3: Final attempt to show recovery dialog..."
            );
            setShowRecoveryDialog(true);
          }, 1000);

          // Add log about recovery
          const recoveryLog: LogEntry = {
            id: `recovery-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            message: `🔄 Found previous session: ${data.currentIndex}/${data.totalAddresses} addresses processed from ${data.fileName}`,
            type: "info",
          };
          setLogs((prev) => [...prev, recoveryLog]);

          console.log("✅ Recovery check completed successfully");
        } else {
          console.log("ℹ️ No saved progress found");
        }
      } catch (error) {
        console.error("❌ Error checking recovery data:", error);
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    // Multiple checks to ensure it works
    checkRecovery(); // Immediate check

    const timeoutId1 = setTimeout(checkRecovery, 100); // After 100ms
    const timeoutId2 = setTimeout(checkRecovery, 500); // After 500ms
    const timeoutId3 = setTimeout(checkRecovery, 1000); // After 1s
    const timeoutId4 = setTimeout(checkRecovery, 2000); // After 2s

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      clearTimeout(timeoutId4);
    };
  }, []); // Empty dependency array to run only once on mount - checkRecovery closure captures current state

  // Initialize API usage tracking
  useEffect(() => {
    const usage = loadApiUsage();
    setApiUsage(usage);

    addLog(
      `📊 API Usage loaded - Mapbox: ${usage.mapboxUsed}/${API_LIMITS.mapbox} (${usage.mapboxPercentage}%), ` +
        `Geocodio: ${usage.geocodioUsed}/${API_LIMITS.geocodio} (${usage.geocodioPercentage}%), ` +
        `Gemini: ${usage.geminiUsed}/${API_LIMITS.gemini} (${usage.geminiPercentage}%)`,
      "info"
    );
  }, [loadApiUsage, addLog]);

  // Separate useEffect for beforeunload listener to save progress when page closes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only save if there's active processing
      if (isProcessing && results.length > 0 && fileData) {
        console.log("🚨 Page closing during processing, saving progress...");

        try {
          // Get current stats
          const currentStats = {
            totalProcessed: results.length,
            successRate: `${Math.round(
              (results.filter((r) => r.status === "success").length /
                results.length) *
                100
            )}%`,
            mapboxCount: stats.mapboxCount,
            geocodioCount: stats.geocodioCount,
            geminiCount: stats.geminiCount,
          };

          // Save current progress
          const progressData = {
            results: results,
            currentIndex: results.length,
            totalAddresses: fileData.data.length,
            fileName: fileData.fileName,
            timestamp: Date.now(),
            stats: currentStats,
            detectedColumns: detectedColumns,
            validAddresses: fileData.data,
          };

          localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
          console.log(
            `💾 Emergency save completed: ${results.length} results saved`
          );
        } catch (error) {
          console.error("❌ Failed to emergency save:", error);
        }

        // Show browser warning
        event.preventDefault();
        event.returnValue =
          "Processing in progress. Are you sure you want to leave?";
        return "Processing in progress. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isProcessing, results, fileData, stats, detectedColumns]);

  // Monitor recovery state changes
  useEffect(() => {
    console.log("🔄 Recovery state changed:", {
      showRecoveryDialog,
      hasRecoveryData: !!recoveryData,
      recoveryDataDetails: recoveryData
        ? {
            fileName: recoveryData.fileName,
            progress: `${recoveryData.currentIndex}/${recoveryData.totalAddresses}`,
          }
        : null,
    });
  }, [showRecoveryDialog, recoveryData]);

  const clearProgress = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(GEMINI_CACHE_KEY);
    localStorage.removeItem(API_USAGE_KEY); // Clear API usage tracking too
    console.log("🗑️ Progress cache and API usage cleared");
  }, []);

  const resetApiUsage = useCallback(() => {
    const resetUsage = {
      mapboxUsed: 0,
      geocodioUsed: 0,
      geminiUsed: 0,
      mapboxRemaining: API_LIMITS.mapbox,
      geocodioRemaining: API_LIMITS.geocodio,
      geminiRemaining: API_LIMITS.gemini,
      mapboxPercentage: 0,
      geocodioPercentage: 0,
      geminiPercentage: 0,
    };
    setApiUsage(resetUsage);
    saveApiUsage(resetUsage);
    addLog("🔄 API usage limits reset", "info");
  }, [saveApiUsage, addLog]);

  const refreshApiUsage = useCallback(() => {
    const currentUsage = loadApiUsage();
    setApiUsage(currentUsage);
    addLog("🔄 API usage refreshed from storage", "info");
  }, [loadApiUsage, addLog]);

  // Enhanced caching system
  const cacheAddressResult = useCallback(
    (address: string, result: ProcessedResult) => {
      try {
        const cacheKey = `addr_${btoa(address.toLowerCase().trim())}`;
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            result,
            timestamp: Date.now(),
          })
        );
      } catch (error) {
        // Ignore cache errors, not critical
        console.warn("⚠️ Cache storage failed:", error);
      }
    },
    []
  );

  // Cache specifically for Gemini results
  const cacheGeminiResult = useCallback(
    (
      address: string,
      city: string,
      county: string,
      result: {
        success: boolean;
        neighborhood?: string | null;
        community?: string | null;
        error?: string;
      }
    ) => {
      try {
        const env = process.env.NODE_ENV || "development";
        const cacheKey = `gemini_${env}_${btoa(
          `${address}_${city}_${county}`.toLowerCase().trim()
        )}`;
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            result,
            timestamp: Date.now(),
            environment: env,
          })
        );
        console.log(`💾 Gemini result cached for: ${address} (${env})`);
      } catch (error) {
        console.warn("⚠️ Gemini cache storage failed:", error);
      }
    },
    []
  );

  const getCachedGeminiResult = useCallback(
    (
      address: string,
      city: string,
      county: string
    ): {
      success: boolean;
      neighborhood?: string | null;
      community?: string | null;
      error?: string;
    } | null => {
      try {
        const env = process.env.NODE_ENV || "development";
        const cacheKey = `gemini_${env}_${btoa(
          `${address}_${city}_${county}`.toLowerCase().trim()
        )}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          // Cache valid for 7 days (Gemini results are more stable)
          const daysOld = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
          if (daysOld <= 7) {
            console.log(
              `📄 Using cached Gemini result for: ${address} (${env})`
            );
            return data.result;
          } else {
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (error) {
        console.warn("⚠️ Gemini cache retrieval failed:", error);
      }
      return null;
    },
    []
  );

  const getCachedAddressResult = useCallback(
    (address: string): ProcessedResult | null => {
      try {
        const cacheKey = `addr_${btoa(address.toLowerCase().trim())}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          // Cache valid for 30 days
          const daysOld = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
          if (daysOld <= 30) {
            return data.result;
          } else {
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (error) {
        console.warn("⚠️ Cache retrieval failed:", error);
      }
      return null;
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
    async (
      address: string,
      zip: string,
      city: string,
      county: string
    ): Promise<MapboxResult> => {
      const fullAddress = `${address}, ${zip}, ${city}, ${county}`;
      const encodedAddress = encodeURIComponent(fullAddress);
      const apiKey = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;

      if (!apiKey) {
        return { success: false, error: "Mapbox API key not configured" };
      }

      // Check API limit before making request
      if (!checkApiLimit("mapbox")) {
        addLog(
          `🚫 Mapbox API limit reached (${apiUsage.mapboxUsed}/${API_LIMITS.mapbox}). Skipping request for: ${address}`,
          "warning"
        );
        return {
          success: false as const,
          error: `Mapbox API limit reached (${apiUsage.mapboxUsed}/${API_LIMITS.mapbox})`,
        };
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${apiKey}&country=us&types=address&limit=1`;

      try {
        addLog(`🗺️ Geocoding with Mapbox: ${fullAddress}`, "info");
        setStats((prev) => ({
          ...prev,
          mapboxCount: prev.mapboxCount + 1,
        }));

        // Update API usage tracking
        updateApiUsage("mapbox");

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
            success: true as const,
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
          return { success: false as const, error: "No results found" };
        }
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    },
    [addLog, checkApiLimit, updateApiUsage, apiUsage.mapboxUsed]
  );

  // Geocode with Geocodio as backup
  const geocodeWithGeocodio = useCallback(
    async (
      address: string,
      zip: string,
      city: string,
      county: string
    ): Promise<GeocodioResult> => {
      const fullAddress = `${address}, ${zip}, ${city}, ${county}`;
      const encodedAddress = encodeURIComponent(fullAddress);
      const apiKey = process.env.NEXT_PUBLIC_GEOCODIO_API_KEY;
      const url = `https://api.geocod.io/v1.7/geocode?q=${encodedAddress}&api_key=${apiKey}&fields=cd,census2020`;

      // Check API limit before making request
      if (!checkApiLimit("geocodio")) {
        addLog(
          `🚫 Geocodio API limit reached (${apiUsage.geocodioUsed}/${API_LIMITS.geocodio}). Skipping request for: ${address}`,
          "warning"
        );
        return {
          success: false as const,
          error: `Geocodio API limit reached (${apiUsage.geocodioUsed}/${API_LIMITS.geocodio})`,
        };
      }

      try {
        addLog(`🌍 Geocoding with Geocodio: ${fullAddress}`, "info");
        setStats((prev) => ({
          ...prev,
          geocodioCount: prev.geocodioCount + 1,
        }));

        // Update API usage tracking
        updateApiUsage("geocodio");

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          const location = result.location;
          const addressComponents = result.address_components;
          const fields = result.fields || {};

          return {
            success: true as const,
            formatted: result.formatted_address || fullAddress,
            latitude: location.lat,
            longitude: location.lng,
            accuracy: result.accuracy,
            accuracy_type: result.accuracy_type,
            source: result.source,
            // Address components
            number: addressComponents.number || null,
            predirectional: addressComponents.predirectional || null,
            street: addressComponents.street || null,
            suffix: addressComponents.suffix || null,
            postdirectional: addressComponents.postdirectional || null,
            city: addressComponents.city || null,
            county: addressComponents.county || null,
            state: addressComponents.state || null,
            zip: addressComponents.zip || null,
            // Census data if available
            congressional_district:
              fields.congressional_districts?.[0]?.district_number || null,
            state_legislative_district:
              fields.state_legislative_districts?.house?.district_number ||
              null,
            census_tract: fields.census?.census_tract_code || null,
            census_block: fields.census?.block_code || null,
            // For compatibility with existing code
            "House Number": addressComponents.number || null,
            neighbourhood: null, // Geocodio doesn't provide neighborhood data directly
          };
        } else {
          return { success: false as const, error: "No results found" };
        }
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    },
    [addLog, checkApiLimit, updateApiUsage, apiUsage.geocodioUsed]
  );

  // Get neighborhood from Gemini with optimized prompt and retry logic
  const getNeighborhoodFromGemini = useCallback(
    async (
      address: string,
      city: string,
      county: string
    ): Promise<GeminiResult> => {
      const fullAddress = `${address}, ${city}, ${county}, FL`;

      // Check cache first
      const cachedResult = getCachedGeminiResult(address, city, county);
      if (cachedResult) {
        addLog(`📄 Using cached Gemini result for: ${address}`, "info");
        // Convert cache result to proper type
        if (cachedResult.success) {
          return {
            success: true as const,
            neighborhood: cachedResult.neighborhood || null,
            community: cachedResult.community || null,
          };
        } else {
          return {
            success: false as const,
            error: cachedResult.error || "Unknown cached error",
          };
        }
      }

      // PROMPT OPTIMIZADO BASADO EN GOOGLE AI STUDIO (exact copy from config.js)
      const optimizedPrompt = `Rol: Eres un especialista en enriquecimiento de datos geográficos con acceso a registros de propiedad, mapas de vecindarios y bases de datos del MLS 2025 fecha actual.

Objetivo: Para la dirección proporcionada, identifica y proporciona dos niveles específicos de información geográfica:

DIRECCIÓN A ANALIZAR: ${fullAddress}

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

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

      // Check API limit before making request
      if (!checkApiLimit("gemini")) {
        addLog(
          `🚫 Gemini API limit reached (${apiUsage.geminiUsed}/${API_LIMITS.gemini}). Skipping request for: ${fullAddress}`,
          "warning"
        );
        return {
          success: false as const,
          error: `Gemini API limit reached (${apiUsage.geminiUsed}/${API_LIMITS.gemini})`,
        };
      }

      // Retry configuration for free account - environment aware
      const maxRetries = 3;
      const baseDelay = isDevelopment ? 3000 : 6000; // 3s in dev, 6s in production

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          addLog(
            `🤖 Consulting Gemini (attempt ${attempt}/${maxRetries}) for: ${fullAddress}`,
            "info"
          );
          setStats((prev) => ({ ...prev, geminiCount: prev.geminiCount + 1 }));

          // Update API usage tracking
          updateApiUsage("gemini");

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
            console.error(
              `❌ Gemini API Error (attempt ${attempt}):`,
              response.status,
              errorText
            );

            // Handle specific error codes
            if (response.status === 503 || response.status === 429) {
              // Service overloaded or rate limited - retry with exponential backoff
              if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
                addLog(
                  `⏳ Gemini overloaded, retrying in ${
                    delay / 1000
                  }s... (${attempt}/${maxRetries})`,
                  "warning"
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue; // Retry
              } else {
                // Max retries reached, cache the failure and skip Gemini
                const failureResult = {
                  success: false as const,
                  error: `API overloaded after ${maxRetries} attempts`,
                };
                cacheGeminiResult(address, city, county, failureResult);
                addLog(
                  `⚠️ Gemini API overloaded after ${maxRetries} attempts, skipping for this address`,
                  "warning"
                );
                return failureResult;
              }
            } else if (response.status === 400) {
              // Bad request - don't retry, cache the failure
              const errorResult = {
                success: false as const,
                error: `Bad request: ${errorText}`,
              };
              cacheGeminiResult(address, city, county, errorResult);
              addLog(`❌ Gemini bad request: ${errorText}`, "error");
              return errorResult;
            } else {
              // Other errors - don't retry
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
          }

          const data = await response.json();
          console.log(
            "🤖 Gemini Full Response:",
            JSON.stringify(data, null, 2)
          );

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
                  "null",
                  "undefined",
                  "",
                ];

                if (
                  neighborhood &&
                  typeof neighborhood === "string" &&
                  invalidValues.some((invalid) =>
                    neighborhood
                      .toLowerCase()
                      .trim()
                      .includes(invalid.toLowerCase())
                  )
                ) {
                  neighborhood = "N/A";
                }

                if (
                  community &&
                  typeof community === "string" &&
                  invalidValues.some((invalid) =>
                    community
                      .toLowerCase()
                      .trim()
                      .includes(invalid.toLowerCase())
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

                // Validar que tenemos al menos uno de los campos con datos válidos
                if (
                  (!neighborhood || neighborhood === "N/A") &&
                  (!community || community === "N/A")
                ) {
                  const noDataResult = {
                    success: false as const,
                    error:
                      "No se encontraron datos específicos de vecindario o comunidad",
                  };
                  cacheGeminiResult(address, city, county, noDataResult);
                  return noDataResult;
                }

                const result = {
                  success: true as const,
                  neighborhood: neighborhood || "N/A",
                  community: community || "N/A",
                };

                console.log("✅ Gemini Parsed Result:", result);
                addLog(`✅ Gemini success on attempt ${attempt}`, "success");

                // Cache successful result
                cacheGeminiResult(address, city, county, result);
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

                  let neighborhood = neighborhoodMatch
                    ? neighborhoodMatch[1]
                    : null;
                  let community = communityMatch ? communityMatch[1] : null;

                  // Aplicar limpieza
                  if (neighborhood) {
                    neighborhood = cleanCommunityName(neighborhood);
                  }

                  if (community) {
                    community = cleanCommunityName(community);
                  }

                  const result = {
                    success: true as const,
                    neighborhood: neighborhood,
                    community: community,
                  };
                  addLog(`✅ Gemini success on attempt ${attempt}`, "success");

                  // Cache successful result
                  cacheGeminiResult(address, city, county, result);
                  return result;
                }

                throw new Error("No se encontró JSON válido en la respuesta");
              }
            } catch (parseError) {
              console.error("❌ Parse Error:", (parseError as Error).message);
              console.error("❌ Raw text was:", text);

              const parseErrorResult = {
                success: false as const,
                error: `Error de parsing: ${(parseError as Error).message}`,
              };
              cacheGeminiResult(address, city, county, parseErrorResult);
              return parseErrorResult;
            }
          } else {
            console.error("❌ Gemini response structure invalid:", data);
            const invalidStructureResult = {
              success: false as const,
              error: "Estructura de respuesta de Gemini inválida",
            };
            cacheGeminiResult(address, city, county, invalidStructureResult);
            return invalidStructureResult;
          }
        } catch (error) {
          console.error(`❌ Gemini Error (attempt ${attempt}):`, error);
          if (attempt === maxRetries) {
            const finalErrorResult = {
              success: false as const,
              error: (error as Error).message,
            };
            cacheGeminiResult(address, city, county, finalErrorResult);
            addLog(`❌ Gemini failed after ${maxRetries} attempts`, "error");
            return finalErrorResult;
          }
          // Wait before retrying - environment aware delay
          const retryDelay = isDevelopment ? 1500 : 3000;
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }

      // This should never be reached, but just in case
      const unexpectedErrorResult = {
        success: false as const,
        error: "Unexpected error in retry loop",
      };
      cacheGeminiResult(address, city, county, unexpectedErrorResult);
      return unexpectedErrorResult;
    },
    [
      addLog,
      getCachedGeminiResult,
      cacheGeminiResult,
      checkApiLimit,
      updateApiUsage,
      apiUsage.geminiUsed,
    ]
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
          };

          addLog(`✅ Mapbox success for: ${address}`, "success");

          // Check if Mapbox provided neighborhood data
          const hasMapboxNeighborhood =
            mapboxResult.neighborhood &&
            normalizeValue(mapboxResult.neighborhood) !== "N/A";

          if (hasMapboxNeighborhood) {
            // Mapbox has neighborhood, use it directly
            result.neighborhoods = normalizeValue(mapboxResult.neighborhood);
            result.neighborhood_source = "Mapbox";
            result.api_source = "Mapbox Only";

            // Still try Gemini for community data (communities are usually not in Mapbox)
            addLog(
              `🔄 Mapbox has neighborhood, using Gemini only for community data`,
              "info"
            );

            const geminiResult = await getNeighborhoodFromGemini(
              address,
              city,
              county
            );

            if (geminiResult.success && "community" in geminiResult) {
              result.comunidades = normalizeValue(geminiResult.community);
              result.community_source =
                normalizeValue(geminiResult.community) !== "N/A"
                  ? "Gemini AI"
                  : "N/A";
              result.api_source = "Mapbox + Gemini";
            } else {
              result.comunidades = "N/A";
              result.community_source = "N/A";
            }

            addLog(
              `✅ Mapbox complete: N=${result.neighborhoods} (${result.neighborhood_source}), C=${result.comunidades} (${result.community_source})`,
              "success"
            );
          } else {
            // Mapbox didn't provide neighborhood, use Gemini to complete both
            addLog(
              `🔄 Mapbox missing neighborhood, using Gemini to complete data`,
              "info"
            );

            const geminiResult = await getNeighborhoodFromGemini(
              address,
              city,
              county
            );

            if (geminiResult.success && "neighborhood" in geminiResult) {
              result.neighborhoods = normalizeValue(geminiResult.neighborhood);
              result.comunidades = normalizeValue(geminiResult.community);

              result.neighborhood_source =
                normalizeValue(geminiResult.neighborhood) !== "N/A"
                  ? "Gemini AI"
                  : "N/A";
              result.community_source =
                normalizeValue(geminiResult.community) !== "N/A"
                  ? "Gemini AI"
                  : "N/A";
              result.api_source = "Mapbox + Gemini";

              addLog(
                `✅ Mapbox + Gemini complete: N=${result.neighborhoods} (${result.neighborhood_source}), C=${result.comunidades} (${result.community_source})`,
                "success"
              );
            } else {
              // Gemini also failed, use only Mapbox geocoding data
              result.neighborhoods = "N/A";
              result.comunidades = "N/A";
              result.neighborhood_source = "N/A";
              result.community_source = "N/A";
              result.api_source = "Mapbox Only";

              const errorMsg =
                "error" in geminiResult
                  ? geminiResult.error
                  : "No valid data returned";
              addLog(
                `⚠️ Gemini failed, using only Mapbox geocoding: ${errorMsg}`,
                "warning"
              );
            }
          }

          // Add delay between requests - environment aware
          const mapboxDelay = isDevelopment ? 500 : 1500;
          await new Promise((resolve) => setTimeout(resolve, mapboxDelay));
        } else {
          // Mapbox failed, use Geocodio as fallback
          addLog(`❌ Mapbox failed: ${mapboxResult.error}`, "error");
          addLog(`🔄 Fallback: Trying Geocodio`, "info");

          const geocodeResult = await geocodeWithGeocodio(
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
              neighbourhood: geocodeResult.neighbourhood || undefined,
              "House Number": geocodeResult["House Number"],
              neighborhoods: normalizeValue(geocodeResult.neighbourhood),
              neighborhood_source: geocodeResult.neighbourhood
                ? "Geocodio"
                : "N/A",
              comunidades: "N/A", // Geocodio doesn't provide community data
              community_source: "N/A",
              api_source: "Geocodio (Fallback)",
            };

            addLog(`✅ Geocodio fallback success for: ${address}`, "success");

            await new Promise((resolve) => setTimeout(resolve, GEMINI_DELAY));
          } else {
            // All geocoding services failed
            result.status = "error";
            result.error = `All APIs failed - Mapbox: ${mapboxResult.error}, Geocodio: ${geocodeResult.error}`;
            result.api_source = "Failed";
            result.neighborhoods = "N/A";
            result.comunidades = "N/A";
            result.neighborhood_source = "N/A";
            result.community_source = "N/A";

            addLog(`❌ All geocoding failed for: ${address}`, "error");
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
          neighborhoods: "N/A",
          comunidades: "N/A",
          neighborhood_source: "N/A",
          community_source: "N/A",
        };
      }
    },
    [
      geocodeWithMapbox,
      geocodeWithGeocodio,
      getNeighborhoodFromGemini,
      addLog,
      normalizeValue,
    ]
  );

  const processFile = useCallback(
    async (file: File, continueFromProgress = false) => {
      try {
        let validAddresses: MLSData[];
        let detectedCols: DetectedColumns;
        let startIndex = 0;
        let existingResults: ProcessedResult[] = [];
        let currentStats = stats;

        if (continueFromProgress && recoveryData) {
          // Continue from saved progress
          addLog(
            `🔄 Continuing from saved progress: ${recoveryData.currentIndex}/${recoveryData.totalAddresses}`,
            "info"
          );

          validAddresses = recoveryData.validAddresses;
          detectedCols = recoveryData.detectedColumns;
          startIndex = recoveryData.currentIndex;
          existingResults = recoveryData.results;
          currentStats = recoveryData.stats;

          // Restore states
          setStats(currentStats);
          setResults(existingResults);
          setDetectedColumns(detectedCols);
          setFileData({
            data: validAddresses,
            columns: Object.keys(validAddresses[0] || {}),
            fileName: recoveryData.fileName,
          });

          // Clear recovery dialog
          setShowRecoveryDialog(false);
          setRecoveryData(null);
        } else {
          // Start fresh processing
          addLog(`Loading file: ${file.name}`, "info");
          setResults([]);

          // Clear any previous progress
          clearProgress();

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
          detectedCols = detectColumns(columns);

          if (!detectedCols.address) {
            throw new Error("Could not detect address column");
          }

          // Filter valid addresses
          validAddresses = data.filter(
            (row) =>
              row[detectedCols.address!] &&
              String(row[detectedCols.address!]).trim()
          );

          addLog(`Processing ${validAddresses.length} valid addresses`, "info");
        }

        setIsProcessing(true);
        shouldStopProcessing.current = false;

        // Process each address starting from the appropriate index
        const results: ProcessedResult[] = [...existingResults];
        let successCount = existingResults.filter(
          (r) => r.status === "success"
        ).length;

        for (let i = startIndex; i < validAddresses.length; i++) {
          // Check if processing should stop
          if (shouldStopProcessing.current) {
            addLog("Processing stopped by user", "warning");
            break;
          }

          const addressData = validAddresses[i];
          const address = String(addressData[detectedCols.address!]);

          // Update progress
          setProgress({
            current: i + 1,
            total: validAddresses.length,
            percentage: Math.round(((i + 1) / validAddresses.length) * 100),
            currentAddress: address,
          });

          // Check cache first
          let result = getCachedAddressResult(address);

          if (result) {
            // Use cached result
            result = { ...result, ...addressData }; // Merge with original data
            // Detect api_source and increment corresponding counter
            let mapboxInc = 0,
              geocodioInc = 0,
              geminiInc = 0;
            if (result.api_source) {
              if (result.api_source.includes("Mapbox")) mapboxInc = 1;
              if (result.api_source.includes("Geocodio")) geocodioInc = 1;
              if (result.api_source.includes("Gemini")) geminiInc = 1;
            }
            setStats((prev) => ({
              ...prev,
              totalProcessed: i + 1,
              successRate: `${Math.round((successCount / (i + 1)) * 100)}%`,
              mapboxCount: prev.mapboxCount + mapboxInc,
              geocodioCount: prev.geocodioCount + geocodioInc,
              geminiCount: prev.geminiCount + geminiInc,
            }));
            addLog(
              `📄 Using cached result for: ${address}${
                result.api_source ? ` | Source: ${result.api_source}` : ""
              }`,
              "info"
            );
          } else {
            // Process address normally
            result = await processAddress(addressData, detectedCols);

            // Cache successful results
            if (result.status === "success") {
              cacheAddressResult(address, result);
            }
          }

          results.push(result);

          if (result.status === "success") {
            successCount++;
          }

          // Si el resultado NO es cacheado, actualiza stats como antes
          if (!result || !getCachedAddressResult(address)) {
            const newStats = {
              ...currentStats,
              totalProcessed: i + 1,
              successRate: `${Math.round((successCount / (i + 1)) * 100)}%`,
            };
            setStats(newStats);
          }

          // Add to results immediately for real-time display
          setResults([...results]);

          // Auto-save progress every SAVE_INTERVAL records
          if ((i + 1) % SAVE_INTERVAL === 0) {
            saveProgress(
              results,
              i + 1,
              validAddresses.length,
              file.name,
              stats,
              detectedCols,
              validAddresses
            );
            addLog(
              `💾 Auto-saved at ${i + 1}/${validAddresses.length}`,
              "info"
            );
          }

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
          // Clear progress cache when completed
          clearProgress();
          // Show success modal
          setShowSuccessModal(true);
        } else {
          // Save final progress if stopped
          saveProgress(
            results,
            results.length,
            validAddresses.length,
            file.name,
            currentStats,
            detectedCols,
            validAddresses
          );
        }
      } catch (error) {
        addLog(`Error: ${(error as Error).message}`, "error");
      } finally {
        setIsProcessing(false);
        shouldStopProcessing.current = false;
      }
    },
    [
      addLog,
      readFile,
      detectColumns,
      processAddress,
      stats,
      recoveryData,
      getCachedAddressResult,
      cacheAddressResult,
      saveProgress,
      clearProgress,
    ]
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
      "Geocodio Requests",
      "Gemini Requests",
    ];

    const csvContent = [
      headers.join(","),
      ...results.map((result) =>
        [
          `"${
            result["ML#"] ||
            result["MLS#"] ||
            result["MLSNumber"] ||
            result["MLS Number"] ||
            result["ListingID"] ||
            result["Listing ID"] ||
            ""
          }"`,
          `"${
            result.original_address ||
            result["Address"] ||
            result["Internet Display"] ||
            ""
          }"`,
          `"${result["Zip Code"] || ""}"`,
          `"${result["City Name"] || ""}"`,
          `"${result["County"] || ""}"`,
          `"${result["House Number"] || ""}"`,
          result.latitude || "",
          result.longitude || "",
          `"${result.neighborhoods || "N/A"}"`,
          `"${result.neighborhood_source || "N/A"}"`,
          `"${result.comunidades || "N/A"}"`,
          `"${result.community_source || "N/A"}"`,
          result.status || "",
          `"${result.api_source || ""}"`,
          stats.mapboxCount,
          stats.geocodioCount,
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
      geocodioCount: 0,
      geminiCount: 0,
    });
    setDetectedColumns({
      address: null,
      zip: null,
      city: null,
      county: null,
    });
    clearProgress(); // Also clear saved progress
    addLog("Results cleared", "info");
  }, [addLog, clearProgress]);

  // Recovery functions
  const continueFromProgress = useCallback(() => {
    if (recoveryData) {
      // Immediately close the dialog and clear recovery state to prevent re-showing
      setShowRecoveryDialog(false);

      // Clear the localStorage immediately to prevent timeouts from re-triggering
      localStorage.removeItem(STORAGE_KEY);

      // Reset the flag in case user wants to process another file later
      hasShownRecoveryDialog.current = false;

      console.log(
        "🔄 Starting recovery process - dialog closed and localStorage cleared"
      );

      const dummyFile = new File([], recoveryData.fileName);
      processFile(dummyFile, true);
    }
  }, [recoveryData, processFile]);

  const discardProgress = useCallback(() => {
    clearProgress();
    setRecoveryData(null);
    setShowRecoveryDialog(false);
    hasShownRecoveryDialog.current = false; // Reset flag
    addLog("Previous progress discarded", "info");
  }, [clearProgress, addLog]);

  const downloadPartialResults = useCallback(() => {
    if (!recoveryData || recoveryData.results.length === 0) {
      alert("No partial results to download");
      return;
    }

    const headers = [
      "ML#",
      "Address",
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
      ...recoveryData.results.map((result) =>
        [
          `"${
            result["ML#"] ||
            result["MLS#"] ||
            result["MLSNumber"] ||
            result["MLS Number"] ||
            result["ListingID"] ||
            result["Listing ID"] ||
            ""
          }"`,
          `"${
            result.original_address ||
            result["Address"] ||
            result["Internet Display"] ||
            ""
          }"`,
          `"${result["Zip Code"] || ""}"`,
          `"${result["City Name"] || ""}"`,
          `"${result["County"] || ""}"`,
          `"${result["House Number"] || ""}"`,
          result.latitude || "",
          result.longitude || "",
          `"${result.neighborhoods || "N/A"}"`,
          `"${result.neighborhood_source || "N/A"}"`,
          `"${result.comunidades || "N/A"}"`,
          `"${result.community_source || "N/A"}"`,
          result.status || "",
          `"${result.api_source || ""}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `partial_results_${
      recoveryData.currentIndex
    }_${new Date().getTime()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    addLog("Partial results downloaded successfully", "success");
  }, [recoveryData, addLog]);

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
    apiUsage,
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
    // API Usage Management
    apiLimits: API_LIMITS,
    resetApiUsage,
    refreshApiUsage,
    // Recovery functions
    showRecoveryDialog,
    setShowRecoveryDialog,
    recoveryData,
    continueFromProgress,
    discardProgress,
    downloadPartialResults,
    // Success modal
    showSuccessModal,
    setShowSuccessModal,
  };
}
