"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import PQueue from "p-queue";
import pRetry from "p-retry";
import pLimit from "p-limit";
import { useAutoSave } from "./useAutoSave";

// ===================================================================
// OPTIMIZED MLS PROCESSOR - DESIGNED FOR 100K+ RECORDS
// Target: Process 100,000 records in 60 minutes (28 records/second)
// ===================================================================

// Types
export interface MLSData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ProcessedResult extends MLSData {
  original_address: string;
  status: "success" | "error" | "cached";
  api_source?: string;
  processed_at: string;
  formatted_address?: string;
  latitude?: number;
  longitude?: number;
  neighbourhood?: string;
  neighborhoods?: string;
  comunidades?: string;
  Community?: string; // Add Excel-compatible field name
  neighborhood_source?: string;
  community_source?: string;
  "Community Source"?: string; // Add Excel-compatible field name
  error?: string;
  processing_time_ms?: number;
  cached_result?: boolean;
}

// Enhanced API response types with performance tracking
export interface OptimizedMapboxResult {
  success: boolean;
  data?: {
    formatted: string;
    latitude: number;
    longitude: number;
    neighborhood: string | null;
    confidence?: number;
    "House Number": string | null;
  };
  error?: string;
  cached?: boolean;
  processing_time_ms?: number;
  rate_limited?: boolean;
}

export interface OptimizedGeocodioResult {
  success: boolean;
  data?: {
    formatted: string;
    latitude: number;
    longitude: number;
    neighbourhood: string | null;
    accuracy?: number;
    "House Number": string | null;
  };
  error?: string;
  cached?: boolean;
  processing_time_ms?: number;
  rate_limited?: boolean;
}

export interface OptimizedGeminiResult {
  success: boolean;
  data?: {
    neighborhood: string | null;
    community: string | null;
    confidence?: number;
  };
  error?: string;
  cached?: boolean;
  processing_time_ms?: number;
  rate_limited?: boolean;
}

// Enhanced stats with performance metrics
export interface OptimizedStats {
  totalProcessed: number;
  successRate: string;
  throughputPerSecond: number;
  avgProcessingTimeMs: number;

  // API usage
  mapboxCount: number;
  geocodioCount: number;
  geminiCount: number;
  cacheHits: number;

  // Performance metrics
  totalProcessingTimeMs: number;
  batchesCompleted: number;
  currentBatchSize: number;
  estimatedTimeRemaining: string;
}

// Batch processing configuration
export interface BatchConfig {
  batchSize: number;
  concurrencyLimit: number;
  maxRetries: number;
  retryDelayMs: number;
  enableCache: boolean;
  cacheExpiryHours: number;
}

export interface OptimizedProgress {
  current: number;
  total: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  currentAddress: string;
  throughputPerSecond: number;
  estimatedTimeRemaining: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "success" | "error" | "warning" | "performance";
  batchNumber?: number;
  processingTimeMs?: number;
}

export interface DetectedColumns {
  address: string | null;
  zip: string | null;
  city: string | null;
  county: string | null;
  mlNumber: string | null; // ML# - MLS Number
  neighborhoods: string | null; // Neighborhoods
  communities: string | null; // Communities
}

export interface FileData {
  data: MLSData[];
  columns: string[];
  fileName: string;
  fileSize: number; // Size in bytes
}

// In-memory cache interface

interface MapboxCacheEntry {
  key: string;
  data: OptimizedMapboxResult["data"] | null;
  timestamp: number;
  expiryTime: number;
  hitCount: number;
}

interface GeminiCacheEntry {
  key: string;
  data: OptimizedGeminiResult["data"] | null;
  timestamp: number;
  expiryTime: number;
  hitCount: number;
}

// ===================================================================
// OPTIMIZED CONFIGURATION + PERSISTENCE SYSTEM
// ===================================================================

// Storage keys for persistence (like original version)
const OPTIMIZED_STORAGE_KEY = "mls_optimized_processing_progress";
const OPTIMIZED_CACHE_KEY = "mls_optimized_address_cache";
const OPTIMIZED_GEMINI_CACHE_KEY = "mls_optimized_gemini_cache";
const AUTO_SAVE_INTERVAL = 5; // Auto-save every 5 processed records

// Recovery interface for progress persistence
export interface OptimizedProcessingProgress {
  results: ProcessedResult[];
  currentIndex: number;
  totalAddresses: number;
  fileName: string;
  timestamp: number;
  stats: OptimizedStats;
  detectedColumns: DetectedColumns;
  validAddresses: MLSData[];
  batchConfig: BatchConfig;
}

// Adaptive configuration based on dataset size
const getOptimizedConfigForSize = (recordCount: number) => {
  if (recordCount <= 50) {
    // Small test files (9-50 records) - Fast & Responsive
    return {
      CONCURRENCY_LIMIT: 15,
      BATCH_SIZE: 25,
      MAX_RETRIES: 3,
      TARGET_THROUGHPUT: 25,
      MEMORY_CLEANUP_INTERVAL: 10000,
      RETRY_DELAY_BASE: 500,
      CACHE_EXPIRY_HOURS: 6,
    };
  } else if (recordCount <= 1000) {
    // Medium files (1000 records) - Balanced Performance
    return {
      CONCURRENCY_LIMIT: 20,
      BATCH_SIZE: 100,
      MAX_RETRIES: 3,
      TARGET_THROUGHPUT: 22,
      MEMORY_CLEANUP_INTERVAL: 8000,
      RETRY_DELAY_BASE: 1000,
      CACHE_EXPIRY_HOURS: 12,
    };
  } else if (recordCount <= 10000) {
    // Large files (10K records) - Optimized Throughput
    return {
      CONCURRENCY_LIMIT: 15,
      BATCH_SIZE: 200,
      MAX_RETRIES: 2,
      TARGET_THROUGHPUT: 18,
      MEMORY_CLEANUP_INTERVAL: 6000,
      RETRY_DELAY_BASE: 1500,
      CACHE_EXPIRY_HOURS: 24,
    };
  } else {
    // Very large files (30K-110K) - Ultra Stable
    return {
      CONCURRENCY_LIMIT: 10,
      BATCH_SIZE: 100,
      MAX_RETRIES: 2,
      TARGET_THROUGHPUT: 15,
      MEMORY_CLEANUP_INTERVAL: 5000,
      RETRY_DELAY_BASE: 2000,
      CACHE_EXPIRY_HOURS: 48,
    };
  }
};

// Base configuration - will be overridden by adaptive config
const OPTIMIZED_CONFIG = {
  // No artificial delays - rely on intelligent rate limiting
  DELAY_BETWEEN_REQUESTS: 0,
  GEMINI_DELAY: 0,

  // Default values (will be overridden)
  CONCURRENCY_LIMIT: 15,
  BATCH_SIZE: 100,

  // Queue configuration
  QUEUE_CONCURRENCY: 30,
  QUEUE_INTERVAL: 100,

  // Smart retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,
  RETRY_EXPONENTIAL_BASE: 2,

  // Cache configuration
  CACHE_EXPIRY_HOURS: 168, // 7 days for geocoding
  GEMINI_CACHE_EXPIRY_HOURS: 720, // 30 days for gemini

  // Performance thresholds
  TARGET_THROUGHPUT: 20,
  SLOW_REQUEST_THRESHOLD: 5000,
  RATE_LIMIT_COOLDOWN: 60000,

  // Memory management
  MEMORY_CLEANUP_INTERVAL: 8000,
  MAX_MEMORY_USAGE_MB: 1024,
};

// Conservative API limits for high-volume processing (100K+ records)
const OPTIMIZED_API_LIMITS = {
  mapbox: 100000, // Daily limit
  geocodio: 50000, // Daily limit
  gemini: 100000, // Daily limit

  // Per-minute rates (conservative for large datasets)
  mapboxPerMinute: 300, // Reduced from 600 for stability
  geocodioPerMinute: 500, // Reduced from 1000 for stability
  geminiPerMinute: 750, // Reduced from 1500 for stability
};

// Log API limits for reference
console.log("🔧 API Rate Limits:", OPTIMIZED_API_LIMITS);

// ===================================================================
// IN-MEMORY CACHE IMPLEMENTATION
// ===================================================================

class MapboxMemoryCache {
  private cache = new Map<string, MapboxCacheEntry>();

  set(
    key: string,
    data: OptimizedMapboxResult["data"] | null,
    expiryHours: number
  ): void {
    const timestamp = Date.now();
    const expiryTime = timestamp + expiryHours * 60 * 60 * 1000;
    this.cache.set(key, {
      key,
      data,
      timestamp,
      expiryTime,
      hitCount: 0,
    });
    if (this.cache.size % 100 === 0) {
      this.cleanup();
    }
  }

  get(key: string): OptimizedMapboxResult["data"] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiryTime) {
      this.cache.delete(key);
      return null;
    }
    entry.hitCount++;
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiryTime) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiryTime) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { totalEntries: number; totalHits: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }
    return {
      totalEntries: this.cache.size,
      totalHits,
    };
  }
}

