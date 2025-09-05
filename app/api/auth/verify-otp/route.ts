import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateOTP } from "@/lib/otp";
import { applyEmailRateLimit, otpVerifyLimiter } from "@/lib/rate-limiting";
import { supabaseAdmin } from "@/lib/supabase";

const verifyOTPSchema = z.object({
  email: z.string().email("Invalid email"),
  otp: z.string().length(6, "Code must be 6 digits"),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting por email para verificación
    const body = await request.json();
    const { email, otp } = verifyOTPSchema.parse(body);

    console.log(`[VERIFY-OTP] Request from: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'}`);
    console.log(`[VERIFY-OTP] Email: ${email}, OTP: ${otp.substring(0, 2)}****`);
    console.log(`[VERIFY-OTP] Request URL: ${request.url}`);
    console.log(`[VERIFY-OTP] Headers:`, Object.fromEntries(request.headers.entries()));

    const emailRateLimit = await applyEmailRateLimit(otpVerifyLimiter, email);
    if (!emailRateLimit.allowed) {
      // Log intento excesivo
      await logSecurityEvent(null, "otp_verify_rate_limit", request, {
        email: email,
        retry_after: emailRateLimit.retryAfter,
      });

      return NextResponse.json(
        { error: emailRateLimit.error },
        {
          status: 429,
          headers: {
            "Retry-After": emailRateLimit.retryAfter?.toString() || "1800",
          },
        }
      );
    }

    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Verificar que el email está autorizado en la tabla de usuarios
    console.log(`🔍 Checking email in database: ${email}`);
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, name")
      .eq("email", email)
      .single();

    console.log(`📊 Database query result:`, { user, userError });

    if (userError || !user) {
      console.log(`❌ Email not authorized or not found: ${email}`);
      // Log intento no autorizado
      await logSecurityEvent(null, "unauthorized_verify_attempt", request, {
        attempted_email: email,
        attempted_otp: otp.substring(0, 2) + "****", // Solo log parcial por seguridad
        error: userError?.message || "User not found",
      });

      return NextResponse.json(
        { error: "Unauthorized email" },
        { status: 403 }
      );
    }

    console.log(`✅ Email authorized: ${email}`);

    // Validar OTP
    const validation = await validateOTP(email, otp);

    if (!validation.valid) {
      // Log intento fallido
      await logSecurityEvent(null, "otp_verify_failed", request, {
        email: email,
        error: validation.error,
        attempted_otp: otp.substring(0, 2) + "****",
      });

      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Log verificación exitosa
    await logSecurityEvent(null, "otp_verify_success", request, {
      email: email,
    });

    return NextResponse.json({
      success: true,
      message: "Code verified successfully",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);

    // Log error
    await logSecurityEvent(null, "otp_verify_error", request, {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper para logging de eventos de seguridad
async function logSecurityEvent(
  userId: string | null,
  eventType: string,
  request: NextRequest,
  details: Record<string, unknown> = {}
) {
  try {
    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      console.warn(
        "Cannot log security event: Supabase admin client not available"
      );
      return;
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "";

    await supabaseAdmin.from("security_logs").insert({
      user_id: userId,
      event_type: eventType,
      ip_address: ip,
      user_agent: userAgent,
      details: details,
    });
  } catch (error) {
    console.error("Error logging security event:", error);
  }
}
