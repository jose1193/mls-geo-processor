import { NextRequest, NextResponse } from "next/server";
import FormData from "form-data";
import Mailgun from "mailgun.js";

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
    if (!process.env.MAILGUN_API_KEY) {
      return NextResponse.json(
        { error: "MAILGUN_API_KEY is not configured" },
        { status: 500 }
      );
    }

    if (!process.env.MAILGUN_DOMAIN) {
      return NextResponse.json(
        { error: "MAILGUN_DOMAIN is not configured" },
        { status: 500 }
      );
    }

    // Initialize Mailgun
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY,
      // For EU domains, uncomment the line below:
      // url: "https://api.eu.mailgun.net"
    });

    // Get domain and from email from environment variables
    const mailgunDomain = process.env.MAILGUN_DOMAIN;
    const fromEmail =
      process.env.MAILGUN_FROM_EMAIL ||
      `MLS Listings <postmaster@${mailgunDomain}>`;

    // Check if using sandbox domain
    const isSandbox = mailgunDomain?.includes("sandbox");

    if (isSandbox) {
      console.warn(
        "⚠️  Using Mailgun sandbox domain. Only authorized recipients can receive emails."
      );
    }

    // Prepare email data
    const emailData = {
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject: subject || "Test Email from MLS Listings",
      text: text || "This is a test email from your MLS Listings application!",
      ...(html && { html }),
    };

    // Send the email
    const data = await mg.messages.create(mailgunDomain, emailData);

    console.log("Email sent successfully:", data);

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      data: {
        id: data.id,
        message: data.message,
      },
    });
  } catch (error) {
    console.error("Error sending email:", error);

    // Check if it's a Mailgun-specific error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isForbiddenError =
      errorMessage.includes("Forbidden") || errorMessage.includes("403");

    let helpMessage = "";
    if (isForbiddenError && process.env.MAILGUN_DOMAIN?.includes("sandbox")) {
      helpMessage =
        " - Sandbox domain requires authorized recipients. Add the email to authorized recipients in your Mailgun dashboard.";
    }

    return NextResponse.json(
      {
        error: "Failed to send email",
        details: errorMessage + helpMessage,
        sandbox_mode: process.env.MAILGUN_DOMAIN?.includes("sandbox"),
        solution: isForbiddenError
          ? "Add recipient email to authorized list in Mailgun dashboard"
          : "Check Mailgun configuration",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing the API
export async function GET() {
  return NextResponse.json({
    message: "Email API endpoint is working",
    configuration: {
      mailgun_configured: !!process.env.MAILGUN_API_KEY,
      domain_configured: !!process.env.MAILGUN_DOMAIN,
      from_email_configured: !!process.env.MAILGUN_FROM_EMAIL,
    },
    usage: {
      method: "POST",
      endpoint: "/api/test-email",
      body: {
        to: "recipient@example.com",
        subject: "Optional subject",
        text: "Optional text content",
        html: "Optional HTML content",
      },
    },
  });
}
