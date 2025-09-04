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
    const hashedCode = hashOTP(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Clean previous codes for the same email
    await supabaseAdmin.from("otp_codes").delete().eq("email", email);

    // Insert new code
    const { error } = await supabaseAdmin.from("otp_codes").insert({
      email,
      code_hash: hashedCode,
      expires_at: expiresAt,
      attempts: 0,
      used: false,
    });

    if (error) {
      console.error("Error storing OTP:", error);
      return false;
    }

    console.log(`OTP stored for ${email}, expires at ${expiresAt}`);
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
    // Buscar código activo para el email
    const { data: otpData, error: fetchError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("used", false)
      .single();

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
