import nodemailer from "nodemailer";
import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo";
import { Resend } from "resend";

// Interfaz para configuración SMTP
interface SMTPConfig {
  service?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string | undefined;
    pass: string | undefined;
  };
}

// Initialize email provider instances
const resend = new Resend(process.env.RESEND_API_KEY);

// Función principal de envío de emails con prioridad: Brevo > Gmail SMTP > Resend
export async function sendOTPEmailSMTP(
  email: string,
  otp: string
): Promise<boolean> {
  console.log(
    "🚀 Starting email sending process with priority: Brevo > Gmail SMTP > Resend"
  );

  // 1. PRIMERA OPCIÓN: Brevo API
  try {
    console.log("📧 Attempting to send OTP via Brevo API...");
    const success = await sendOTPEmailBrevo(email, otp);
    if (success) {
      console.log("✅ OTP sent successfully via Brevo API");
      return true;
    }
  } catch (error) {
    console.error("❌ Brevo API failed:", error);
  }

  // 2. SEGUNDA OPCIÓN: Gmail SMTP
  try {
    console.log("📧 Brevo failed, attempting Gmail SMTP...");
    const success = await sendOTPEmailGmailSMTP(email, otp);
    if (success) {
      console.log("✅ OTP sent successfully via Gmail SMTP");
      return true;
    }
  } catch (error) {
    console.error("❌ Gmail SMTP failed:", error);
  }

  // 3. TERCERA OPCIÓN: Resend API (Fallback final)
  try {
    console.log(
      "📧 Gmail SMTP failed, attempting Resend API as final fallback..."
    );
    const success = await sendOTPEmailResend(email, otp);
    if (success) {
      console.log("✅ OTP sent successfully via Resend API (fallback)");
      return true;
    }
  } catch (error) {
    console.error("❌ Resend API failed:", error);
  }

  console.error("💥 All email providers failed. Email could not be sent.");
  return false;
}

// Función específica para Brevo API
async function sendOTPEmailBrevo(email: string, otp: string): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) {
    console.log("⚠️ BREVO_API_KEY not configured, skipping Brevo");
    return false;
  }

  try {
    const apiInstance = new TransactionalEmailsApi();
    apiInstance.setApiKey(0, process.env.BREVO_API_KEY);

    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.to = [{ email }];
    sendSmtpEmail.sender = {
      name: process.env.BREVO_FROM_NAME || "MLS Processor",
      email: process.env.BREVO_FROM_EMAIL || "geocodingmls@gmail.com",
    };
    sendSmtpEmail.subject = "Access Code - MLS Processor";
    sendSmtpEmail.htmlContent = generateOTPEmailHTML(otp, "Brevo API");

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    const responseData = data.body || data;

    console.log("✅ Brevo email sent:", responseData);
    return true;
  } catch (error) {
    console.error("❌ Brevo error:", error);
    return false;
  }
}

// Función específica para Gmail SMTP
async function sendOTPEmailGmailSMTP(
  email: string,
  otp: string
): Promise<boolean> {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.log("⚠️ SMTP credentials not configured, skipping Gmail SMTP");
    return false;
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"MLS Processor" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: "Access Code - MLS Processor",
      html: generateOTPEmailHTML(otp, "Gmail SMTP"),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Gmail SMTP email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ Gmail SMTP error:", error);
    return false;
  }
}

// Función específica para Resend API
async function sendOTPEmailResend(
  email: string,
  otp: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log("⚠️ RESEND_API_KEY not configured, skipping Resend");
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "MLS Processor <onboarding@resend.dev>",
      to: [email],
      subject: "Access Code - MLS Processor",
      html: generateOTPEmailHTML(otp, "Resend API"),
    });

    if (error) {
      console.error("❌ Resend error:", error);
      return false;
    }

    console.log("✅ Resend email sent:", data?.id);
    return true;
  } catch (error) {
    console.error("❌ Resend error:", error);
    return false;
  }
}

// Función para generar HTML del email
function generateOTPEmailHTML(otp: string, provider: string): string {
  return `
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
          © 2025 MLS Processor. Sent via ${provider}.
          <br>
          ${process.env.RAILWAY_ENVIRONMENT ? "🚂 Railway Environment" : "🏠 Development Environment"}
        </p>
      </div>
    </div>
  `;
}

// Configuración del transportador SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD, // App Password de Gmail
    },
    // Alternativa con configuración manual:
    // host: 'smtp.gmail.com',
    // port: 587,
    // secure: false,
    // auth: {
    //   user: process.env.SMTP_EMAIL,
    //   pass: process.env.SMTP_PASSWORD,
    // },
  });
};

// Función alternativa con más proveedores SMTP
export async function sendOTPEmailWithProvider(
  email: string,
  otp: string,
  provider: "gmail" | "outlook" | "yahoo" | "custom" = "gmail"
): Promise<boolean> {
  try {
    let transporterConfig: SMTPConfig;

    switch (provider) {
      case "gmail":
        transporterConfig = {
          service: "gmail",
          auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
          },
        };
        break;

      case "outlook":
        transporterConfig = {
          host: "smtp-mail.outlook.com",
          port: 587,
          secure: false,
          auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
          },
        };
        break;

      case "yahoo":
        transporterConfig = {
          service: "yahoo",
          auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
          },
        };
        break;

      case "custom":
        transporterConfig = {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
          },
        };
        break;

      default:
        throw new Error("Unsupported email provider");
    }

    const transporter = nodemailer.createTransport(transporterConfig);

    const mailOptions = {
      from: `"MLS Processor" <${process.env.SMTP_EMAIL}>`,
      to: email,
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
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`OTP email sent successfully via ${provider}:`, info.messageId);
    return true;
  } catch (error) {
    console.error(`Error sending OTP email via ${provider}:`, error);
    return false;
  }
}
