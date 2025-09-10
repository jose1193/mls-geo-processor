import { NextRequest, NextResponse } from "next/server";
import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo";

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { to, subject, text, html } = body;

    // Validate required fields
    if (!to) {
      return NextResponse.json(
        { error: "Email recipient (to) is required" },
        { status: 400 }
      );
    }

    // Validate required environment variables
    if (!process.env.BREVO_API_KEY) {
      return NextResponse.json(
        { error: "BREVO_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Initialize Brevo API
    const apiInstance = new TransactionalEmailsApi();
    apiInstance.setApiKey(0, process.env.BREVO_API_KEY);

    // Prepare email data
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.to = Array.isArray(to)
      ? to.map((email) => ({ email }))
      : [{ email: to }];
    sendSmtpEmail.sender = {
      name: "MLS Listings",
      email: process.env.BREVO_FROM_EMAIL || "noreply@mls-listings.com",
    };
    sendSmtpEmail.subject = subject || "Test Email from MLS Listings (Brevo)";

    if (html) {
      sendSmtpEmail.htmlContent = html;
    } else {
      sendSmtpEmail.htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">🏠 MLS Listings</h1>
            <p style="color: #64748b; margin: 5px 0;">Real Estate Data Processing System</p>
          </div>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin: 20px 0;">
            <h2 style="color: #1e293b; margin-top: 0;">Test Email</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">
              ${text || "This is a test email from your MLS Listings application using Brevo!"}
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background: #2563eb; color: white; font-size: 18px; font-weight: bold; padding: 15px 30px; border-radius: 8px;">
                ✅ Brevo Integration Working!
              </div>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">
              This email was sent using the Brevo API integration.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; border-top: 1px solid #e2e8f0; margin-top: 30px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              © 2025 MLS Listings. Powered by Brevo.
            </p>
          </div>
        </div>
      `;
    }

    // Send the email
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log("✅ Email sent successfully via Brevo:", data);

    // Brevo API response structure
    const responseData = data.body || data;

    return NextResponse.json({
      success: true,
      message: "Email sent successfully via Brevo",
      provider: "Brevo",
      data: {
        messageId: responseData.messageId || "N/A",
        response: responseData,
        from: sendSmtpEmail.sender,
        to: sendSmtpEmail.to,
      },
    });
  } catch (error) {
    console.error("❌ Error sending email via Brevo:", error);

    // Enhanced error handling for Brevo-specific errors
    let errorMessage = "Unknown error";
    let statusCode = 500;

    if (error && typeof error === "object") {
      // Type assertion for error object with possible properties
      const errorObj = error as {
        response?: {
          text?: string;
          status?: number;
        };
        message?: string;
      };

      if (errorObj.response && errorObj.response.text) {
        try {
          const errorData = JSON.parse(errorObj.response.text);
          errorMessage =
            errorData.message || errorData.code || "Brevo API error";
          statusCode = errorObj.response.status || 500;
        } catch {
          // Parse error - use response text directly
          errorMessage = errorObj.response.text;
        }
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }
    }

    return NextResponse.json(
      {
        error: "Failed to send email via Brevo",
        details: errorMessage,
        provider: "Brevo",
        statusCode,
      },
      { status: statusCode }
    );
  }
}

// GET endpoint for testing the API
export async function GET() {
  return NextResponse.json({
    message: "Brevo Email API endpoint is working",
    provider: "Brevo",
    configuration: {
      brevo_configured: !!process.env.BREVO_API_KEY,
      from_email: process.env.BREVO_FROM_EMAIL || "noreply@mls-listings.com",
    },
    features: [
      "Transactional emails",
      "High deliverability",
      "Real-time analytics",
      "Template support",
      "Attachment support",
    ],
    usage: {
      method: "POST",
      endpoint: "/api/test-email-brevo",
      body: {
        to: "recipient@example.com",
        subject: "Optional subject",
        text: "Optional text content",
        html: "Optional HTML content",
      },
    },
    installation: {
      package: "@getbrevo/brevo",
      command: "npm install @getbrevo/brevo --save",
      deprecated_package: "sib-api-v3-sdk (use @getbrevo/brevo instead)",
    },
  });
}
