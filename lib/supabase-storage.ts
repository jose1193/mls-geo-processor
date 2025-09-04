// ===================================================================
// SUPABASE STORAGE UTILITIES FOR MLS PROCESSOR
// Handles automatic file storage when processing reaches 100%
// ===================================================================

import { supabaseAdmin } from "./supabase";
import * as XLSX from "xlsx";
import type {
  ProcessedResult,
  OptimizedStats,
  DetectedColumns,
  BatchConfig,
} from "../app/mls-processor/hooks/useMLSProcessor-optimized";

// Helper function to ensure supabaseAdmin is available
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase admin client is not available. Make sure SUPABASE_SERVICE_ROLE_KEY is set."
    );
  }
  return supabaseAdmin;
}

export interface CompletedFileRecord {
  id: string;
  user_id: string | null;
  original_filename: string;
  original_file_size: number | null;
  total_records: number;
  job_name: string | null;
  started_at: string;
  completed_at: string;
  processing_duration_ms: number | null;
  successful_records: number;
  failed_records: number;
  mapbox_requests: number;
  geocodio_requests: number;
  gemini_requests: number;
  cache_hits: number;
  storage_path: string;
  storage_url: string;
  file_size_bytes: number | null;
  batch_config: BatchConfig | null;
  detected_columns: DetectedColumns | null;
  created_at: string;
  updated_at: string;
}

// ===================================================================
// STORAGE BUCKET CONFIGURATION
// ===================================================================

const STORAGE_BUCKET = "mls-completed-files";

// Ensure bucket exists (call this once during app initialization)
export async function ensureStorageBucketExists(): Promise<void> {
  try {
    const admin = getSupabaseAdmin();

    // Check if bucket exists
    const { data: buckets, error: listError } =
      await admin.storage.listBuckets();

    if (listError) {
      console.error("❌ Error listing buckets:", listError);
      return;
    }

    const bucketExists = buckets?.some(
      (bucket) => bucket.name === STORAGE_BUCKET
    );

    if (!bucketExists) {
      console.log("🪣 Creating storage bucket:", STORAGE_BUCKET);

      const { error: createError } = await admin.storage.createBucket(
        STORAGE_BUCKET,
        {
          public: true, // PUBLIC bucket - permanent URLs without expiration
          allowedMimeTypes: [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
            "application/vnd.ms-excel", // .xls
            "application/json",
            "text/csv",
          ],
          fileSizeLimit: 100 * 1024 * 1024, // 100MB limit
        }
      );

      if (createError) {
        console.error("❌ Error creating bucket:", createError);
      } else {
        console.log("✅ Storage bucket created successfully");
      }
    } else {
      console.log("✅ Storage bucket already exists");
    }
  } catch (error) {
    console.error("❌ Error ensuring bucket exists:", error);
  }
}

// ===================================================================
// FILE EXPORT AND UPLOAD FUNCTIONS
// ===================================================================

/**
 * Convert processed results to Excel file buffer
 */
export function convertToExcelBuffer(results: ProcessedResult[]): ArrayBuffer {
  // Prepare data for Excel with clean column names
  const excelData = results.map((result) => ({
    // Clean up and format all fields for Excel
    "ML Number": result["ML#"] || result.mlNumber || "",
    "Original Address": result.original_address || "",
    Status: result.status || "",
    "Processed At": result.processed_at
      ? new Date(result.processed_at).toLocaleString()
      : "",

    // Geocoding results
    "Formatted Address": result.formatted_address || "",
    Latitude: result.latitude || "",
    Longitude: result.longitude || "",

    // Geographic information
    "House Number": result["House Number"] || "",
    City: result.City || result.city || "",
    County: result.County || result.county || "",
    "Zip Code": result["Zip Code"] || result.zip || "",
    State: result.State || result.state || "FL",

    // Neighborhood information
    Neighborhood: result.neighbourhood || result.neighborhoods || "",
    Community: result.comunidades || result.Community || "",
    "Neighborhood Source": result.neighborhood_source || "",
    "Community Source":
      result.community_source || result["Community Source"] || "",

    // Processing metadata
    "API Source": result.api_source || "",
    "Processing Time (ms)": result.processing_time_ms || 0,
    "Cached Result": result.cached_result ? "Yes" : "No",
    Error: result.error || "",

    // Include any other original fields that might be useful
    ...Object.fromEntries(
      Object.entries(result).filter(
        ([key]) =>
          ![
            "original_address",
            "status",
            "processed_at",
            "formatted_address",
            "latitude",
            "longitude",
            "neighbourhood",
            "neighborhoods",
            "comunidades",
            "Community",
            "neighborhood_source",
            "community_source",
            "api_source",
            "processing_time_ms",
            "cached_result",
            "error",
          ].includes(key)
      )
    ),
  }));

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Auto-size columns for better readability
  const columnWidths = Object.keys(excelData[0] || {}).map((key) => ({
    wch: Math.max(key.length, 15), // Minimum width of 15 characters
  }));
  worksheet["!cols"] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "MLS Processed Data");

  // Convert to buffer
  const excelBuffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  });

  return excelBuffer.buffer;
}

