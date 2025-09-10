import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Configuración del transportador SMTP para Gmail
const createGmailTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD, // App Password de Gmail
    },
  });
};

// Función para generar HTML del email
function generateTestEmailHTML(provider: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin: 0;">🌍 MLS Processor</h1>
        <p style="color: #64748b; margin: 5px 0;">Real Estate Data Processing System</p>
      </div>
      
      <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin: 20px 0;">
        <h2 style="color: #1e293b; margin-top: 0;">✅ Gmail SMTP Test Email</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.5;">
          This is a test email sent through Gmail SMTP to verify the email configuration.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background: #059669; color: white; font-size: 18px; font-weight: bold; padding: 15px 30px; border-radius: 8px;">
            📧 Gmail SMTP Working!
          </div>
        </div>
        
        <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
          <h3 style="color: #047857; margin: 0 0 10px 0; font-size: 16px;">Email Provider Details:</h3>
          <ul style="color: #065f46; margin: 0; padding-left: 20px;">
            <li><strong>Provider:</strong> ${provider}</li>
            <li><strong>Service:</strong> Gmail SMTP</li>
            <li><strong>Port:</strong> 587 (TLS)</li>
            <li><strong>Authentication:</strong> App Password</li>
            <li><strong>Status:</strong> ✅ Active</li>
          </ul>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">
          <strong>Note:</strong> Gmail SMTP may be blocked on Railway Hobby plan (ports 25, 465, 587).
          Use this for local testing or upgrade to Railway Pro plan.
        </p>
      </div>
      
      <div style="text-align: center; padding: 20px; border-top: 1px solid #e2e8f0; margin-top: 30px;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          © 2025 MLS Processor. Test email sent via ${provider}.
          <br>
          ${process.env.RAILWAY_ENVIRONMENT ? "🚂 Railway Environment" : "🏠 Development Environment"}
          <br>
          <span style="color: #f59e0b;">⚠️ This is a test email for development purposes only</span>
        </p>
      </div>
    </div>
  `;
}

export async function POST(request: NextRequest) {
  console.log("🚀 Gmail SMTP Test Email API called");

  try {
    // Validar variables de entorno
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      console.error("❌ Gmail SMTP credentials missing");
      return NextResponse.json(
        {
          success: false,
          error:
            "Gmail SMTP credentials not configured. Check SMTP_EMAIL and SMTP_PASSWORD environment variables.",
        },
        { status: 400 }
      );
    }

    // Obtener datos del request
    const body = await request.json();
    const { email, to, subject, text, html } = body;

    // Usar 'to' o 'email' como destinatario
    const recipient = to || email;

    // Validar email
    if (!recipient) {
      return NextResponse.json(
        {
          success: false,
          error: "Email address is required (use 'to' or 'email' field)",
        },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    console.log(
      `📧 Attempting to send test email to: ${recipient} via Gmail SMTP`
    );

    // Crear transportador
    const transporter = createGmailTransporter();

    // Verificar conexión SMTP
    console.log("🔍 Verifying Gmail SMTP connection...");
    try {
      await transporter.verify();
      console.log("✅ Gmail SMTP connection verified successfully");
    } catch (verifyError) {
      console.error("❌ Gmail SMTP connection failed:", verifyError);
      return NextResponse.json(
        {
          success: false,
          error:
            "Gmail SMTP connection failed. This might be due to Railway Hobby plan blocking SMTP ports.",
          details:
            verifyError instanceof Error
              ? verifyError.message
              : "Unknown verification error",
        },
        { status: 500 }
      );
    }

    // Configurar email
    const mailOptions = {
      from: `"MLS Processor Test" <${process.env.SMTP_EMAIL}>`,
      to: recipient,
      subject: subject || "✅ Gmail SMTP Test - MLS Processor",
      html: html || generateTestEmailHTML("Gmail SMTP"),
      text: text || undefined, // Solo incluir texto plano si se proporciona
    };

    // Enviar email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Gmail SMTP test email sent successfully:", info.messageId);

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully via Gmail SMTP!",
      provider: "Gmail SMTP",
      messageId: info.messageId,
      recipient: recipient,
      from: process.env.SMTP_EMAIL,
      subject: subject || "✅ Gmail SMTP Test - MLS Processor",
      environment: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Development",
      timestamp: new Date().toISOString(),
      warning: process.env.RAILWAY_ENVIRONMENT
        ? "Gmail SMTP may be blocked on Railway Hobby plan"
        : undefined,
    });
  } catch (error) {
    console.error("❌ Gmail SMTP test email error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isRailwayError =
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("connect");

    return NextResponse.json(
      {
        success: false,
        error: "Failed to send test email via Gmail SMTP",
        details: errorMessage,
        provider: "Gmail SMTP",
        suggestion: isRailwayError
          ? "Gmail SMTP is likely blocked on Railway Hobby plan. Try using Brevo or Resend APIs instead."
          : "Check your Gmail SMTP credentials and app password configuration.",
      },
      { status: 500 }
    );
  }
}

// Método GET para información sobre el endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/test-email-gmail",
    description: "Test endpoint for Gmail SMTP email sending",
    method: "POST",
    required_body: {
      to: "recipient@example.com", // También acepta 'email'
      subject: "Optional custom subject",
      text: "Optional plain text content",
      html: "Optional HTML content",
    },
    example_request: {
      to: "josegonzalezcr2794@gmail.com",
      subject: "Test desde Gmail API",
      text: "¡Hola! Este es un email de prueba desde Gmail usando Postman.",
      html: "<h1>Email de Prueba</h1><p>Este email viene desde <strong>Gmail Test</strong> 🚀</p>",
    },
    required_env_vars: ["SMTP_EMAIL", "SMTP_PASSWORD"],
    notes: [
      "Gmail SMTP requires App Password (not regular password)",
      "May be blocked on Railway Hobby plan (ports 25, 465, 587)",
      "Works fine in local development",
      "Consider using Brevo or Resend APIs for Railway deployment",
      "Accepts both 'to' and 'email' fields for recipient address",
    ],
    status:
      process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD
        ? "✅ Configured"
        : "❌ Missing credentials",
  });
}
