import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    console.log(`[DEBUG-OTP] Request received from: ${request.headers.get("x-forwarded-for") || "unknown"}`);
    console.log(`[DEBUG-OTP] Request URL: ${request.url}`);
    
    // Solo en desarrollo o con parámetro especial
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const debug = searchParams.get("debug");

    console.log(`[DEBUG-OTP] Email: ${email}, Debug: ${debug}`);

    if (!email || debug !== "true") {
      console.log(`[DEBUG-OTP] Access denied - missing email or debug parameter`);
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Get all OTP codes for the email
    const { data: otpCodes, error } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      email,
      current_time: new Date().toISOString(),
      otp_codes: otpCodes?.map((code) => ({
        id: code.id,
        expires_at: code.expires_at,
        attempts: code.attempts,
        used: code.used,
        created_at: code.created_at,
        is_expired: new Date() > new Date(code.expires_at),
        code_hash_preview: code.code_hash?.substring(0, 10) + "...",
      })),
    });
  } catch (error) {
    console.error("Debug OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
