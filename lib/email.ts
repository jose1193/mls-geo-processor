import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOTPEmail(
  email: string,
  otp: string
): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: "MLS Processor <onboarding@resend.dev>",
      to: [email],
      subject: "Access Code - MLS Processor",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">🌍 MLS Processor</h1>
            <p style="color: #64748b; margin: 5px 0;">Real Estate Data Processing System</p>
          </div>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin: 20px 0;">
            <h2 style="color: #1e293b; margin-top: 0;">Access Code</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">
              Use the following code to access your account:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background: #2563eb; color: white; font-size: 32px; font-weight: bold; padding: 20px 40px; border-radius: 8px; letter-spacing: 8px;">
                ${otp}
              </div>
            </div>
            
            <p style="color: #ef4444; font-size: 14px; margin: 20px 0;">
              ⚠️ This code expires in 10 minutes
            </p>
            
            <p style="color: #64748b; font-size: 14px;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; border-top: 1px solid #e2e8f0; margin-top: 30px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              © 2025 MLS Processor. Secure passwordless authentication system.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending email:", error);
      return false;
    }

    console.log("OTP email sent successfully:", data?.id);
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return false;
  }
}
