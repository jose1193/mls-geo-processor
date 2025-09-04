// ===================================================================
// AUTO-SAVE HOOK FOR MLS PROCESSOR
// Client-side hook for managing auto-save functionality via API routes
// ===================================================================

import { useState, useCallback, useEffect } from "react";
import type {
  ProcessedResult,
  OptimizedStats,
  BatchConfig,
  DetectedColumns,
} from "./useMLSProcessor-optimized";

// ===================================================================
// TYPES
// ===================================================================

interface CompletedFile {
  id: string;
  original_filename: string;
  total_records: number;
  job_name?: string;
  completed_at: string;
  storage_url: string;
  storage_path: string;
  file_size_bytes?: number;
  file_size_mb: number;
}

interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  completedFiles: CompletedFile[];
  isLoadingFiles: boolean;
}

interface AutoSaveResult {
  success: boolean;
  record_id?: string;
  storage_url?: string;
  storage_path?: string;
  error?: string;
}

// ===================================================================
// HOOK
// ===================================================================

export function useAutoSave(userId?: string | null) {
  const [state, setState] = useState<AutoSaveState>({
    isSaving: false,
    lastSaved: null,
    error: null,
    completedFiles: [],
    isLoadingFiles: false,
  });

  const [processingStartTime, setProcessingStartTime] = useState<Date | null>(
    null
  );

  // ===================================================================
  // FETCH COMPLETED FILES FROM API
  // ===================================================================

  const fetchCompletedFiles = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoadingFiles: true, error: null }));

    try {
      const params = new URLSearchParams();
      if (userId) {
        params.append("userId", userId);
      }

      const response = await fetch(`/api/mls/completed-files?${params}`);
      const result = await response.json();

      if (result.success) {
        setState((prev) => ({
          ...prev,
          completedFiles: result.files || [],
          isLoadingFiles: false,
        }));
      } else {
        throw new Error(result.error || "Failed to fetch files");
      }
    } catch (error) {
      console.error("❌ Error fetching files:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch completed files",
        isLoadingFiles: false,
        completedFiles: [],
      }));
    }
  }, [userId]);

  // ===================================================================
  // AUTO-SAVE RESULTS VIA API
  // ===================================================================

  const autoSaveResults = useCallback(
    async ({
      results,
      originalFilename,
      originalFileSize,
      jobName,
      stats,
      batchConfig,
      detectedColumns,
    }: {
      results: ProcessedResult[];
      originalFilename: string;
      originalFileSize?: number;
      jobName?: string;
      stats: OptimizedStats;
      batchConfig?: BatchConfig;
      detectedColumns?: DetectedColumns;
    }): Promise<AutoSaveResult> => {
      if (!processingStartTime) {
        const error =
          "Processing start time not set. Call setProcessingStartTime() before processing.";
        console.error("❌", error);
        setState((prev) => ({ ...prev, error }));
        return { success: false, error };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        console.log("💾 Starting auto-save via API...");
        console.log("📊 Results to save:", results.length);

        const payload = {
          results,
          originalFilename,
          originalFileSize,
          jobName,
          startedAt: processingStartTime.toISOString(),
          stats,
          batchConfig,
          detectedColumns,
          userId,
        };

        const response = await fetch("/api/mls/auto-save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (result.success) {
          console.log("✅ Auto-save completed successfully!");
          console.log("🆔 Record ID:", result.record_id);
          console.log("🔗 Storage URL:", result.storage_url);

          setState((prev) => ({
            ...prev,
            isSaving: false,
            lastSaved: new Date(),
            error: null,
          }));

          // Refresh the completed files list
          await fetchCompletedFiles();

          return {
            success: true,
            record_id: result.record_id,
            storage_url: result.storage_url,
            storage_path: result.storage_path,
          };
        } else {
          throw new Error(result.error || "Auto-save failed");
        }
      } catch (error) {
        console.error("❌ Auto-save error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Auto-save failed";

        setState((prev) => ({
          ...prev,
          isSaving: false,
          error: errorMessage,
        }));

        return { success: false, error: errorMessage };
      }
    },
    [processingStartTime, userId, fetchCompletedFiles]
  );

  // ===================================================================
  // PROCESSING TIME MANAGEMENT
  // ===================================================================

  const handleSetProcessingStartTime = useCallback(() => {
    const startTime = new Date();
    setProcessingStartTime(startTime);
    console.log("⏱️ Processing start time set:", startTime.toISOString());
  }, []);

  // ===================================================================
  // LOAD FILES ON MOUNT
  // ===================================================================

  useEffect(() => {
    fetchCompletedFiles();
  }, [fetchCompletedFiles]);

  // ===================================================================
  // RETURN HOOK INTERFACE
  // ===================================================================

  return {
    // State
    isSaving: state.isSaving,
    lastSaved: state.lastSaved,
    error: state.error,
    completedFiles: state.completedFiles,
    isLoadingFiles: state.isLoadingFiles,

    // Actions
    autoSaveResults,
    setProcessingStartTime: handleSetProcessingStartTime,
    refreshCompletedFiles: fetchCompletedFiles,

    // Computed
    hasCompletedFiles: state.completedFiles.length > 0,
  };
}