class GeminiMemoryCache {
  private cache = new Map<string, GeminiCacheEntry>();

  set(
    key: string,
    data: OptimizedGeminiResult["data"] | null,
    expiryHours: number
  ): void {
    const timestamp = Date.now();
    const expiryTime = timestamp + expiryHours * 60 * 60 * 1000;
    this.cache.set(key, {
      key,
      data,
      timestamp,
      expiryTime,
      hitCount: 0,
    });
    if (this.cache.size % 100 === 0) {
      this.cleanup();
    }
  }

  get(key: string): OptimizedGeminiResult["data"] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiryTime) {
      this.cache.delete(key);
      return null;
    }
    entry.hitCount++;
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiryTime) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiryTime) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { totalEntries: number; totalHits: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }
    return {
      totalEntries: this.cache.size,
      totalHits,
    };
  }
}

// ===================================================================
// OPTIMIZED MLS PROCESSOR HOOK
// ===================================================================

export function useMLSProcessorOptimized(userId?: string | null) {
  const logIdCounter = useRef(0);
  const shouldStopProcessing = useRef(false);
  const startTime = useRef<number>(0);
  const batchStartTime = useRef<number>(0);
  const processingQueue = useRef<PQueue | null>(null);
  const memoryCleanupInterval = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<ProcessedResult[]>([]);

  // Auto-save integration
  const autoSave = useAutoSave(userId);

  // In-memory caches
  const geocodingCache = useRef(new MapboxMemoryCache());
  const geminiCache = useRef(new GeminiMemoryCache());

  const performanceMetrics = useRef({
    totalRequests: 0,
    totalProcessingTime: 0,
    cacheHitCount: 0,
    errorCount: 0,
    rateLimitCount: 0,
  });

  // Enhanced state management
  const [stats, setStats] = useState<OptimizedStats>({
    totalProcessed: 0,
    successRate: "0%",
    throughputPerSecond: 0,
    avgProcessingTimeMs: 0,
    mapboxCount: 0,
    geocodioCount: 0,
    geminiCount: 0,
    cacheHits: 0,
    totalProcessingTimeMs: 0,
    batchesCompleted: 0,
    currentBatchSize: 0,
    estimatedTimeRemaining: "Calculating...",
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<OptimizedProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    currentBatch: 0,
    totalBatches: 0,
    currentAddress: "",
    throughputPerSecond: 0,
    estimatedTimeRemaining: "Calculating...",
  });

  const [results, setResults] = useState<ProcessedResult[]>([]);

  // Keep resultsRef in sync with results state
  useEffect(() => {
    console.log(
      "📊 Updating resultsRef from:",
      resultsRef.current.length,
      "to:",
      results.length
    );
    resultsRef.current = results;
  }, [results]);

  const [detectedColumns, setDetectedColumns] = useState<DetectedColumns>({
    address: null,
    zip: null,
    city: null,
    county: null,
    mlNumber: null,
    neighborhoods: null,
    communities: null,
  });

  const [fileData, setFileData] = useState<FileData | null>(null);
  const [batchConfig, setBatchConfig] = useState<BatchConfig>({
    batchSize: 30, // Default - will be overridden by adaptive config
    concurrencyLimit: 8, // Default - will be overridden by adaptive config
    maxRetries: 3, // Default - will be overridden by adaptive config
    retryDelayMs: 1000,
    enableCache: true,
    cacheExpiryHours: 24,
  });

  // ===================================================================
  // MODAL STATES FOR PERSISTENCE SYSTEM
  // ===================================================================
  const [recoveryData, setRecoveryData] =
    useState<OptimizedProcessingProgress | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isContinuingFromRecovery, setIsContinuingFromRecovery] =
    useState(false);

  // Debug modal states
  useEffect(() => {
    console.log("🎯 Modal States:", {
      showRecoveryModal,
      showStopModal,
      showSuccessModal,
      hasRecoveryData: !!recoveryData,
      isContinuingFromRecovery,
    });
  }, [
    showRecoveryModal,
    showStopModal,
    showSuccessModal,
    recoveryData,
    isContinuingFromRecovery,
  ]);

  // ===================================================================
  // OPTIMIZED UTILITY FUNCTIONS
  // ===================================================================

  const addLog = useCallback(
    (
      message: string,
      type: LogEntry["type"] = "info",
      batchNumber?: number,
      processingTimeMs?: number
    ) => {
      logIdCounter.current += 1;
      const newLog: LogEntry = {
        id: `${Date.now()}-${logIdCounter.current}`,
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
        batchNumber,
        processingTimeMs,
      };
      setLogs((prev) => [...prev.slice(-199), newLog]); // Keep only last 200 logs

      if (type === "error") {
        console.error(`[${type.toUpperCase()}] ${message}`);
      } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
    },
    []
  );

  const generateHash = useCallback((input: string): string => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }, []);

  const normalizeAddress = useCallback(
    (address: string, city: string = "", county: string = ""): string => {
      const normalized = `${address.trim()} ${city.trim()} ${county.trim()}`
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      return normalized;
    },
    []
  );

  // ===================================================================
  // IN-MEMORY CACHE FUNCTIONS
  // ===================================================================

  const getCachedGeocodingResult = useCallback(
    (
      address: string,
      city: string = "",
      county: string = ""
    ): OptimizedMapboxResult | null => {
      if (!batchConfig.enableCache) return null;

      try {
        const normalized = normalizeAddress(address, city, county);
        const cacheKey = generateHash(normalized);
        const cached = geocodingCache.current.get(cacheKey);

        if (cached) {
          performanceMetrics.current.cacheHitCount++;
          return {
            success: true,
            cached: true,
            data: cached,
          };
        }

        return null;
      } catch (error) {
        console.warn("Cache lookup error:", error);
        return null;
      }
    },
    [batchConfig.enableCache, normalizeAddress, generateHash]
  );

  const cacheGeocodingResult = useCallback(
    (
      address: string,
      city: string = "",
      county: string = "",
      result: OptimizedMapboxResult["data"]
    ): void => {
      if (!batchConfig.enableCache || !result) return;

      try {
        const normalized = normalizeAddress(address, city, county);
        const cacheKey = generateHash(normalized);

        geocodingCache.current.set(
          cacheKey,
          result,
          batchConfig.cacheExpiryHours
        );
      } catch (error) {
        console.warn("Cache save error:", error);
      }
    },
    [
      batchConfig.enableCache,
      batchConfig.cacheExpiryHours,
      normalizeAddress,
      generateHash,
    ]
  );

  const getCachedGeminiResult = useCallback(
    (
      address: string,
      city: string,
      county: string
    ): OptimizedGeminiResult | null => {
      if (!batchConfig.enableCache) return null;

      try {
        const locationKey = `${address.toLowerCase()} ${city.toLowerCase()} ${county.toLowerCase()}`;
        const cacheKey = generateHash(locationKey);
        const cached = geminiCache.current.get(cacheKey);

        if (cached) {
          performanceMetrics.current.cacheHitCount++;
          return {
            success: true,
            cached: true,
            data: cached,
          };
        }

        return null;
      } catch (error) {
        console.warn("Gemini cache lookup error:", error);
        return null;
      }
    },
    [batchConfig.enableCache, generateHash]
  );

  const cacheGeminiResult = useCallback(
    (
      address: string,
      city: string,
      county: string,
      result: OptimizedGeminiResult["data"]
    ): void => {
      if (!batchConfig.enableCache || !result) return;

      try {
        const locationKey = `${address.toLowerCase()} ${city.toLowerCase()} ${county.toLowerCase()}`;
        const cacheKey = generateHash(locationKey);

        geminiCache.current.set(
          cacheKey,
          result,
          OPTIMIZED_CONFIG.GEMINI_CACHE_EXPIRY_HOURS
        );
      } catch (error) {
        console.warn("Gemini cache save error:", error);
      }
    },
    [batchConfig.enableCache, generateHash]
  );

  // ===================================================================
  // PERSISTENCE SYSTEM (localStorage + Memory)
  // ===================================================================

  // Save processing progress to localStorage
  const saveProgress = useCallback(
    (
      results: ProcessedResult[],
      currentIndex: number,
      totalAddresses: number,
      fileName: string,
      stats: OptimizedStats,
      detectedColumns: DetectedColumns,
      validAddresses: MLSData[]
    ) => {
      try {
        const progressData: OptimizedProcessingProgress = {
          results,
          currentIndex,
          totalAddresses,
          fileName,
          timestamp: Date.now(),
          stats,
          detectedColumns,
          validAddresses,
          batchConfig,
        };

        localStorage.setItem(
          OPTIMIZED_STORAGE_KEY,
          JSON.stringify(progressData)
        );

        // Also save cache data to localStorage for persistence
        const cacheData = {
          geocoding: {},
          gemini: {},
        };

        localStorage.setItem(OPTIMIZED_CACHE_KEY, JSON.stringify(cacheData));

        addLog(
          `💾 Progress auto-saved: ${results.length} records processed`,
          "info"
        );
      } catch (error) {
        addLog(
          `❌ Failed to save progress: ${(error as Error).message}`,
          "error"
        );
      }
    },
    [batchConfig, addLog]
  );

  // Load saved progress from localStorage
  const loadProgress = useCallback((): OptimizedProcessingProgress | null => {
    try {
      const savedData = localStorage.getItem(OPTIMIZED_STORAGE_KEY);
      if (!savedData) return null;

      const progressData: OptimizedProcessingProgress = JSON.parse(savedData);

      // Check if data is recent (within last 24 hours)
      const isRecent =
        Date.now() - progressData.timestamp < 24 * 60 * 60 * 1000;
      if (!isRecent) {
        localStorage.removeItem(OPTIMIZED_STORAGE_KEY);
        return null;
      }

      return progressData;
    } catch (error) {
      console.warn("Failed to load progress:", error);
      localStorage.removeItem(OPTIMIZED_STORAGE_KEY);
      return null;
    }
  }, []);

  // Clear saved progress
  const clearProgress = useCallback(() => {
    try {
      localStorage.removeItem(OPTIMIZED_STORAGE_KEY);
      localStorage.removeItem(OPTIMIZED_CACHE_KEY);
      localStorage.removeItem(OPTIMIZED_GEMINI_CACHE_KEY);
      setRecoveryData(null);
      addLog("🧹 Saved progress and cache cleared", "info");
    } catch (error) {
      addLog(
        `❌ Failed to clear progress: ${(error as Error).message}`,
        "error"
      );
    }
  }, [addLog]);

  // ===================================================================
  // OPTIMIZED API FUNCTIONS WITH SMART RETRY LOGIC
  // ===================================================================

  const geocodeWithMapboxOptimized = useCallback(
    async (
      address: string,
      zip: string,
      city: string,
      county: string
    ): Promise<OptimizedMapboxResult> => {
      const startTime = performance.now();

      try {
        // Check cache first
        const cachedResult = getCachedGeocodingResult(address, city, county);
        if (cachedResult) {
          return cachedResult;
        }

        // Prepare request
        const fullAddress = [address, zip, city, county]
          .filter(Boolean)
          .join(", ");

        const result = await pRetry(
          async () => {
            const response = await fetch("/api/geocoding/mapbox", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: fullAddress }),
            });

            if (!response.ok) {
              if (response.status === 429) {
                const retryAfter = response.headers.get("Retry-After");
                const delay = retryAfter
                  ? parseInt(retryAfter) * 1000
                  : OPTIMIZED_CONFIG.RATE_LIMIT_COOLDOWN;
                const error = new Error(
                  `Rate limited, retry after ${delay}ms`
                ) as Error & { name: string };
                error.name = "AbortError";
                throw error;
              }
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`
              );
            }

            const data = await response.json();
            if (!data.success) {
              throw new Error(data.error || "Mapbox request failed");
            }

            return data;
          },
          {
            retries: batchConfig.maxRetries,
            factor: OPTIMIZED_CONFIG.RETRY_EXPONENTIAL_BASE,
            minTimeout: batchConfig.retryDelayMs,
            maxTimeout: 30000,
          }
        );

        const processingTime = performance.now() - startTime;
        performanceMetrics.current.totalRequests++;
        performanceMetrics.current.totalProcessingTime += processingTime;

        const optimizedResult: OptimizedMapboxResult = {
          success: true,
          data: {
            formatted: result.formatted,
            latitude: result.latitude,
            longitude: result.longitude,
            neighborhood: result.neighborhood,
            confidence: result.confidence,
            "House Number": result["House Number"] || null,
          },
          processing_time_ms: Math.round(processingTime),
        };

        // Cache the result
        cacheGeocodingResult(address, city, county, optimizedResult.data);

        setStats((prev) => ({
          ...prev,
          mapboxCount: prev.mapboxCount + 1,
        }));

        return optimizedResult;
      } catch (error) {
        const processingTime = performance.now() - startTime;
        performanceMetrics.current.errorCount++;

        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown Mapbox error",
          processing_time_ms: Math.round(processingTime),
        };
      }
    },
    [
      batchConfig.maxRetries,
      batchConfig.retryDelayMs,
      getCachedGeocodingResult,
      cacheGeocodingResult,
    ]
  );

  const geocodeWithGeocodioOptimized = useCallback(
    async (
      address: string,
      zip: string,
      city: string,
      county: string
    ): Promise<OptimizedGeocodioResult> => {
      const startTime = performance.now();

      try {
        // Check cache first (reuse geocoding cache structure)
        const cachedResult = getCachedGeocodingResult(address, city, county);
        if (cachedResult) {
          return {
            success: cachedResult.success,
            data: cachedResult.data
              ? {
                  formatted: cachedResult.data.formatted,
                  latitude: cachedResult.data.latitude,
                  longitude: cachedResult.data.longitude,
                  neighbourhood: cachedResult.data.neighborhood,
                  accuracy: cachedResult.data.confidence,
                  "House Number": cachedResult.data["House Number"],
                }
              : undefined,
            cached: true,
          };
        }

        const fullAddress = [address, zip, city, county]
          .filter(Boolean)
          .join(", ");

        const result = await pRetry(
          async () => {
            const response = await fetch("/api/geocoding/geocodio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: fullAddress }),
            });

            if (!response.ok) {
              if (response.status === 429) {
                const error = new Error("Rate limited by Geocodio") as Error & {
                  name: string;
                };
                error.name = "AbortError";
                throw error;
              }
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`
              );
            }

            const data = await response.json();
            if (!data.success) {
              throw new Error(data.error || "Geocodio request failed");
            }

            return data;
          },
          {
            retries: batchConfig.maxRetries,
            factor: OPTIMIZED_CONFIG.RETRY_EXPONENTIAL_BASE,
            minTimeout: batchConfig.retryDelayMs,
            maxTimeout: 30000,
          }
        );

        const processingTime = performance.now() - startTime;
        performanceMetrics.current.totalRequests++;
        performanceMetrics.current.totalProcessingTime += processingTime;

        const optimizedResult: OptimizedGeocodioResult = {
          success: true,
          data: {
            formatted: result.formatted,
            latitude: result.latitude,
            longitude: result.longitude,
            neighbourhood: result.neighbourhood,
            accuracy: result.accuracy,
            "House Number": result["House Number"] || null,
          },
          processing_time_ms: Math.round(processingTime),
        };

        // Cache the result (convert to mapbox format for unified cache)
        cacheGeocodingResult(address, city, county, {
          formatted: result.formatted,
          latitude: result.latitude,
          longitude: result.longitude,
          neighborhood: result.neighbourhood,
          confidence: result.accuracy,
          "House Number": result["House Number"] || null,
        });

        setStats((prev) => ({
          ...prev,
          geocodioCount: prev.geocodioCount + 1,
        }));

        return optimizedResult;
      } catch (error) {
        const processingTime = performance.now() - startTime;
        performanceMetrics.current.errorCount++;

        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown Geocodio error",
          processing_time_ms: Math.round(processingTime),
        };
      }
    },
    [
      batchConfig.maxRetries,
      batchConfig.retryDelayMs,
      getCachedGeocodingResult,
      cacheGeocodingResult,
    ]
  );

  const getNeighborhoodFromGeminiOptimized = useCallback(
    async (
      address: string,
      zip: string,
      city: string,
      county: string
    ): Promise<OptimizedGeminiResult> => {
      const startTime = performance.now();

      try {
        // Check cache first
        const cachedResult = getCachedGeminiResult(address, city, county);
        if (cachedResult) {
          // Debug: Log cache hit for problematic addresses
          const fullAddr = `${address}, ${city}, ${county}`;
          if (
            fullAddr.includes("1920 NW 3rd Ave") ||
            fullAddr.includes("2021 Wilmington St")
          ) {
            console.log("🔄 [DEBUG] CACHE HIT for problematic address:", {
              address: fullAddr,
              cachedData: cachedResult.data,
              cached: true,
            });
          }
          return cachedResult;
        }

        const result = await pRetry(
          async () => {
            const response = await fetch("/api/geocoding/gemini-optimized", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address, city, county }),
            });

            if (!response.ok) {
              if (response.status === 429) {
                const error = new Error("Rate limited by Gemini") as Error & {
                  name: string;
                };
                error.name = "AbortError";
                throw error;
              }
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`
              );
            }

            const data = await response.json();
            if (!data.success) {
              throw new Error(data.error || "Gemini request failed");
            }

            return data;
          },
          {
            retries: batchConfig.maxRetries,
            factor: OPTIMIZED_CONFIG.RETRY_EXPONENTIAL_BASE,
            minTimeout: batchConfig.retryDelayMs,
            maxTimeout: 30000,
          }
        );

        const processingTime = performance.now() - startTime;
        performanceMetrics.current.totalRequests++;
        performanceMetrics.current.totalProcessingTime += processingTime;

        const optimizedResult: OptimizedGeminiResult = {
          success: true,
          data: {
            neighborhood: result.neighborhood,
            community: result.community,
            confidence: result.confidence,
          },
          processing_time_ms: Math.round(processingTime),
        };

        // Debug: Log the Gemini result for troubleshooting
        console.log("🤖 [DEBUG] Gemini Result:", {
          address: `${address}, ${city}, ${county}`,
          apiResponse: result,
          processedData: optimizedResult.data,
          community: result.community,
          neighborhood: result.neighborhood,
          success: result.success,
          hasData: !!optimizedResult.data,
        });

        // Cache the result
        cacheGeminiResult(address, city, county, optimizedResult.data);

        setStats((prev) => ({
          ...prev,
          geminiCount: prev.geminiCount + 1,
        }));

        return optimizedResult;
      } catch (error) {
        const processingTime = performance.now() - startTime;
        performanceMetrics.current.errorCount++;

        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown Gemini error",
          processing_time_ms: Math.round(processingTime),
        };
      }
    },
    [
      batchConfig.maxRetries,
      batchConfig.retryDelayMs,
      getCachedGeminiResult,
      cacheGeminiResult,
    ]
  );

  // ===================================================================
  // OPTIMIZED BATCH PROCESSING ENGINE
  // ===================================================================

  const processAddressOptimized = useCallback(
    async (
      addressData: MLSData,
      columns: DetectedColumns
    ): Promise<ProcessedResult> => {
      const startTime = performance.now();
      const address = addressData[columns.address!] as string;

      // Get ML# if available
      const mlNumber = columns.mlNumber
        ? (addressData[columns.mlNumber] as string)
        : "";

      // Get existing neighborhoods and communities from Excel if available
      const existingNeighborhoods = columns.neighborhoods
        ? (addressData[columns.neighborhoods] as string)
        : "";
      const existingCommunities = columns.communities
        ? (addressData[columns.communities] as string)
        : "";

      // Extraer House Number del address si no existe explícitamente
      let houseNumber = "";
      if (address) {
        const match = address.match(/^(\d+)\s+/);
        if (match) {
          houseNumber = match[1];
        }
      }
      const zip = columns.zip ? (addressData[columns.zip] as string) : "";
      const city = columns.city ? (addressData[columns.city] as string) : "";
      const county = columns.county
        ? (addressData[columns.county] as string)
        : "";

      try {
        let result: ProcessedResult = {
          ...addressData,
          original_address: address,
          Address: address,
          "House Number": addressData["House Number"] ?? houseNumber ?? "",
          "ML#": mlNumber, // Add ML# to result
          status: "success",
          api_source: "Optimized Pipeline",
          processed_at: new Date().toISOString(),
          cached_result: false,
          // Use Excel data first, fallback to API data
          comunidades: existingCommunities || "N/A",
          Community: existingCommunities || "N/A",
          community_source: existingCommunities ? "Excel" : "N/A",
          "Community Source": existingCommunities ? "Excel" : "N/A",
          neighborhoods: existingNeighborhoods || "N/A",
          neighborhood_source: existingNeighborhoods ? "Excel" : "N/A",
        };

        // Step 1: Try Mapbox first (fastest, most reliable)
        const mapboxResult = await geocodeWithMapboxOptimized(
          address,
          zip,
          city,
          county
        );

        if (mapboxResult.success && mapboxResult.data) {
          result = {
            ...result,
            formatted_address: mapboxResult.data.formatted,
            latitude: mapboxResult.data.latitude,
            longitude: mapboxResult.data.longitude,
            neighbourhood: mapboxResult.data.neighborhood || undefined,
            "House Number":
              mapboxResult.data["House Number"] || houseNumber || "",
            // Only use Mapbox neighborhood if not already from Excel
            neighborhoods:
              existingNeighborhoods ||
              mapboxResult.data.neighborhood ||
              result.neighborhoods,
            neighborhood_source: existingNeighborhoods
              ? "Excel"
              : mapboxResult.cached
                ? "Cache"
                : "Mapbox",
            cached_result: mapboxResult.cached || false,
          };

          // Step 2: Try Gemini for community data only if not from Excel
          if (!existingCommunities || !existingNeighborhoods) {
            const geminiResult = await getNeighborhoodFromGeminiOptimized(
              address,
              zip,
              city,
              county
            );

            // Debug: Log Gemini processing result
            console.log("🏘️ [DEBUG] Processing Gemini Result:", {
              address: `${address}, ${city}, ${county}`,
              geminiSuccess: geminiResult.success,
              geminiData: geminiResult.data,
              community: geminiResult.data?.community,
              neighborhood: geminiResult.data?.neighborhood,
              cached: geminiResult.cached,
              existingCommunities,
              existingNeighborhoods,
            });

            if (geminiResult.success && geminiResult.data) {
              // Only use Gemini neighborhood if not from Excel and not from Mapbox
              if (
                !existingNeighborhoods &&
                geminiResult.data.neighborhood &&
                !mapboxResult.data.neighborhood
              ) {
                result.neighborhoods = geminiResult.data.neighborhood;
                result.neighborhood_source = geminiResult.cached
                  ? "Cache"
                  : "Gemini";
              }

              // Only use Gemini community if not from Excel
              if (!existingCommunities && geminiResult.data.community) {
                const communityValue = geminiResult.data.community;
                result.comunidades = communityValue;
                result["Community"] = communityValue;
                result["Community Source"] = geminiResult.cached
                  ? "Cache"
                  : "Gemini";
                result.community_source = geminiResult.cached
                  ? "Cache"
                  : "Gemini";
              }

              // Debug: Log community assignment
              console.log("🏘️ [DEBUG] Community Assignment:", {
                address: `${address}, ${city}, ${county}`,
                existingCommunities,
                geminiCommunity: geminiResult.data.community,
                finalCommunity: result["Community"],
                communitySource: result["Community Source"],
              });
            }
          }

          result.api_source =
            existingNeighborhoods && existingCommunities
              ? "Excel Data"
              : mapboxResult.cached
                ? "Cache"
                : "Mapbox + Gemini";
        } else {
          // Fallback to Geocodio
          const geocodioResult = await geocodeWithGeocodioOptimized(
            address,
            zip,
            city,
            county
          );

          if (geocodioResult.success && geocodioResult.data) {
            result = {
              ...result,
              formatted_address: geocodioResult.data.formatted,
              latitude: geocodioResult.data.latitude,
              longitude: geocodioResult.data.longitude,
              neighbourhood: geocodioResult.data.neighbourhood || undefined,
              "House Number":
                geocodioResult.data["House Number"] || houseNumber || "",
              // Only use Geocodio neighborhood if not from Excel
              neighborhoods:
                existingNeighborhoods ||
                geocodioResult.data.neighbourhood ||
                result.neighborhoods,
              neighborhood_source: existingNeighborhoods
                ? "Excel"
                : geocodioResult.cached
                  ? "Cache"
                  : "Geocodio",
              cached_result: geocodioResult.cached || false,
              api_source: "Geocodio Fallback",
            };

            // Try Gemini for community data only if not from Excel
            if (!existingCommunities) {
              const geminiResult = await getNeighborhoodFromGeminiOptimized(
                address,
                zip,
                city,
                county
              );

              if (geminiResult.success && geminiResult.data) {
                // Only use Gemini neighborhood if not from Excel and not from Geocodio
                if (
                  !existingNeighborhoods &&
                  geminiResult.data.neighborhood &&
                  !geocodioResult.data.neighbourhood
                ) {
                  result.neighborhoods = geminiResult.data.neighborhood;
                  result.neighborhood_source = geminiResult.cached
                    ? "Cache"
                    : "Gemini";
                }

                // Use Gemini community
                const communityValue =
                  geminiResult.data.community || result["Community"];
                result.comunidades = communityValue;
                result["Community"] = communityValue;
                result["Community Source"] = geminiResult.cached
                  ? "Cache"
                  : "Gemini";
                result.community_source = geminiResult.cached
                  ? "Cache"
                  : "Gemini";
              }
            }
          } else {
            // All geocoding failed
            result.status = "error";
            result.error = `All geocoding services failed: Mapbox: ${mapboxResult.error}, Geocodio: ${geocodioResult.error}`;
            result.api_source = "Failed";
            // Still try to extract house number even on failure
            result["House Number"] = houseNumber || "";
          }
        }

        const processingTime = performance.now() - startTime;
        result.processing_time_ms = Math.round(processingTime);

        return result;
      } catch (error) {
        const processingTime = performance.now() - startTime;
        return {
          ...addressData,
          original_address: address,
          status: "error",
          error: (error as Error).message,
          processed_at: new Date().toISOString(),
          api_source: "Error",
          neighborhoods: "N/A",
          comunidades: "N/A",
          Community: "N/A", // Add this field for Excel compatibility
          neighborhood_source: "N/A",
          community_source: "N/A",
          "Community Source": "N/A", // Add this field for Excel compatibility
          processing_time_ms: Math.round(processingTime),
        };
      }
    },
    [
      geocodeWithMapboxOptimized,
      geocodeWithGeocodioOptimized,
      getNeighborhoodFromGeminiOptimized,
    ]
  );

  // ===================================================================
  // MAIN BATCH PROCESSING FUNCTION
  // ===================================================================

  const processAddressesBatch = useCallback(
    async (
      addressDataList: MLSData[],
      detectedCols: DetectedColumns
    ): Promise<void> => {
      if (!addressDataList.length || shouldStopProcessing.current) return;

      shouldStopProcessing.current = false;
      setIsProcessing(true);
      startTime.current = Date.now();

      // Set processing start time for auto-save IMMEDIATELY
      console.log("🕐 Setting processing start time for auto-save...");
      autoSave.setProcessingStartTime();

      // Wait a tick to ensure the state is updated
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Initialize processing queue with optimized concurrency
      processingQueue.current = new PQueue({
        concurrency: batchConfig.concurrencyLimit,
        interval: OPTIMIZED_CONFIG.QUEUE_INTERVAL,
        intervalCap: batchConfig.concurrencyLimit,
      });

      // Setup memory cleanup
      memoryCleanupInterval.current = setInterval(() => {
        geocodingCache.current.cleanup();
        geminiCache.current.cleanup();
        if (global.gc) {
          global.gc();
        }
      }, OPTIMIZED_CONFIG.MEMORY_CLEANUP_INTERVAL);

      const totalRecords = addressDataList.length;
      const totalBatches = Math.ceil(totalRecords / batchConfig.batchSize);
      let processedCount = 0;
      let successCount = 0;

      // Local array to accumulate all results for auto-save
      const allProcessedResults: ProcessedResult[] = [];

      addLog(
        `🚀 Starting LARGE DATASET processing: ${totalRecords} records in ${totalBatches} batches`,
        "info"
      );
      addLog(
        `⚙️ 100K+ Config: ${batchConfig.concurrencyLimit} concurrent, ${batchConfig.batchSize} batch size (optimized for stability)`,
        "info"
      );

      if (totalRecords > 50000) {
        addLog(
          `📊 Large dataset detected (${totalRecords} records). Estimated time: ${Math.round(totalRecords / 15 / 60)} minutes`,
          "warning"
        );
      }

      try {
        for (
          let batchIndex = 0;
          batchIndex < totalBatches && !shouldStopProcessing.current;
          batchIndex++
        ) {
          batchStartTime.current = Date.now();
          const startIdx = batchIndex * batchConfig.batchSize;
          const endIdx = Math.min(
            startIdx + batchConfig.batchSize,
            totalRecords
          );
          const batch = addressDataList.slice(startIdx, endIdx);

          addLog(
            `📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} records)`,
            "info",
            batchIndex + 1
          );

          // Process batch with limited concurrency
          const limit = pLimit(batchConfig.concurrencyLimit);
          const batchPromises = batch.map((addressData, localIndex) =>
            limit(async () => {
              if (shouldStopProcessing.current) return null;

              const globalIndex = startIdx + localIndex;
              const address = addressData[detectedCols.address!] as string;

              // Update progress
              setProgress((prev) => ({
                ...prev,
                current: globalIndex + 1,
                total: totalRecords,
                percentage: Math.round(
                  ((globalIndex + 1) / totalRecords) * 100
                ),
                currentBatch: batchIndex + 1,
                totalBatches,
                currentAddress:
                  address.substring(0, 50) + (address.length > 50 ? "..." : ""),
              }));

              const result = await processAddressOptimized(
                addressData,
                detectedCols
              );

              if (result.status === "success") {
                successCount++;
              }

              return result;
            })
          );

          // Wait for batch completion
          const batchResults = (await Promise.allSettled(batchPromises))
            .map((result) =>
              result.status === "fulfilled" ? result.value : null
            )
            .filter(Boolean) as ProcessedResult[];

          // Accumulate results for auto-save
          allProcessedResults.push(...batchResults);

          // Update results and stats
          setResults((prev) => [...prev, ...batchResults]);
          processedCount += batchResults.length;

          const batchTime = Date.now() - batchStartTime.current;
          const totalTime = Date.now() - startTime.current;
          const throughput = processedCount / (totalTime / 1000);
          const successRate = ((successCount / processedCount) * 100).toFixed(
            1
          );
          const avgProcessingTime =
            performanceMetrics.current.totalProcessingTime /
            performanceMetrics.current.totalRequests;
          const estimatedRemaining = Math.round(
            (totalRecords - processedCount) / throughput
          );

          // Get cache stats
          const geocodingCacheStats = geocodingCache.current.getStats();
          const geminiCacheStats = geminiCache.current.getStats();
          const totalCacheHits =
            geocodingCacheStats.totalHits + geminiCacheStats.totalHits;

          // Update comprehensive stats
          setStats((prev) => ({
            ...prev,
            totalProcessed: processedCount,
            successRate: `${successRate}%`,
            throughputPerSecond: Math.round(throughput * 100) / 100,
            avgProcessingTimeMs: Math.round(avgProcessingTime),
            batchesCompleted: batchIndex + 1,
            currentBatchSize: batchResults.length,
            totalProcessingTimeMs: totalTime,
            estimatedTimeRemaining: `${Math.floor(estimatedRemaining / 60)}m ${estimatedRemaining % 60}s`,
            cacheHits: totalCacheHits,
          }));

          setProgress((prev) => ({
            ...prev,
            throughputPerSecond: Math.round(throughput * 100) / 100,
            estimatedTimeRemaining: `${Math.floor(estimatedRemaining / 60)}m ${estimatedRemaining % 60}s`,
          }));

          addLog(
            `✅ Batch ${batchIndex + 1} completed: ${batchResults.length} processed in ${batchTime}ms (${Math.round(throughput)} rec/s)`,
            "success",
            batchIndex + 1,
            batchTime
          );

          // Micro-break between batches for memory management
          if (batchIndex < totalBatches - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        const finalTime = Date.now() - startTime.current;
        const finalThroughput = processedCount / (finalTime / 1000);

        addLog(
          `🎉 Batch processing completed! ${processedCount} records processed in ${Math.round(finalTime / 1000)}s (${Math.round(finalThroughput)} rec/s)`,
          "success"
        );

        addLog(
          `📊 Final Stats: ${successCount}/${processedCount} success (${((successCount / processedCount) * 100).toFixed(1)}%), ${performanceMetrics.current.cacheHitCount} cache hits`,
          "performance"
        );

        // Auto-save completed file to Supabase Storage
        console.log("🔍 AUTO-SAVE CHECK:");
        console.log("   processedCount:", processedCount);
        console.log(
          "   allProcessedResults.length:",
          allProcessedResults.length
        );
        console.log("   userId:", userId);
        console.log("   fileData?.fileName:", fileData?.fileName);

        if (processedCount > 0 && allProcessedResults.length > 0) {
          addLog("💾 Auto-saving processed file to storage...", "info");
          console.log("🚀 AUTO-SAVE STARTING - All conditions met!");

          try {
            const autoSaveResult = await autoSave.autoSaveResults({
              results: allProcessedResults,
              originalFilename: fileData?.fileName || "unknown_file.xlsx",
              originalFileSize: fileData?.fileSize, // Now we have the original file size
              jobName: `MLS Processing - ${fileData?.fileName || "Unknown"}`,
              stats: {
                totalProcessed: processedCount,
                successRate: `${((successCount / processedCount) * 100).toFixed(1)}%`,
                throughputPerSecond: finalThroughput,
                avgProcessingTimeMs: finalTime / processedCount,
                mapboxCount: stats.mapboxCount,
                geocodioCount: stats.geocodioCount,
                geminiCount: stats.geminiCount,
                cacheHits: performanceMetrics.current.cacheHitCount,
                totalProcessingTimeMs: finalTime,
                batchesCompleted: totalBatches,
                currentBatchSize: batchConfig.batchSize,
                estimatedTimeRemaining: "Completed",
              },
              batchConfig,
              detectedColumns: detectedCols,
            });

            if (autoSaveResult.success) {
              addLog(
                `✅ File auto-saved successfully! Record ID: ${autoSaveResult.record_id}`,
                "success"
              );
              if (autoSaveResult.storage_url) {
                addLog(
                  `📁 Download URL: ${autoSaveResult.storage_url}`,
                  "info"
                );
              }
            } else {
              addLog(`⚠️ Auto-save failed: ${autoSaveResult.error}`, "warning");
            }
          } catch (autoSaveError) {
            addLog(
              `❌ Auto-save error: ${autoSaveError instanceof Error ? autoSaveError.message : "Unknown error"}`,
              "error"
            );
          }
        }
      } catch (error) {
        addLog(
          `❌ Batch processing error: ${(error as Error).message}`,
          "error"
        );
      } finally {
        // Cleanup
        if (processingQueue.current) {
          processingQueue.current.clear();
          processingQueue.current = null;
        }

        if (memoryCleanupInterval.current) {
          clearInterval(memoryCleanupInterval.current);
          memoryCleanupInterval.current = null;
        }

        setIsProcessing(false);
        shouldStopProcessing.current = false;
      }
    },
    [
      batchConfig,
      processAddressOptimized,
      addLog,
      autoSave,
      fileData,
      stats,
      userId,
    ]
  );

  // ===================================================================
  // FILE PROCESSING & SETUP FUNCTIONS
  // ===================================================================

  const processExcelFile = useCallback((file: File): Promise<MLSData[]> => {
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

          // Get the range to find all columns including empty ones
          const range = XLSX.utils.decode_range(firstSheet["!ref"] || "A1");

          // Extract header row (first row) to get all column names
          const headerRow: string[] = [];
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            const cell = firstSheet[cellAddress];
            headerRow.push(cell ? String(cell.v) : `Column_${col + 1}`);
          }

          console.log(
            "🔍 [EXCEL PROCESSING] All columns from header row:",
            headerRow
          );

          // Convert to JSON but preserve empty columns
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
            header: headerRow,
            range: 1, // Skip header row
            defval: "", // Default value for empty cells
          }) as Record<string, unknown>[];

          // Ensure all rows have all columns (fill missing with empty string)
          const processedData = jsonData.map((row) => {
            const processedRow: MLSData = {};
            headerRow.forEach((header) => {
              const cellValue = row[header];
              processedRow[header] =
                cellValue !== undefined && cellValue !== null
                  ? String(cellValue)
                  : "";
            });
            return processedRow;
          });

          console.log(
            "🔍 [EXCEL PROCESSING] Sample processed row:",
            processedData[0]
          );

          resolve(processedData as MLSData[]);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const detectColumns = useCallback((data: MLSData[]): DetectedColumns => {
    if (!data.length)
      return {
        address: null,
        zip: null,
        city: null,
        county: null,
        mlNumber: null,
        neighborhoods: null,
        communities: null,
      };

    const sampleRow = data[0];
    const columns = Object.keys(sampleRow);

    // Enhanced debugging - show all columns with sample data
    console.log("🔍 [FULL COLUMN ANALYSIS]");
    console.log("📊 Total columns found:", columns.length);
    console.log("📋 All columns list:", columns);

    // Show all columns including empty ones with better debugging
    console.table(
      columns.reduce(
        (acc, col) => {
          const sampleValue = String(sampleRow[col] || "").substring(0, 50);
          const isEmpty =
            !sampleRow[col] || String(sampleRow[col]).trim() === "";

          acc[col] = {
            "Raw Column": col,
            "Sample Value": sampleValue || "(empty)",
            "Is Empty": isEmpty ? "YES" : "NO",
            Length: col.length,
            Type: typeof sampleRow[col],
          };
          return acc;
        },
        {} as Record<
          string,
          {
            "Raw Column": string;
            "Sample Value": string;
            "Is Empty": string;
            Length: number;
            Type: string;
          }
        >
      )
    );

    const detected: DetectedColumns = {
      address: null,
      zip: null,
      city: null,
      county: null,
      mlNumber: null,
      neighborhoods: null,
      communities: null,
    };

    // Special debugging for Neighborhoods and Communities
    console.log(
      "🔍 [EMPTY COLUMNS CHECK] Looking for Neighborhoods and Communities:"
    );
    const neighborhoodsCol = columns.find(
      (col) => col.toLowerCase() === "neighborhoods"
    );
    const communitiesCol = columns.find(
      (col) => col.toLowerCase() === "communities"
    );

    console.log(
      "🏘️ Neighborhoods column found:",
      neighborhoodsCol ? `"${neighborhoodsCol}"` : "NOT FOUND"
    );
    console.log(
      "🏞️ Communities column found:",
      communitiesCol ? `"${communitiesCol}"` : "NOT FOUND"
    );

    if (neighborhoodsCol) {
      const isEmpty =
        !sampleRow[neighborhoodsCol] ||
        String(sampleRow[neighborhoodsCol]).trim() === "";
      console.log(
        `🏘️ Neighborhoods sample value: "${sampleRow[neighborhoodsCol]}" (Empty: ${isEmpty ? "YES" : "NO"})`
      );
    }
    if (communitiesCol) {
      const isEmpty =
        !sampleRow[communitiesCol] ||
        String(sampleRow[communitiesCol]).trim() === "";
      console.log(
        `🏞️ Communities sample value: "${sampleRow[communitiesCol]}" (Empty: ${isEmpty ? "YES" : "NO"})`
      );
    }

    // Enhanced column detection patterns
    const patterns = {
      address: [
        /^address$/i, // Exact match for "Address"
        /^address.*internet.*display$/i, // Exact match for "Address Internet Display"
        /address/i,
        /addr/i,
        /street/i,
        /location/i,
        /direccion/i,
        /internet.*display/i,
        /display.*address/i,
      ],
      zip: [
        /^zip.*code$/i, // Exact match for "Zip Code"
        /^zip$/i, // Exact match for "Zip"
        /zip/i,
        /postal/i,
        /codigo.*postal/i,
        /cp/i,
      ],
      city: [
        /^city.*name$/i, // Exact match for "City Name"
        /^city$/i, // Exact match for "City"
        /city/i,
        /ciudad/i,
        /municipality/i,
      ],
      county: [
        /^county$/i, // Exact match for "County"
        /county/i,
        /condado/i,
        /provincia/i,
      ],
      mlNumber: [
        /^ml#$/i, // Exact match for "ML#"
        /^mls.*number$/i, // Exact match for "MLS Number"
        /ml#/i,
        /mls.*number/i,
        /mls.*#/i,
        /listing.*number/i,
        /mls.*id/i,
        /^mls$/i,
      ],
      neighborhoods: [
        /^neighborhoods$/i, // Exact match for "Neighborhoods"
        /^neighbourhood$/i, // Exact match for "Neighbourhood"
        /neighborhood/i,
        /neighbourhood/i,
        /vecindario/i,
        /barrio/i,
        /area/i,
        /subdivisi/i,
        /district/i,
        /zona/i,
        /sector/i,
      ],
      communities: [
        /^communities$/i, // Exact match for "Communities"
        /^community$/i, // Exact match for "Community"
        /communit/i,
        /comunidad/i,
        /development/i,
        /subdivision/i,
        /complex/i,
        /urbanizaci/i,
        /proyecto/i,
        /residencial/i,
        /condominio/i,
      ],
    };

    // Detection with detailed logging
    for (const [key, patternList] of Object.entries(patterns)) {
      console.log(
        `🔍 Testing patterns for ${key}:`,
        patternList.map((p) => p.source)
      );

      for (const column of columns) {
        // Special logging for neighborhoods and communities
        if (key === "neighborhoods" || key === "communities") {
          console.log(
            `   🔸 Testing column "${column}" against ${key} patterns`
          );

          patternList.forEach((pattern, idx) => {
            const isMatch = pattern.test(column);
            console.log(
              `      Pattern ${idx + 1}: ${pattern.source} → ${isMatch ? "✅ MATCH" : "❌ no match"}`
            );
          });
        }

        const matchedPattern = patternList.find((pattern) =>
          pattern.test(column)
        );
        if (matchedPattern) {
          console.log(
            `✅ MATCH FOUND for ${key}: "${column}" (pattern: ${matchedPattern.source})`
          );

          if (key === "address") detected.address = column;
          else if (key === "zip") detected.zip = column;
          else if (key === "city") detected.city = column;
          else if (key === "county") detected.county = column;
          else if (key === "mlNumber") detected.mlNumber = column;
          else if (key === "neighborhoods") detected.neighborhoods = column;
          else if (key === "communities") detected.communities = column;
          break;
        }
      }

      if (!detected[key as keyof DetectedColumns]) {
        console.log(`❌ NO MATCH for ${key}`);
        if (key === "neighborhoods" || key === "communities") {
          console.log(`   Available columns for comparison:`, columns);
        }
      }
    }

    // Final detection summary
    console.log("🔍 [DETECTION SUMMARY]", {
      detectedColumns: detected,
      totalColumnsInFile: columns.length,
    });

    // Extra verification for missing neighborhoods and communities
    if (!detected.neighborhoods) {
      console.log(
        "🔍 [NEIGHBORHOODS DEBUG] Column not detected. Let's check manually:"
      );
      columns.forEach((col, idx) => {
        console.log(`   ${idx}: "${col}" (length: ${col.length})`);
        if (col.toLowerCase().includes("neighbor")) {
          console.log(`      🔸 Contains 'neighbor': ${col}`);
        }
      });
    }

    if (!detected.communities) {
      console.log(
        "🔍 [COMMUNITIES DEBUG] Column not detected. Let's check manually:"
      );
      columns.forEach((col, idx) => {
        console.log(`   ${idx}: "${col}" (length: ${col.length})`);
        if (col.toLowerCase().includes("communit")) {
          console.log(`      🔸 Contains 'communit': ${col}`);
        }
      });
    }

    return detected;
  }, []);

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        addLog(`📁 Loading file: ${file.name}`, "info");
        const excelData = await processExcelFile(file);
        const columns = Object.keys(excelData[0] || {});
        const detectedCols = detectColumns(excelData);

        setFileData({
          data: excelData,
          columns,
          fileName: file.name,
          fileSize: file.size, // Capture original file size in bytes
        });

        setDetectedColumns(detectedCols);
        setResults([]);

        // Apply adaptive configuration based on file size
        const adaptiveConfig = getOptimizedConfigForSize(excelData.length);
        setBatchConfig((prev) => ({
          ...prev,
          batchSize: adaptiveConfig.BATCH_SIZE,
          concurrencyLimit: adaptiveConfig.CONCURRENCY_LIMIT,
          maxRetries: adaptiveConfig.MAX_RETRIES,
          retryDelayMs: adaptiveConfig.RETRY_DELAY_BASE,
          cacheExpiryHours: adaptiveConfig.CACHE_EXPIRY_HOURS,
        }));

        // Log the adaptive configuration applied
        addLog(`⚙️ Auto-configured for ${excelData.length} records:`, "info");
        addLog(
          `   📊 Batch Size: ${adaptiveConfig.BATCH_SIZE} | Concurrency: ${adaptiveConfig.CONCURRENCY_LIMIT} | Max Retries: ${adaptiveConfig.MAX_RETRIES}`,
          "info"
        );
        addLog(
          `   ⏱️ Retry Delay: ${adaptiveConfig.RETRY_DELAY_BASE}ms | Cache Expiry: ${adaptiveConfig.CACHE_EXPIRY_HOURS}h | Target: ${adaptiveConfig.TARGET_THROUGHPUT}/sec`,
          "info"
        );

        setProgress({
          current: 0,
          total: excelData.length,
          percentage: 0,
          currentBatch: 0,
          totalBatches: Math.ceil(excelData.length / adaptiveConfig.BATCH_SIZE),
          currentAddress: "",
          throughputPerSecond: 0,
          estimatedTimeRemaining: "Calculating...",
        });

        // Reset performance metrics
        performanceMetrics.current = {
          totalRequests: 0,
          totalProcessingTime: 0,
          cacheHitCount: 0,
          errorCount: 0,
          rateLimitCount: 0,
        };

        // Clear caches
        geocodingCache.current.clear();
        geminiCache.current.clear();

        addLog(
          `✅ File loaded: ${excelData.length} records, ${Math.ceil(excelData.length / batchConfig.batchSize)} batches`,
          "success"
        );

        if (!detectedCols.address) {
          addLog(
            "⚠️ Could not auto-detect address column. Please verify column mapping.",
            "warning"
          );
        }
      } catch (error) {
        addLog(
          `❌ File processing error: ${(error as Error).message}`,
          "error"
        );
      }
    },
    [processExcelFile, detectColumns, batchConfig.batchSize, addLog]
  );

  // ===================================================================
  // CONTROL FUNCTIONS
  // ===================================================================

  const startProcessing = useCallback(() => {
    if (!fileData || !detectedColumns.address) {
      addLog("❌ No file loaded or address column not detected", "error");
      return;
    }

    // Clear all caches before starting fresh processing
    geocodingCache.current.clear();
    geminiCache.current.clear();

    // Clear localStorage caches too
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.includes("mls_") ||
            key.includes("gemini_") ||
            key.includes("geocoding_"))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      console.log(
        "🧹 [DEBUG] Cleared localStorage keys before processing:",
        keysToRemove
      );
    } catch (error) {
      console.warn("Could not clear localStorage:", error);
    }

    addLog("🧹 Cleared all caches before starting fresh processing", "info");
    addLog(
      `🚀 Starting optimized processing of ${fileData.data.length} records`,
      "info"
    );
    processAddressesBatch(fileData.data, detectedColumns);
  }, [fileData, detectedColumns, processAddressesBatch, addLog]);

  const stopProcessing = useCallback(() => {
    console.log(
      "🛑 stopProcessing called, resultsRef.current.length:",
      resultsRef.current.length
    );
    console.log(
      "🛑 stopProcessing - resultsRef.current.length:",
      resultsRef.current.length
    );

    shouldStopProcessing.current = true;
    setIsProcessing(false);

    if (processingQueue.current) {
      processingQueue.current.pause();
      processingQueue.current.clear();
    }

    // Use resultsRef.current for immediate access to current results
    const currentResultsLength = resultsRef.current.length;
    console.log("🛑 Current results from ref:", currentResultsLength);

    // Show stop modal if there are results to save
    if (currentResultsLength > 0) {
      console.log("📊 Showing stop modal with results:", currentResultsLength);
      setShowStopModal(true);
    } else {
      console.log("❌ No results to show modal for");
    }

    addLog("⏹️ Processing stopped by user", "warning");
  }, [addLog]);

  const clearResults = useCallback(() => {
    setResults([]);
    setLogs([]);
    setFileData(null);
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      currentBatch: 0,
      totalBatches: 0,
      currentAddress: "",
      throughputPerSecond: 0,
      estimatedTimeRemaining: "Calculating...",
    });
    setStats({
      totalProcessed: 0,
      successRate: "0%",
      throughputPerSecond: 0,
      avgProcessingTimeMs: 0,
      mapboxCount: 0,
      geocodioCount: 0,
      geminiCount: 0,
      cacheHits: 0,
      totalProcessingTimeMs: 0,
      batchesCompleted: 0,
      currentBatchSize: 0,
      estimatedTimeRemaining: "Calculating...",
    });

    // Reset performance metrics
    performanceMetrics.current = {
      totalRequests: 0,
      totalProcessingTime: 0,
      cacheHitCount: 0,
      errorCount: 0,
      rateLimitCount: 0,
    };

    // Clear caches
    geocodingCache.current.clear();
    geminiCache.current.clear();

    // Clear localStorage
    clearProgress();

    // Close modal if open
    setShowStopModal(false);

    addLog("🧹 Results cleared", "info");
  }, [addLog, clearProgress]);

  const exportResults = useCallback(() => {
    if (!results.length) {
      addLog("❌ No results to export", "error");
      return;
    }

    try {
      // Map results to custom column order and names
      const customData = results.map((row) => ({
        "ML#": row["ML#"] ?? row["mls_number"] ?? row["mls"] ?? "",
        Address:
          row["Address Internet Display"] ??
          row["address"] ??
          row["original_address"] ??
          "",
        "Zip Code": row["Zip Code"] ?? row["zip"] ?? row["zipcode"] ?? "",
        City: row["City Name"] ?? row["city"] ?? "",
        County: row["County"] ?? row["county"] ?? "",
        "House Number": row["House Number"] ?? row["house_number"] ?? "",
        Latitude: row["latitude"] ?? "",
        Longitude: row["longitude"] ?? "",
        Neighborhood: row["neighborhoods"] ?? row["neighbourhood"] ?? "",
        "Neighborhood Source": row["neighborhood_source"] ?? "",
        Community: row["comunidades"] ?? row["community"] ?? "",
        "Community Source": row["community_source"] ?? "",
        Status: row["status"] ?? "",
        "API Source": row["api_source"] ?? "",
      }));

      // Create worksheet with custom columns (sin las columnas de requests)
      const worksheet = XLSX.utils.json_to_sheet(customData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "MLS Processed Results"
      );

      // Create detailed timestamp
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-").split("T");
      const dateStr = timestamp[0]; // YYYY-MM-DD
      const timeStr = timestamp[1].split(".")[0]; // HH-MM-SS

      const fileName = `mls_processed_${dateStr}_${timeStr}_${results.length}records.xlsx`;
      XLSX.writeFile(workbook, fileName);

      addLog(`✅ Results exported: ${fileName}`, "success");
      addLog(
        `📊 Export summary: ${results.length} records processed with ${stats.successRate} success rate`,
        "info"
      );

      // Close modal if open
      setShowStopModal(false);
      setShowSuccessModal(false);
    } catch (error) {
      addLog(`❌ Export error: ${(error as Error).message}`, "error");
    }
  }, [results, addLog, stats.successRate]);

  const updateBatchConfig = useCallback(
    (newConfig: Partial<BatchConfig>) => {
      setBatchConfig((prev) => ({ ...prev, ...newConfig }));
      addLog(`⚙️ Configuration updated: ${JSON.stringify(newConfig)}`, "info");
    },
    [addLog]
  );

  const getCacheStats = useCallback(() => {
    const geocodingStats = geocodingCache.current.getStats();
    const geminiStats = geminiCache.current.getStats();

    return {
      geocoding: {
        entries: geocodingStats.totalEntries,
        hits: geocodingStats.totalHits,
      },
      gemini: {
        entries: geminiStats.totalEntries,
        hits: geminiStats.totalHits,
      },
      total: {
        entries: geocodingStats.totalEntries + geminiStats.totalEntries,
        hits: geocodingStats.totalHits + geminiStats.totalHits,
      },
    };
  }, []);

  const clearCache = useCallback(() => {
    geocodingCache.current.clear();
    geminiCache.current.clear();

    // Also clear any localStorage cache that might exist
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.includes("mls_") ||
            key.includes("gemini_") ||
            key.includes("geocoding_"))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      console.log("🧹 [DEBUG] Cleared localStorage keys:", keysToRemove);
    } catch (error) {
      console.warn("Could not clear localStorage:", error);
    }

    addLog("🧹 Cache cleared completely (memory + localStorage)", "info");
  }, [addLog]);

  // ===================================================================
  // RECOVERY SYSTEM & LIFECYCLE MANAGEMENT
  // ===================================================================

  // Check for saved progress on component mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedProgress = loadProgress();
      if (savedProgress) {
        setRecoveryData(savedProgress);
        setShowRecoveryModal(true);
        addLog(
          `🔄 Found previous session: ${savedProgress.results.length} records processed from ${savedProgress.fileName}`,
          "info"
        );
      }
    }
  }, [loadProgress, addLog]);

  // Handle beforeunload to warn user about losing progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log("🚨 [DEBUG] beforeunload triggered:", {
        isProcessing: isProcessing,
        resultsLength: results.length,
        hasFileData: !!fileData,
        shouldWarn: isProcessing || results.length > 0,
      });

      // Auto-save progress before potentially leaving
      const currentResults = resultsRef.current; // Use ref for most recent data
      if (currentResults.length > 0 && fileData) {
        try {
          saveProgress(
            currentResults,
            currentResults.length,
            fileData.data.length,
            fileData.fileName,
            stats,
            detectedColumns,
            fileData.data
          );
          console.log("💾 [DEBUG] Progress auto-saved before page unload");
        } catch (error) {
          console.error("❌ [DEBUG] Failed to auto-save before unload:", error);
        }
      }

      // Show warning if processing or has unsaved results
      if (isProcessing || currentResults.length > 0) {
        const message = isProcessing
          ? "Processing is in progress. Your progress will be automatically saved."
          : "You have processed results. Your progress has been saved, but you may lose unsaved data.";

        console.log("⚠️ [DEBUG] Showing beforeunload warning:", message);

        // Set both properties for maximum browser compatibility
        e.preventDefault();
        e.returnValue = message;
        return message;
      }

      console.log("✅ [DEBUG] No warning needed - no processing or results");
    };

    console.log("📋 [DEBUG] Registering beforeunload handler");
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      console.log("🗑️ [DEBUG] Removing beforeunload handler");
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [
    // Minimal dependencies to avoid frequent re-registration
    isProcessing,
    results.length,
    // Include necessary refs and functions that don't change frequently
    fileData,
    stats,
    detectedColumns,
    saveProgress,
  ]);

  // Auto-save progress every N records
  useEffect(() => {
    if (
      results.length > 0 &&
      results.length % AUTO_SAVE_INTERVAL === 0 &&
      fileData
    ) {
      saveProgress(
        results,
        results.length,
        fileData.data.length,
        fileData.fileName,
        stats,
        detectedColumns,
        fileData.data
      );
    }
  }, [results, fileData, stats, detectedColumns, saveProgress]);

  // ===================================================================
  // CLEANUP ON UNMOUNT
  // ===================================================================

  useEffect(() => {
    const geocodingCacheRef = geocodingCache.current;
    const geminiCacheRef = geminiCache.current;
    return () => {
      shouldStopProcessing.current = true;
      if (processingQueue.current) {
        processingQueue.current.clear();
      }
      if (memoryCleanupInterval.current) {
        clearInterval(memoryCleanupInterval.current);
      }
      geocodingCacheRef.clear();
      geminiCacheRef.clear();
    };
  }, []);

  // ===================================================================
  // RECOVERY & MODAL CONTROL FUNCTIONS
  // ===================================================================

  // Continue processing from saved progress
  const continueFromProgress = useCallback(() => {
    if (!recoveryData) return;

    console.log("🔄 Continuing from progress:", {
      recoveredResults: recoveryData.results.length,
      totalAddresses: recoveryData.totalAddresses,
      currentIndex: recoveryData.currentIndex,
    });

    setResults(recoveryData.results);
    setStats(recoveryData.stats);
    setDetectedColumns(recoveryData.detectedColumns);
    setFileData({
      data: recoveryData.validAddresses,
      columns: Object.keys(recoveryData.validAddresses[0] || {}),
      fileName: recoveryData.fileName,
      fileSize: 0, // Recovery data doesn't have original file size
    });
    setBatchConfig(recoveryData.batchConfig);

    // Update the ref immediately
    resultsRef.current = recoveryData.results;

    // Mark that we're continuing from recovery
    setIsContinuingFromRecovery(true);

    setShowRecoveryModal(false);
    clearProgress(); // Clear saved progress as we're continuing

    addLog(
      `🔄 Resumed processing from ${recoveryData.results.length} completed records`,
      "info"
    );
    console.log(
      "🔄 After continue - resultsRef.current.length:",
      resultsRef.current.length
    );
  }, [recoveryData, clearProgress, addLog]);

  // Discard saved progress and start fresh
  const discardProgress = useCallback(() => {
    clearProgress();
    setShowRecoveryModal(false);
    setRecoveryData(null);
    addLog("🗑️ Previous progress discarded", "info");
  }, [clearProgress, addLog]);

  // Download partial results from recovery data
  const downloadRecoveryResults = useCallback(() => {
    if (!recoveryData || !recoveryData.results.length) return;

    try {
      const worksheet = XLSX.utils.json_to_sheet(recoveryData.results);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Partial Results");

      const fileName = `${recoveryData.fileName.replace(/\.[^/.]+$/, "")}_partial_${recoveryData.results.length}_records_${new Date().toISOString().slice(0, 10)}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      addLog(`📥 Downloaded partial results: ${fileName}`, "success");
    } catch (error) {
      addLog(`❌ Export failed: ${(error as Error).message}`, "error");
    }
  }, [recoveryData, addLog]);

  // Modal control functions
  const closeStopModal = useCallback(() => {
    // Save progress before closing modal
    if (results.length > 0 && fileData) {
      saveProgress(
        results,
        results.length,
        fileData.data.length,
        fileData.fileName,
        stats,
        detectedColumns,
        fileData.data
      );
      addLog("💾 Progress saved automatically", "info");
    }
    setShowStopModal(false);
  }, [results, fileData, stats, detectedColumns, saveProgress, addLog]);

  const closeRecoveryModal = useCallback(() => {
    setShowRecoveryModal(false);
  }, []);

  const closeSuccessModal = useCallback(() => {
    setShowSuccessModal(false);
  }, []);

  // Test function for beforeunload (development only)
  const testBeforeUnload = useCallback(() => {
    console.log("🧪 [TEST] Testing beforeunload functionality");
    console.log("🧪 [TEST] Current state:", {
      isProcessing,
      resultsLength: results.length,
      hasFileData: !!fileData,
    });

    if (isProcessing || results.length > 0) {
      alert("✅ beforeunload WOULD WORK - there is processing or results");
    } else {
      alert("❌ beforeunload WOULD NOT activate - no processing or results");
    }
  }, [isProcessing, results.length, fileData]);

  // Expose test function globally for development (remove in production)
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      (
        window as typeof window & { testBeforeUnload: () => void }
      ).testBeforeUnload = testBeforeUnload;
      console.log("🧪 [DEBUG] testBeforeUnload function available globally");
      console.log("🧪 [DEBUG] Run 'testBeforeUnload()' in console to test");
    }
  }, [testBeforeUnload]);

  // ===================================================================
  // RETURN INTERFACE
  // ===================================================================

  return {
    // State
    stats,
    logs,
    isProcessing,
    progress,
    results,
    detectedColumns,
    fileData,
    batchConfig,

    // Modal States
    showRecoveryModal,
    showStopModal,
    showSuccessModal,
    recoveryData,

    // Auto-save state and actions
    autoSaveState: {
      isSaving: autoSave.isSaving,
      lastSaved: autoSave.lastSaved,
      error: autoSave.error,
      completedFiles: autoSave.completedFiles,
      isLoadingFiles: autoSave.isLoadingFiles,
      hasCompletedFiles: autoSave.hasCompletedFiles,
    },

    // Actions
    handleFileUpload,
    startProcessing,
    stopProcessing,
    clearResults,
    exportResults,
    updateBatchConfig,

    // Recovery Actions
    continueFromProgress,
    discardProgress,
    downloadRecoveryResults,

    // Modal Controls
    closeStopModal,
    closeRecoveryModal,
    closeSuccessModal,

    // Cache management
    getCacheStats,
    clearCache,

    // Auto-save functions
    getCompletedFilesList: () => autoSave.completedFiles,
    clearAutoSaveError: autoSave.clearError,
    refreshCompletedFiles: autoSave.refreshCompletedFiles,
    resetAutoSaveState: autoSave.refreshCompletedFiles,

    // Utilities
    setDetectedColumns,

    // Performance metrics (read-only)
    performanceMetrics: performanceMetrics.current,
  };
}
