import nodemailer from "nodemailer";

// Interfaz para configuración SMTP
interface SMTPConfig {
  service?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
  rateLimit?: number | false;
  auth: {
    user: string | undefined;
    pass: string | undefined;
  };
}

// Configuración del transportador SMTP
const createTransporter = () => {
  // Configuración optimizada para Railway
  const isRailway = process.env.RAILWAY_ENVIRONMENT === "production" || 
                   process.env.NODE_ENV === "production";
  
  const config: SMTPConfig = {
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD, // App Password de Gmail
    },
    // Configuración optimizada para Railway
    connectionTimeout: isRailway ? 15000 : 60000, // 15s en Railway, 60s en local
    greetingTimeout: isRailway ? 10000 : 30000,   // 10s en Railway, 30s en local
    socketTimeout: isRailway ? 20000 : 60000,     // 20s en Railway, 60s en local
    // Configuración adicional para Railway
    pool: true,
    maxConnections: isRailway ? 3 : 5,
    maxMessages: isRailway ? 10 : 100,
    rateLimit: isRailway ? 3 : false, // 3 emails por segundo en Railway
  };
  
  return nodemailer.createTransport(config);
};

export async function sendOTPEmailSMTP(
  email: string,
  otp: string,
  retries: number = 2
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(`[SMTP] Attempt ${attempt}/${retries + 1} to send OTP to ${email}`);
      
      const transporter = createTransporter();

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
      console.log(`[SMTP] OTP email sent successfully on attempt ${attempt}:`, info.messageId);
      return true;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SMTP] Attempt ${attempt} failed:`, errorMessage);
      
      // Si es el último intento o no es un error de timeout/conexión, fallar
      if (attempt === retries + 1 || 
          (!errorMessage.includes('timeout') && 
           !errorMessage.includes('ETIMEDOUT') && 
           !errorMessage.includes('ECONNRESET') &&
           !errorMessage.includes('ENOTFOUND'))) {
        console.error("[SMTP] All attempts failed, giving up");
        return false;
      }
      
      // Esperar antes del siguiente intento (backoff exponencial)
      const waitTime = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s...
      console.log(`[SMTP] Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  return false;
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
