"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

// =====================
// Types & Interfaces
// =====================
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
export interface APILimits {
  mapbox: number;
  geocodio: number;
  gemini: number;
}
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

// =====================
// Constants
// =====================
const isDevelopment = process.env.NODE_ENV === "development";
const DELAY_BETWEEN_REQUESTS = isDevelopment ? 500 : 1500;
const GEMINI_DELAY = isDevelopment ? 1000 : 3000;
const CONCURRENCY_LIMIT = isDevelopment ? 6 : 3;

const API_LIMITS: APILimits = {
  mapbox: 100000,
  geocodio: 50000,
  gemini: 100000,
};

const SAVE_INTERVAL = 5;
const STORAGE_KEY = "mls_processing_progress";
const CACHE_KEY = "mls_address_cache";
const GEMINI_CACHE_KEY = "mls_gemini_cache";
const API_USAGE_KEY = "mls_api_usage";

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
  // Flag to prevent duplicate API usage updates
  const lastApiUsageUpdate = useRef<{ [key: string]: number }>({});

  const [stats, setStats] = useState<Stats>({
    totalProcessed: 0,
    successRate: "0%",
    mapboxCount: 0,
    geocodioCount: 0,
    geminiCount: 0,
  });

  // Control Mapbox disabling after repeated auth failures
  const mapboxDisabled = useRef(false);
  const mapbox401Count = useRef(0);

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
  const [showApiLimitModal, setShowApiLimitModal] = useState(false);
  const [apiLimitInfo, setApiLimitInfo] = useState<{
    service: string;
    used: number;
    limit: number;
  } | null>(null);

  // Helper function to normalize neighborhood/community values - SIMPLIFIED VERSION
  const normalizeValue = useCallback(
    (value: string | null | undefined): string => {
      // Only convert clearly empty/null values to "N/A"
      if (
        value === null ||
        value === undefined ||
        value === "" ||
        value === "null" ||
        value === "undefined" ||
        value === "N/A"
      ) {
        return "N/A";
      }

      const trimmed = String(value).trim();

      // Check for clearly invalid values (case insensitive)
      const lowerValue = trimmed.toLowerCase();
      if (
        lowerValue === "n/a" ||
        lowerValue === "unknown" ||
        lowerValue === "null"
      ) {
        return "N/A";
      }

      return trimmed;
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
      // Prevent duplicate updates within 100ms
      const now = Date.now();
      const lastUpdate = lastApiUsageUpdate.current[service] || 0;
      if (now - lastUpdate < 100) {
        console.log(`🚫 Preventing duplicate API usage update for ${service}`);
        return;
      }
      lastApiUsageUpdate.current[service] = now;

      setApiUsage((prev) => {
        const newUsage = { ...prev };

        console.log(`📊 Updating API Usage for ${service}:`, {
          before: prev,
          increment,
        });

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

        console.log(`📊 API Usage updated for ${service}:`, {
          after: newUsage,
          shouldTriggerLimit:
            service === "mapbox"
              ? newUsage.mapboxUsed >= API_LIMITS.mapbox
              : service === "geocodio"
                ? newUsage.geocodioUsed >= API_LIMITS.geocodio
                : newUsage.geminiUsed >= API_LIMITS.gemini,
        });

        // Save to localStorage
        saveApiUsage(newUsage);
        return newUsage;
      });
    },
    [saveApiUsage]
  );

  const checkApiLimit = useCallback(
    (service: "mapbox" | "geocodio" | "gemini"): boolean => {
      const isWithinLimit = (() => {
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
      })();

      // Debug logging
      console.log(`🔍 API Limit Check for ${service}:`, {
        used:
          service === "mapbox"
            ? apiUsage.mapboxUsed
            : service === "geocodio"
              ? apiUsage.geocodioUsed
              : apiUsage.geminiUsed,
        limit:
          service === "mapbox"
            ? API_LIMITS.mapbox
            : service === "geocodio"
              ? API_LIMITS.geocodio
              : API_LIMITS.gemini,
        withinLimit: isWithinLimit,
      });

      return isWithinLimit;
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

  const handleApiLimitReached = useCallback(
    (service: "mapbox" | "geocodio" | "gemini") => {
      console.log(`🚫 API Limit Reached Handler Called for ${service}:`, {
        currentUsage: apiUsage,
        limits: API_LIMITS,
      });

      const serviceInfo = {
        mapbox: { used: apiUsage.mapboxUsed, limit: API_LIMITS.mapbox },
        geocodio: { used: apiUsage.geocodioUsed, limit: API_LIMITS.geocodio },
        gemini: { used: apiUsage.geminiUsed, limit: API_LIMITS.gemini },
      };

      setApiLimitInfo({
        service: service.charAt(0).toUpperCase() + service.slice(1),
        used: serviceInfo[service].used,
        limit: serviceInfo[service].limit,
      });

      console.log(`🚫 Setting API Limit Modal to true for ${service}`);
      setShowApiLimitModal(true);

      // Stop processing immediately
      shouldStopProcessing.current = true;
      setIsProcessing(false);

      addLog(
        `🚫 ${service.toUpperCase()} API limit reached (${
          serviceInfo[service].used
        }/${serviceInfo[service].limit}). Processing stopped.`,
        "error"
      );
    },
    [apiUsage, addLog]
  );

  const closeApiLimitModal = useCallback(() => {
    setShowApiLimitModal(false);
    setApiLimitInfo(null);
  }, []);

  const continueWithOtherApis = useCallback(() => {
    setShowApiLimitModal(false);
    setApiLimitInfo(null);

    // Allow processing to continue (remove the stop flag)
    shouldStopProcessing.current = false;
    setIsProcessing(true);

    addLog("🔄 Continuing processing with remaining APIs...", "info");
  }, [addLog]);

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
    // Clear all address cache entries
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith("addr_") || key.startsWith("gemini_")) {
        localStorage.removeItem(key);
      }
    });
    // DON'T clear API usage - it should persist for the day
    console.log("🗑️ All cache cleared (API usage preserved)");
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

  const clearAllCache = useCallback(() => {
    const keys = Object.keys(localStorage);
    let cacheCleared = 0;
    keys.forEach((key) => {
      if (key.startsWith("addr_") || key.startsWith("gemini_")) {
        localStorage.removeItem(key);
        cacheCleared++;
      }
    });
    addLog(
      `🗑️ Cache cleared: ${cacheCleared} cached results removed. Fresh API calls will be made.`,
      "info"
    );
  }, [addLog]);

  // Clear only Gemini cache for debugging
  const clearGeminiCache = useCallback(() => {
    const keys = Object.keys(localStorage);
    let geminiCacheCleared = 0;
    keys.forEach((key) => {
      if (key.startsWith("gemini_") || key === GEMINI_CACHE_KEY) {
        localStorage.removeItem(key);
        geminiCacheCleared++;
      }
    });
    addLog(
      `🗑️ Gemini cache cleared: ${geminiCacheCleared} entries removed. Fresh Gemini calls will be made.`,
      "info"
    );
  }, [addLog]);

  const clearCacheForTesting = useCallback(() => {
    // Clear all caches for testing
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(GEMINI_CACHE_KEY);
    const keys = Object.keys(localStorage);
    let cleared = 0;
    keys.forEach((key) => {
      if (key.startsWith("addr_") || key.startsWith("gemini_")) {
        localStorage.removeItem(key);
        cleared++;
      }
    });
    addLog(
      `🧪 Test cache clear: ${cleared} entries removed. Ready for fresh testing.`,
      "info"
    );
  }, [addLog]);

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

  const getCachedAddressResult = useCallback(
    (address: string): ProcessedResult | null => {
      try {
        const cacheKey = `addr_${btoa(address.toLowerCase().trim())}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          // Cache valid for 24 hours (reduced from 30 days)
          const hoursOld = (Date.now() - data.timestamp) / (1000 * 60 * 60);
          if (hoursOld <= 24) {
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
      if (mapboxDisabled.current) {
        addLog(
          `🚫 Mapbox disabled after repeated 401 errors. Skipping for: ${address}`,
          "warning"
        );
        return { success: false, error: "Mapbox disabled" };
      }
      const fullAddress = [address, zip, city, county]
        .filter(Boolean)
        .join(", ");

      // Check API limit before making request
      if (!checkApiLimit("mapbox")) {
        handleApiLimitReached("mapbox");
        return {
          success: false as const,
          error: `Mapbox API limit reached (${apiUsage.mapboxUsed}/${API_LIMITS.mapbox})`,
        };
      }

      try {
        addLog(`🗺️ Geocoding with Mapbox: ${fullAddress}`, "info");
        setStats((prev) => ({
          ...prev,
          mapboxCount: prev.mapboxCount + 1,
        }));
        const response = await fetch("/api/geocoding/mapbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: fullAddress }),
        });

        const json = await response.json();
        if (!response.ok || json.error) {
          throw new Error(json.error || `HTTP ${response.status}`);
        }

        // Update usage después de éxito
        updateApiUsage("mapbox");

        // Usamos json.raw (respuesta completa de Mapbox en el route) si existe para extraer más contexto
        let house_number: string | null = null;
        let street_name: string | null = null;
        if (json.formatted) {
          const match = json.formatted.match(/^(\d+)\s+(.+?)(?:,|$)/);
          if (match) {
            house_number = match[1];
            street_name = match[2].trim();
          }
        }
        if (!house_number) {
          const match2 = fullAddress.match(/^(\d+)\s+(.+?)(?:,|$)/);
          if (match2) {
            house_number = match2[1];
            street_name = street_name || match2[2].trim();
          }
        }

        return {
          success: true,
          formatted: json.formatted,
          latitude: json.latitude,
          longitude: json.longitude,
          neighborhood: json.neighborhood || null,
          "House Number": house_number,
          street_name,
        };
      } catch (error) {
        if (
          (error as Error).message.includes("CSP") ||
          (error as Error).name === "TypeError"
        ) {
          addLog(
            "⚠️ Mapbox fetch blocked (posible CSP). Usa endpoint interno confirmado.",
            "warning"
          );
        }
        if ((error as Error).message.includes("401")) {
          mapbox401Count.current += 1;
          addLog(
            `🔐 Mapbox 401 (${mapbox401Count.current}) for ${address}. Token invalid or lacking scope?`,
            "error"
          );
          if (mapbox401Count.current >= 3) {
            mapboxDisabled.current = true;
            addLog(
              "🚫 Mapbox deshabilitado tras 3 errores 401 consecutivos. Usando Geocodio y Gemini únicamente.",
              "warning"
            );
          }
        }
        return { success: false as const, error: (error as Error).message };
      }
    },
    [
      addLog,
      checkApiLimit,
      updateApiUsage,
      handleApiLimitReached,
      apiUsage.mapboxUsed,
    ]
  );

  // Geocode with Geocodio as backup
  const geocodeWithGeocodio = useCallback(
    async (
      address: string,
      zip: string,
      city: string,
      county: string
    ): Promise<GeocodioResult> => {
      const fullAddress = [address, zip, city, county]
        .filter(Boolean)
        .join(", ");

      // Check API limit before making request
      if (!checkApiLimit("geocodio")) {
        handleApiLimitReached("geocodio");
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
        const response = await fetch("/api/geocoding/geocodio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: fullAddress }),
        });
        const json = await response.json();
        if (!response.ok || json.error) {
          throw new Error(json.error || `HTTP ${response.status}`);
        }
        updateApiUsage("geocodio");
        return {
          success: true,
          formatted: json.formatted || fullAddress,
          latitude: json.latitude,
          longitude: json.longitude,
          accuracy: json.accuracy,
          neighbourhood: json.neighborhood || null,
          "House Number": json["House Number"] || null,
        };
      } catch (error) {
        if (
          (error as Error).message.includes("CSP") ||
          (error as Error).name === "TypeError"
        ) {
          addLog(
            "⚠️ Geocodio fetch blocked (posible CSP). Usa endpoint interno confirmado.",
            "warning"
          );
        }
        return { success: false as const, error: (error as Error).message };
      }
    },
    [
      addLog,
      checkApiLimit,
      updateApiUsage,
      handleApiLimitReached,
      apiUsage.geocodioUsed,
    ]
  );

  // Get neighborhood from Gemini (enhanced) – avoids caching empty N/A-only responses
  interface ExtendedGeminiContext {
    neighborhood?: string | null;
    city?: string;
    county?: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
    mode?: string;
  }
  const getNeighborhoodFromGemini = useCallback(
    async (
      address: string,
      zip: string,
      city: string,
      county: string,
      contextData?: ExtendedGeminiContext
    ): Promise<GeminiResult> => {
      const fullAddress = `${address}, ${city}, ${county}, FL`;
      const cacheKey = `gemini_simple_${btoa(`${address}_${city}_${county}`.toLowerCase().trim())}`;

      // Cache lookup – drop empty successes
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedObj = JSON.parse(cached);
          const ageMinutes = (Date.now() - cachedObj.timestamp) / (1000 * 60);
          if (ageMinutes <= 30) {
            const cr = cachedObj.result;
            if (cr?.success === true && !cr.neighborhood && !cr.community) {
              localStorage.removeItem(cacheKey); // purge useless
            } else {
              addLog(`📄 Using cached Gemini result for: ${address}`, "info");
              return cr;
            }
          } else {
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (e) {
        console.warn("Gemini cache read error", e);
      }

      if (!checkApiLimit("gemini")) {
        handleApiLimitReached("gemini");
        return {
          success: false as const,
          error: `Gemini API limit reached (${apiUsage.geminiUsed}/${API_LIMITS.gemini})`,
        };
      }

      const attempts = 3;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const baseCtxParts: string[] = [];
          if (contextData?.neighborhood)
            baseCtxParts.push(
              `Neighborhood detectado: ${contextData.neighborhood}`
            );
          if (contextData?.city)
            baseCtxParts.push(`Ciudad: ${contextData.city}`);
          if (contextData?.county)
            baseCtxParts.push(`Condado: ${contextData.county}`);
          if (contextData?.zip) baseCtxParts.push(`ZIP: ${contextData.zip}`);
          if (contextData?.latitude && contextData?.longitude)
            baseCtxParts.push(
              `Coords: ${contextData.latitude}, ${contextData.longitude}`
            );
          if (contextData?.mode === "community-only")
            baseCtxParts.push(
              "Modo: buscar SOLO comunidad/subdivision específica si existe"
            );

          const contextBase = baseCtxParts.join(" | ");
          const reinforcedContext =
            attempt === 1
              ? contextBase
              : `${contextBase} | Reintento ${attempt}: evita devolver 'N/A' en ambos campos; ofrece mejor candidato.`.trim();

          addLog(
            `🤖 Consulting Gemini (attempt ${attempt}/${attempts}) for: ${fullAddress}`,
            "info"
          );
          setStats((prev) => ({ ...prev, geminiCount: prev.geminiCount + 1 }));

          const response = await fetch("/api/geocoding/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address: fullAddress,
              context: reinforcedContext
                ? `Context: ${reinforcedContext}`
                : undefined,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            if (attempt < attempts) {
              const delay = 1500 * attempt;
              addLog(
                `⚠️ Gemini HTTP ${response.status}. Retrying in ${delay / 1000}s...`,
                "warning"
              );
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          console.log("🤖 Gemini Response:", data);

          if (data.success === true) {
            const rn = data.neighborhood?.trim();
            const rc = data.community?.trim();
            const neighborhood = rn && rn.toLowerCase() !== "n/a" ? rn : null;
            const community = rc && rc.toLowerCase() !== "n/a" ? rc : null;

            if (!neighborhood && !community) {
              addLog(
                `⚠️ Gemini returned empty data (attempt ${attempt})`,
                "warning"
              );
              if (attempt < attempts) {
                await new Promise((r) => setTimeout(r, 1200 * attempt));
                continue;
              }
              return {
                success: false,
                error: "No neighborhood/community data after retries",
              };
            }

            const result: GeminiSuccessResult = {
              success: true,
              neighborhood,
              community,
            };
            addLog(
              `✅ Gemini success: N=${neighborhood || "N/A"}, C=${community || "N/A"}`,
              "success"
            );
            updateApiUsage("gemini");
            try {
              localStorage.setItem(
                cacheKey,
                JSON.stringify({ result, timestamp: Date.now() })
              );
            } catch {}
            return result;
          } else {
            const errorMsg = data.error || "Gemini returned success:false";
            if (attempt < attempts) {
              addLog(`⏳ Gemini error: ${errorMsg}. Retrying...`, "warning");
              await new Promise((r) => setTimeout(r, 1200 * attempt));
              continue;
            }
            return { success: false as const, error: errorMsg };
          }
        } catch (err) {
          if (attempt < attempts) {
            addLog(
              `⏳ Gemini network/parse error: ${(err as Error).message}. Retrying...`,
              "warning"
            );
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }
          return {
            success: false as const,
            error: `Final Gemini error: ${(err as Error).message}`,
          };
        }
      }
      return { success: false as const, error: "Unexpected Gemini failure" };
    },
    [
      addLog,
      checkApiLimit,
      updateApiUsage,
      handleApiLimitReached,
      apiUsage.geminiUsed,
      setStats,
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

        // Step 1: Check for cached complete result first
        const cachedComplete = getCachedAddressResult(address);
        if (cachedComplete) {
          addLog(
            `📄 Using cached complete result for: ${address} - N:${cachedComplete.neighborhoods} C:${cachedComplete.comunidades}`,
            "info"
          );
          return {
            ...cachedComplete,
            ...addressData,
            original_address: address,
          };
        }

        // Step 2: Try Mapbox first (Primary for geocoding)
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
            const primaryGeminiResult = await getNeighborhoodFromGemini(
              address,
              zip,
              city,
              county,
              {
                neighborhood: mapboxResult.neighborhood,
                city,
                county,
                zip,
                latitude: mapboxResult.latitude,
                longitude: mapboxResult.longitude,
              }
            );

            let communityFound = false;
            if (primaryGeminiResult.success) {
              result.comunidades = normalizeValue(
                primaryGeminiResult.community
              );
              if (result.comunidades !== "N/A") {
                communityFound = true;
                result.community_source = "Gemini AI";
                result.api_source = "Mapbox + Gemini";
              } else {
                result.community_source = "N/A";
                result.comunidades = "N/A";
              }
            } else {
              result.comunidades = "N/A";
              result.community_source = "N/A";
            }

            // Fallback: segundo intento sólo para comunidad si no se obtuvo
            if (!communityFound) {
              addLog(
                `🔁 Gemini fallback: intentando extraer comunidad específica (solo community)`,
                "info"
              );
              const fallbackGemini = await getNeighborhoodFromGemini(
                address,
                zip,
                city,
                county,
                {
                  neighborhood: mapboxResult.neighborhood,
                  mode: "community-only",
                  city,
                  county,
                  zip,
                  latitude: mapboxResult.latitude,
                  longitude: mapboxResult.longitude,
                }
              );
              if (fallbackGemini.success && fallbackGemini.community) {
                const normalizedFallback = normalizeValue(
                  fallbackGemini.community
                );
                if (normalizedFallback !== "N/A") {
                  result.comunidades = normalizedFallback;
                  result.community_source = "Gemini AI (Fallback)";
                  result.api_source = "Mapbox + Gemini";
                }
              }

              // Intento agresivo final si sigue N/A
              if (
                (!result.comunidades || result.comunidades === "N/A") &&
                result.neighborhoods &&
                result.neighborhoods !== "N/A"
              ) {
                try {
                  addLog(
                    `🧪 Gemini intento final agresivo comunidad para: ${address}`,
                    "info"
                  );
                  const aggressiveResp = await fetch("/api/geocoding/gemini", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      address: `${address}, ${city}, ${county}, FL`,
                      context: `Neighborhood detectado: ${result.neighborhoods}. SOLO responde el JSON pedido. Si existe una subdivision/comunidad comercial diferente al vecindario general proporciónala; si no, mantén 'N/A' en community pero NO inventes.`,
                    }),
                  });
                  if (aggressiveResp.ok) {
                    const agData = await aggressiveResp.json();
                    if (
                      agData.success === true &&
                      agData.community &&
                      String(agData.community).toLowerCase() !== "n/a"
                    ) {
                      const val = normalizeValue(agData.community);
                      if (val !== "N/A") {
                        result.comunidades = val;
                        result.community_source = "Gemini AI (Aggressive)";
                        result.api_source = "Mapbox + Gemini";
                        addLog(
                          `✅ Aggressive community extracción: ${val}`,
                          "success"
                        );
                      }
                    }
                  }
                } catch (e) {
                  addLog(
                    `⚠️ Aggressive community attempt error: ${(e as Error).message}`,
                    "warning"
                  );
                }

                // Heurística final: mapping manual + copia condicional
                if (
                  (!result.comunidades || result.comunidades === "N/A") &&
                  result.neighborhoods &&
                  result.neighborhoods !== "N/A"
                ) {
                  const manualMap: Record<string, string> = {
                    // Ajusta según confirmaciones reales
                    "Kendall Green": "Kendall Green",
                    "Ocean Breeze": "Ocean Breeze Park",
                  };
                  const nh = result.neighborhoods.trim();
                  let guess = manualMap[nh];
                  // Si no está en el mapa pero parece nombre de subdivision (palabras clave)
                  if (!guess) {
                    const kw =
                      /(gate|park|heights|lake|lakes|estates|ridge|harbor|harbour|village|villages|greens?|pines?)$/i;
                    if (kw.test(nh)) {
                      guess = nh; // usar mismo nombre
                    }
                  }
                  if (guess && guess !== "N/A") {
                    result.comunidades = guess;
                    result.community_source = "Heuristic";
                    result.api_source = "Mapbox + Heuristic";
                    addLog(
                      `🧩 Heurística comunidad asignada: ${guess} (desde neighborhood ${nh})`,
                      "warning"
                    );
                  }
                }
              }
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
              zip,
              city,
              county,
              { neighborhood: mapboxResult.neighborhood }
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
      getCachedAddressResult,
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

        // DEDUPLICATION: map normalized address -> indices
        const normalized = (s: string) =>
          s.toLowerCase().trim().replace(/\s+/g, " ");
        const addressIndexMap = new Map<string, number[]>();
        validAddresses.forEach((row, idx) => {
          const addr = String(row[detectedCols.address!]);
          const key = normalized(addr);
          if (!addressIndexMap.has(key)) addressIndexMap.set(key, []);
          addressIndexMap.get(key)!.push(idx);
        });
        addLog(
          `🧬 Deduplicated ${validAddresses.length} -> ${addressIndexMap.size} direcciones únicas`,
          "info"
        );

        const uniqueKeys = Array.from(addressIndexMap.keys());
        const results: ProcessedResult[] = [...existingResults];
        results.length = validAddresses.length; // pre-allocate for placement
        let processedUnique = 0;
        let successCount = existingResults.filter(
          (r) => r.status === "success"
        ).length;

        // Worker pool
        let cursor = startIndex;
        const pending: Promise<void>[] = [];

        const launchNext = (): Promise<void> => {
          if (shouldStopProcessing.current) return Promise.resolve();
          if (cursor >= uniqueKeys.length) return Promise.resolve();
          const uniqueKey = uniqueKeys[cursor++];
          const firstIndex = addressIndexMap.get(uniqueKey)![0];
          const row = validAddresses[firstIndex];
          const run = async () => {
            const addr = String(row[detectedCols.address!]);
            setProgress({
              current: processedUnique + 1,
              total: uniqueKeys.length,
              percentage: Math.round(
                ((processedUnique + 1) / uniqueKeys.length) * 100
              ),
              currentAddress: addr,
            });
            let result = getCachedAddressResult(addr);
            if (result) {
              result = { ...result, ...row };
            } else {
              result = await processAddress(row, detectedCols);
              if (result.status === "success") cacheAddressResult(addr, result);
            }
            // Assign result to all duplicate indices
            addressIndexMap.get(uniqueKey)!.forEach((idx) => {
              results[idx] = { ...result!, ...validAddresses[idx] };
            });
            if (result.status === "success")
              successCount += addressIndexMap.get(uniqueKey)!.length;
            processedUnique++;
            setStats((prev) => ({
              ...prev,
              totalProcessed: processedUnique,
              successRate: `${Math.round((successCount / validAddresses.length) * 100)}%`,
            }));
            setResults([...results]);
            if (processedUnique % SAVE_INTERVAL === 0) {
              saveProgress(
                results.filter(Boolean) as ProcessedResult[],
                processedUnique,
                validAddresses.length,
                file.name,
                stats,
                detectedCols,
                validAddresses
              );
              addLog(
                `💾 Auto-saved (pool) ${processedUnique}/${uniqueKeys.length}`,
                "info"
              );
            }
            // Schedule next after delay to respect pacing
            await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS));
          };
          return run()
            .catch((e) =>
              addLog(`❌ Error pool: ${(e as Error).message}`, "error")
            )
            .finally(() => {})
            .then(() => launchNext());
        };

        // Start initial workers
        for (let i = 0; i < CONCURRENCY_LIMIT && i < uniqueKeys.length; i++) {
          pending.push(launchNext());
        }
        await Promise.all(pending);

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
            result?.["ML#"] ??
            result?.["MLS#"] ??
            result?.["MLSNumber"] ??
            result?.["MLS Number"] ??
            result?.["ListingID"] ??
            result?.["Listing ID"] ??
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
      ...recoveryData.results.map((result) => {
        if (!result) {
          return [
            '""',
            '""',
            '""',
            '""',
            '""',
            '""',
            "",
            "",
            '"N/A"',
            '"N/A"',
            '"N/A"',
            '"N/A"',
            "",
            '""',
          ]; // defensive empty row
        }
        const mlId =
          result?.["ML#"] ||
          result?.["MLS#"] ||
          result?.["MLSNumber"] ||
          result?.["MLS Number"] ||
          result?.["ListingID"] ||
          result?.["Listing ID"] ||
          "";
        return [
          `"${mlId}"`,
          `"${
            result.original_address ||
            result?.["Address"] ||
            result?.["Internet Display"] ||
            ""
          }"`,
          `"${result?.["Zip Code"] || ""}"`,
          `"${result?.["City Name"] || ""}"`,
          `"${result?.["County"] || ""}"`,
          `"${result?.["House Number"] || ""}"`,
          result.latitude || "",
          result.longitude || "",
          `"${result.neighborhoods || "N/A"}"`,
          `"${result.neighborhood_source || "N/A"}"`,
          `"${result.comunidades || "N/A"}"`,
          `"${result.community_source || "N/A"}"`,
          result.status || "",
          `"${result.api_source || ""}"`,
        ].join(",");
      }),
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
    clearAllCache,
    clearGeminiCache,
    clearCacheForTesting,
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
    // API Limit modal
    showApiLimitModal,
    setShowApiLimitModal,
    apiLimitInfo,
    closeApiLimitModal,
    continueWithOtherApis,
  };
}
