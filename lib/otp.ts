import crypto from "crypto";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "./supabase";

export interface OTPData {
  id: string;
  code_hash: string;
  email: string;
  expires_at: string;
  attempts: number;
  used: boolean;
  created_at: string;
}

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOTP(code: string): string {
  return bcrypt.hashSync(code, 10);
}

export function verifyOTP(code: string, hashedCode: string): boolean {
  return bcrypt.compareSync(code, hashedCode);
}

export async function storeOTP(email: string, code: string): Promise<boolean> {
  try {
    console.log(`[OTP-STORE] Storing OTP for email: ${email}`);
    console.log(`[OTP-STORE] Code: ${code.substring(0, 2)}****`);
    
    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      console.error("[OTP-STORE] Supabase admin client not available");
      return false;
    }

    const hashedCode = hashOTP(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    console.log(`[OTP-STORE] Expires at: ${expiresAt}`);

    // Clean previous codes for the same email
    const { error: deleteError } = await supabaseAdmin
      .from("otp_codes")
      .delete()
      .eq("email", email);

    if (deleteError) {
      console.log(`[OTP-STORE] Error cleaning previous codes: ${deleteError.message}`);
    } else {
      console.log(`[OTP-STORE] Previous codes cleaned for ${email}`);
    }

    // Insert new code
    const { error } = await supabaseAdmin.from("otp_codes").insert({
      email,
      code_hash: hashedCode,
      expires_at: expiresAt,
      attempts: 0,
      used: false,
    });

    if (error) {
      console.error("[OTP-STORE] Error storing OTP:", error);
      return false;
    }

    console.log(`[OTP-STORE] OTP stored successfully for ${email}, expires at ${expiresAt}`);
    return true;
  } catch (error) {
    console.error("Error in storeOTP:", error);
    return false;
  }
}

export async function validateOTP(
  email: string,
  code: string
): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    console.log(`[OTP-VALIDATE] Starting validation for email: ${email}`);
    console.log(`[OTP-VALIDATE] Code: ${code.substring(0, 2)}****`);
    
    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      console.error("[OTP-VALIDATE] Supabase admin client not available");
      return { valid: false, error: "Database connection not available" };
    }

    // Buscar código activo para el email
    const { data: otpData, error: fetchError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("used", false)
      .single();

    console.log(`[OTP-VALIDATE] Database query result:`, { otpData, fetchError });

    if (fetchError || !otpData) {
      console.log("No OTP found for email:", email);
      return { valid: false, error: "Code not found or expired" };
    }

    // Check if expired
    if (new Date() > new Date(otpData.expires_at)) {
      // Mark as used for cleanup
      await supabaseAdmin
        .from("otp_codes")
        .update({ used: true })
        .eq("id", otpData.id);

      return { valid: false, error: "Code expired" };
    }

    // Check attempts
    if (otpData.attempts >= 3) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ used: true })
        .eq("id", otpData.id);

      return { valid: false, error: "Too many failed attempts" };
    }

    // Verify code
    const isValid = verifyOTP(code, otpData.code_hash);

    if (!isValid) {
      // Increment attempts
      await supabaseAdmin
        .from("otp_codes")
        .update({ attempts: otpData.attempts + 1 })
        .eq("id", otpData.id);

      return { valid: false, error: "Incorrect code" };
    }

    // Valid code - mark as used
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpData.id);

    // Update user's last login
    await supabaseAdmin
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("email", email);

    console.log(`OTP validated successfully for ${email}`);
    return { valid: true };
  } catch (error) {
    console.error("Error in validateOTP:", error);
    return { valid: false, error: "Internal server error" };
  }
}

export async function cleanExpiredOTPs(): Promise<void> {
  try {
    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      console.warn(
        "Supabase admin client not available for cleaning expired OTPs"
      );
      return;
    }

    const { error } = await supabaseAdmin
      .from("otp_codes")
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (error) {
      console.error("Error cleaning expired OTPs:", error);
    } else {
      console.log("Expired OTPs cleaned successfully");
    }
  } catch (error) {
    console.error("Error in cleanExpiredOTPs:", error);
  }
}

// Clean expired codes every 5 minutes (server only)
if (typeof window === "undefined") {
  setInterval(cleanExpiredOTPs, 5 * 60 * 1000);
}
