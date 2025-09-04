import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      console.warn(
        "Supabase admin client is not available. Make sure SUPABASE_SERVICE_ROLE_KEY is set."
      );
      return NextResponse.json({
        success: true,
        files: [],
        message:
          "Database connection not available. Please configure Supabase.",
      });
    }

    // Get userId from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || session.user.id;

    // Fetch completed files from database
    let query = supabaseAdmin
      .from("mls_completed_files")
      .select("*")
      .order("completed_at", { ascending: false });

    // Filter by user if userId is provided
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: files, error } = await query;

    if (error) {
      console.error("Error fetching completed files:", error);
      return NextResponse.json(
        { error: "Error fetching files from database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      files: files || [],
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
