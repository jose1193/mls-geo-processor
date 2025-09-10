import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("[DEBUG] Checking environment variables...");
    
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
      AUTH_URL: process.env.AUTH_URL ? "✓ Set" : "✗ Missing",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "✓ Set" : "✗ Missing", 
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "✓ Set" : "✗ Missing",
      AUTH_SECRET: process.env.AUTH_SECRET ? "✓ Set" : "✗ Missing",
      SMTP_EMAIL: process.env.SMTP_EMAIL ? "✓ Set" : "✗ Missing",
      SMTP_PASSWORD: process.env.SMTP_PASSWORD ? "✓ Set" : "✗ Missing",
      RESEND_API_KEY: process.env.RESEND_API_KEY ? "✓ Set" : "✗ Missing",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ Set" : "✗ Missing",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✓ Set" : "✗ Missing",
      PORT: process.env.PORT || "Not set",
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "Not set"
    };

    console.log("[DEBUG] Environment check result:", envCheck);

    // Verificar conexión a Supabase
    let supabaseCheck: Record<string, unknown> = { status: "unchecked" };
    try {
      const { supabaseAdmin } = await import("@/lib/supabase");
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from("users")
          .select("*", { count: "exact", head: true });
        
        supabaseCheck = {
          status: error ? "error" : "connected",
          error: error?.message,
          userCount: data
        };
      } else {
        supabaseCheck = { status: "admin_client_null" };
      }
    } catch (error) {
      supabaseCheck = { 
        status: "connection_error", 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      supabase: supabaseCheck,
      host: request.headers.get("host"),
      userAgent: request.headers.get("user-agent"),
      url: request.url
    });

  } catch (error) {
    console.error("[DEBUG] Error in debug endpoint:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
