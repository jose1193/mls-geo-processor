// ===================================================================
// API ROUTE FOR COMPLETED FILES
// Server-side endpoint to fetch completed files using service role
// ===================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCompletedFiles } from "@/lib/supabase-storage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    console.log("📋 Fetching completed files via API route...");

    const result = await getCompletedFiles(userId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        files: result.files,
      });
    } else {
      console.error("❌ Error fetching files:", result.error);
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

export async function POST() {
  try {
    // Esta ruta podría usarse para crear nuevos registros si es necesario
    // Por ahora, solo devolvemos un error de método no implementado

    return NextResponse.json(
      {
        success: false,
        error: "POST method not implemented yet",
      },
      { status: 501 }
    );
  } catch (error) {
    console.error("❌ API POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
