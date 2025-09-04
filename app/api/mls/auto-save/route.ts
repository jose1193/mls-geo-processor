// ===================================================================
// API ROUTE FOR AUTO-SAVE
// Server-side endpoint to save completed files using service role
// ===================================================================

import { NextRequest, NextResponse } from "next/server";
import { saveCompletedProcessing } from "@/lib/supabase-storage";

export async function POST(request: NextRequest) {
  try {
    console.log("🔥 AUTO-SAVE API ROUTE CALLED!");

    const body = await request.json();
    console.log("📦 Received body keys:", Object.keys(body));

    const {
      results,
      originalFilename,
      originalFileSize,
      jobName,
      startedAt,
      stats,
      batchConfig,
      detectedColumns,
      userId,
    } = body;

    console.log("🔍 AUTO-SAVE VALIDATION:");
    console.log(
      "   results:",
      results ? `Array[${results.length}]` : "MISSING"
    );
    console.log("   originalFilename:", originalFilename || "MISSING");
    console.log("   startedAt:", startedAt || "MISSING");
    console.log("   userId:", userId || "MISSING");

    if (!results || !originalFilename || !startedAt) {
      console.error("❌ VALIDATION FAILED - Missing required fields");
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: results, originalFilename, and startedAt",
        },
        { status: 400 }
      );
    }

    console.log("� Starting saveCompletedProcessing...");
    console.log("📊 Data to save:", {
      originalFilename,
      userId,
      resultsCount: results.length,
    });

    const result = await saveCompletedProcessing({
      results,
      originalFilename,
      originalFileSize,
      jobName,
      startedAt: new Date(startedAt),
      stats,
      batchConfig,
      detectedColumns,
      userId,
    });

    console.log("📤 saveCompletedProcessing result:", result);

    if (result.success) {
      console.log("✅ AUTO-SAVE SUCCESS!");
      console.log("   record_id:", result.record_id);
      console.log("   storage_url:", result.storage_url);
      console.log("   storage_path:", result.storage_path);

      return NextResponse.json({
        success: true,
        record_id: result.record_id,
        storage_url: result.storage_url,
        storage_path: result.storage_path,
      });
    } else {
      console.error("❌ AUTO-SAVE FAILED:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
