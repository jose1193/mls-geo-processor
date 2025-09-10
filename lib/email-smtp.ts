import nodemailer from "nodemailer";

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

export async function sendOTPEmailSMTP(
  email: string,
  otp: string
): Promise<boolean> {
  try {
    console.log(`[EMAIL-SMTP] Attempting to send OTP to ${email}`);
    console.log(`[EMAIL-SMTP] Environment check - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[EMAIL-SMTP] SMTP Config - Email: ${process.env.SMTP_EMAIL ? '✓ Set' : '✗ Missing'}`);
    console.log(`[EMAIL-SMTP] SMTP Config - Password: ${process.env.SMTP_PASSWORD ? '✓ Set' : '✗ Missing'}`);
    
    const transporter = createTransporter();

    // Test de conexión SMTP específico para Railway
    console.log(`[EMAIL-SMTP] Testing SMTP connection...`);
    
    // Timeout para evitar que se cuelgue en Railway
    const connectionTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SMTP connection timeout')), 10000)
    );
    
    const verifyConnection = transporter.verify();
    
    try {
      await Promise.race([verifyConnection, connectionTimeout]);
      console.log(`[EMAIL-SMTP] ✅ SMTP connection verified successfully`);
    } catch (verifyError) {
      console.error(`[EMAIL-SMTP] ❌ SMTP connection failed:`, verifyError);
      throw new Error(`SMTP connection failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
    }

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

    console.log(`[EMAIL-SMTP] Sending email with options:`, {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const info = await transporter.sendMail(mailOptions);
    console.log("[EMAIL-SMTP] ✅ OTP email sent successfully via SMTP:", info.messageId);
    console.log("[EMAIL-SMTP] Response info:", info.response);
    return true;
  } catch (error) {
    console.error("[EMAIL-SMTP] ❌ Error sending OTP email via SMTP:", error);
    
    // Log más detalles del error para Railway debugging
    if (error instanceof Error) {
      console.error("[EMAIL-SMTP] Error name:", error.name);
      console.error("[EMAIL-SMTP] Error message:", error.message);
      console.error("[EMAIL-SMTP] Error stack:", error.stack);
    }
    
    return false;
  }
}

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
