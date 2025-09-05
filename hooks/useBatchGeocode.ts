import { useState, useCallback } from "react";

interface BatchGeocodeOptions {
  provider?: "mapbox" | "gemini" | "geocodio";
  batchSize?: number;
  concurrency?: number;
  delayBetweenBatches?: number;
}

interface GeocodeResult {
  address: string;
  success: boolean;
  latitude?: number;
  longitude?: number;
  formatted?: string;
  error?: string;
  provider: string;
}

interface BatchProgress {
  processed: number;
  total: number;
  percentage: number;
  errors: number;
  rate: number;
  estimatedTimeRemaining: number;
}

interface BatchSummary {
  total: number;
  successful: number;
  failed: number;
  processingTime: number;
  averageRate: number;
  provider: string;
  environment: "Railway" | "localhost";
}

export function useBatchGeocode() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const geocodeBatch = useCallback(
    async (addresses: string[], options: BatchGeocodeOptions = {}) => {
      setIsProcessing(true);
      setError(null);
      setProgress(null);
      setResults([]);
      setSummary(null);

      try {
        console.log(
          `[BATCH-GEOCODE-HOOK] Starting batch geocoding of ${addresses.length} addresses`
        );

        const response = await fetch("/api/geocoding/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            addresses,
            provider: options.provider || "mapbox",
            options: {
              batchSize: options.batchSize,
              concurrency: options.concurrency,
              delayBetweenBatches: options.delayBetweenBatches,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Batch geocoding failed");
        }

        setResults(data.results);
        setSummary(data.summary);

        console.log(`[BATCH-GEOCODE-HOOK] Completed:`, data.summary);

        return {
          results: data.results,
          summary: data.summary,
        };
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        console.error("[BATCH-GEOCODE-HOOK] Error:", errorMessage);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setSummary(null);
    setError(null);
    setProgress(null);
  }, []);

  return {
    isProcessing,
    progress,
    results,
    summary,
    error,
    geocodeBatch,
    clearResults,
  };
}

// Hook para estadísticas de rendimiento
export function usePerformanceStats() {
  const estimateProcessingTime = useCallback(
    (
      totalAddresses: number,
      environment: "Railway" | "localhost" = "localhost"
    ) => {
      // Basado en tus datos: 1,030 rows en 6 minutos
      const baselineRate = 171.67; // addresses per minute

      // Factores de optimización
      const environmentMultiplier = environment === "Railway" ? 3.5 : 1; // Railway es ~3.5x más rápido
      const batchingMultiplier = 2.2; // Batching mejora ~2.2x

      const optimizedRate =
        baselineRate * environmentMultiplier * batchingMultiplier;
      const estimatedMinutes = totalAddresses / optimizedRate;

      return {
        estimatedMinutes,
        estimatedHours: estimatedMinutes / 60,
        optimizedRate,
        environment,
        factors: {
          baseline: baselineRate,
          environmentMultiplier,
          batchingMultiplier,
        },
      };
    },
    []
  );

  const getOptimalBatchConfig = useCallback(
    (
      totalAddresses: number,
      environment: "Railway" | "localhost" = "localhost"
    ) => {
      if (environment === "Railway") {
        // Configuración agresiva para Railway (8GB RAM, 8 vCPU)
        return {
          batchSize: totalAddresses > 10000 ? 100 : 50,
          concurrency: 10,
          delayBetweenBatches: 50,
          provider: "mapbox" as const,
        };
      } else {
        // Configuración conservadora para localhost
        return {
          batchSize: totalAddresses > 1000 ? 20 : 10,
          concurrency: 3,
          delayBetweenBatches: 300,
          provider: "mapbox" as const,
        };
      }
    },
    []
  );

  return {
    estimateProcessingTime,
    getOptimalBatchConfig,
  };
}
