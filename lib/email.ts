import { sendOTPEmailSMTP } from "./email-smtp";

export async function sendOTPEmail(
  email: string,
  otp: string
): Promise<boolean> {
  // La función sendOTPEmailSMTP ya maneja toda la lógica de fallback:
  // 1. Brevo API (primera opción)
  // 2. Gmail SMTP (segunda opción)
  // 3. Resend API (fallback final)
  console.log("🚀 Initiating email sending process...");

  const success = await sendOTPEmailSMTP(email, otp);

  if (success) {
    console.log("✅ Email sent successfully through one of the providers");
  } else {
    console.error("❌ All email providers failed");
  }

  return success;
}
