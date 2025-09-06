import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateOTP, storeOTP } from "@/lib/otp";
import { sendOTPEmail } from "@/lib/email";
import {
  applyRateLimit,
  otpRequestLimiter,
  applyEmailRateLimit,
  otpEmailLimiter,
} from "@/lib/rate-limiting";
import { supabaseAdmin } from "@/lib/supabase";
import { logSecurityEvent } from "@/lib/activity-tracker";

const sendOTPSchema = z.object({
  email: z.string().email("Invalid email"),
});

export async function POST(request: NextRequest) {
  try {
    // IP rate limiting
    const ipRateLimit = await applyRateLimit(otpRequestLimiter, request);
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: ipRateLimit.error },
        {
          status: 429,
          headers: {
            "Retry-After": ipRateLimit.retryAfter?.toString() || "300",
          },
        }
      );
    }

    const body = await request.json();
    const { email } = sendOTPSchema.parse(body);

    // Email rate limiting
    const emailRateLimit = await applyEmailRateLimit(otpEmailLimiter, email);
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        { error: emailRateLimit.error },
        {
          status: 429,
          headers: {
            "Retry-After": emailRateLimit.retryAfter?.toString() || "3600",
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
      // Log unauthorized attempt
      await logSecurityEvent(null, "unauthorized_email_attempt", request, {
        attempted_email: email,
        error: userError?.message || "User not found",
      });

      return NextResponse.json(
        { error: "Unauthorized email" },
        { status: 403 }
      );
    }

    console.log(`✅ Email authorized: ${email}`);

    // Generate and save OTP
    const otp = generateOTP();
    const stored = await storeOTP(email, otp);

    if (!stored) {
      return NextResponse.json(
        { error: "Error saving the code" },
        { status: 500 }
      );
    }

    // Send email
    const emailSent = await sendOTPEmail(email, otp);

    if (!emailSent) {
      return NextResponse.json(
        { error: "Error sending the code" },
        { status: 500 }
      );
    }

    // Log successful event
    await logSecurityEvent(email, "otp_sent", request, {
      email: email,
    });

    console.log(`OTP sent to ${email}: ${otp}`); // For development only

    return NextResponse.json({
      success: true,
      message: "Code sent successfully",
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    // Log error
    await logSecurityEvent(null, "otp_send_error", request, {
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