/**
 * Generate unique filename for storage (Excel format)
 */
export function generateStorageFilename(
  originalFilename: string,
  totalRecords: number
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, "");
  return `${nameWithoutExt}_processed_${totalRecords}records_${timestamp}.xlsx`;
}

/**
 * Upload processed results to Supabase Storage as Excel file
 */
export async function uploadProcessedFile(
  results: ProcessedResult[],
  originalFilename: string
): Promise<{
  success: boolean;
  storage_path?: string;
  storage_url?: string;
  file_size_bytes?: number;
  error?: string;
}> {
  try {
    console.log("📤 uploadProcessedFile STARTED!");
    console.log("   results count:", results.length);
    console.log("   originalFilename:", originalFilename);

    const admin = getSupabaseAdmin();
    console.log("✅ Supabase admin client obtained");

    // Convert to Excel buffer
    console.log("📊 Converting to Excel buffer...");
    const excelBuffer = convertToExcelBuffer(results);
    const fileBuffer = new Uint8Array(excelBuffer);
    console.log(
      "✅ Excel buffer created:",
      (fileBuffer.length / 1024).toFixed(2),
      "KB"
    );

    // Generate unique filename
    const storageFilename = generateStorageFilename(
      originalFilename,
      results.length
    );
    const storagePath = `processed/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${storageFilename}`;

    console.log("📁 Upload path:", storagePath);
    console.log(
      "📊 File size:",
      (fileBuffer.length / 1024 / 1024).toFixed(2),
      "MB"
    );

    // Upload to storage
    const { data: uploadData, error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: false, // Don't overwrite existing files
      });

    if (uploadError) {
      console.error("❌ Upload error:", uploadError);
      return {
        success: false,
        error: uploadError.message,
      };
    }

    console.log("✅ Excel file uploaded successfully:", uploadData.path);

    // Generate permanent public URL (no expiration since bucket is public)
    const { data: urlData } = admin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;
    console.log("🔗 Public URL generated:", publicUrl);

    return {
      success: true,
      storage_path: storagePath,
      storage_url: publicUrl,
      file_size_bytes: fileBuffer.length,
    };
  } catch (error) {
    console.error("❌ Unexpected error during upload:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ===================================================================
// DATABASE RECORD FUNCTIONS
// ===================================================================

/**
 * Save completed file record to database
 */
export async function saveCompletedFileRecord({
  originalFilename,
  originalFileSize,
  totalRecords,
  jobName,
  startedAt,
  completedAt,
  stats,
  storagePath,
  storageUrl,
  fileSizeBytes,
  batchConfig,
  detectedColumns,
  userId = null,
}: {
  originalFilename: string;
  originalFileSize?: number;
  totalRecords: number;
  jobName?: string;
  startedAt: Date;
  completedAt: Date;
  stats: OptimizedStats;
  storagePath: string;
  storageUrl?: string;
  fileSizeBytes?: number;
  batchConfig?: BatchConfig;
  detectedColumns?: DetectedColumns;
  userId?: string | null;
}): Promise<{ success: boolean; record_id?: string; error?: string }> {
  try {
    console.log("💾 Saving completed file record to database...");

    const admin = getSupabaseAdmin();
    const processingDurationMs = completedAt.getTime() - startedAt.getTime();

    const recordData = {
      user_id: userId,
      original_filename: originalFilename,
      original_file_size: originalFileSize || null,
      total_records: totalRecords,
      job_name: jobName || null,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      processing_duration_ms: processingDurationMs,
      successful_records: stats.totalProcessed,
      failed_records: totalRecords - stats.totalProcessed,
      mapbox_requests: stats.mapboxCount,
      geocodio_requests: stats.geocodioCount,
      gemini_requests: stats.geminiCount,
      cache_hits: stats.cacheHits,
      storage_path: storagePath,
      storage_url: storageUrl || "",
      file_size_bytes: fileSizeBytes || null,
      batch_config: batchConfig
        ? JSON.parse(JSON.stringify(batchConfig))
        : null,
      detected_columns: detectedColumns
        ? JSON.parse(JSON.stringify(detectedColumns))
        : null,
    };

    const { data, error } = await admin
      .from("mls_completed_files")
      .insert(recordData)
      .select("id")
      .single();

    if (error) {
      console.error("❌ Database error:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log("✅ File record saved with ID:", data.id);

    return {
      success: true,
      record_id: data.id,
    };
  } catch (error) {
    console.error("❌ Unexpected error saving record:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Complete workflow: Upload file and save record
 */
export async function saveCompletedProcessing({
  results,
  originalFilename,
  originalFileSize,
  jobName,
  startedAt,
  stats,
  batchConfig,
  detectedColumns,
  userId,
}: {
  results: ProcessedResult[];
  originalFilename: string;
  originalFileSize?: number;
  jobName?: string;
  startedAt: Date;
  stats: OptimizedStats;
  batchConfig?: BatchConfig;
  detectedColumns?: DetectedColumns;
  userId?: string | null;
}): Promise<{
  success: boolean;
  record_id?: string;
  storage_url?: string;
  storage_path?: string;
  error?: string;
}> {
  try {
    const completedAt = new Date();

    console.log("🏁 saveCompletedProcessing STARTED!");
    console.log("📊 Input validation:");
    console.log(
      "   results:",
      results ? `Array[${results.length}]` : "MISSING"
    );
    console.log("   originalFilename:", originalFilename || "MISSING");
    console.log("   userId:", userId || "MISSING");
    console.log(
      "   startedAt:",
      startedAt ? startedAt.toISOString() : "MISSING"
    );
    console.log("   stats:", stats ? "Present" : "MISSING");

    // Step 1: Upload file to storage
    console.log("📤 STEP 1: Uploading to storage...");
    const uploadResult = await uploadProcessedFile(results, originalFilename);

    console.log("📤 Upload result:", uploadResult);

    if (!uploadResult.success) {
      console.error("❌ UPLOAD FAILED:", uploadResult.error);
      return {
        success: false,
        error: `Upload failed: ${uploadResult.error}`,
      };
    }

    console.log("✅ UPLOAD SUCCESS!");
    console.log("   storage_path:", uploadResult.storage_path);
    console.log("   storage_url:", uploadResult.storage_url);

    // Step 2: Save record to database
    console.log("💾 STEP 2: Saving to database...");
    const recordResult = await saveCompletedFileRecord({
      originalFilename,
      originalFileSize,
      totalRecords: results.length,
      jobName,
      startedAt,
      completedAt,
      stats,
      storagePath: uploadResult.storage_path!,
      storageUrl: uploadResult.storage_url,
      fileSizeBytes: uploadResult.file_size_bytes,
      batchConfig,
      detectedColumns,
      userId,
    });

    if (!recordResult.success) {
      console.warn(
        "⚠️ File uploaded but database record failed:",
        recordResult.error
      );
      // File was uploaded successfully, but database record failed
      return {
        success: false,
        storage_path: uploadResult.storage_path,
        storage_url: uploadResult.storage_url,
        error: `File uploaded but database record failed: ${recordResult.error}`,
      };
    }

    console.log("🎉 Complete save workflow finished successfully!");

    return {
      success: true,
      record_id: recordResult.record_id,
      storage_url: uploadResult.storage_url,
      storage_path: uploadResult.storage_path,
    };
  } catch (error) {
    console.error("❌ Complete save workflow failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ===================================================================
// RETRIEVE COMPLETED FILES
// ===================================================================

/**
 * Get list of completed files for a user
 */
export async function getCompletedFiles(userId?: string | null): Promise<{
  success: boolean;
  files?: CompletedFileRecord[];
  error?: string;
}> {
  try {
    let query = getSupabaseAdmin()
      .from("mls_completed_files")
      .select("*")
      .order("completed_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, files: data || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate new public URL for an existing file (permanent URLs)
 */
export async function refreshSignedUrl(storagePath: string): Promise<{
  success: boolean;
  signed_url?: string;
  error?: string;
}> {
  try {
    // Since we're using public bucket, generate permanent public URL
    const { data } = getSupabaseAdmin()
      .storage.from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return { success: true, signed_url: data.publicUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
