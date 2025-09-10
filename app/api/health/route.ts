import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Este endpoint está específicamente diseñado para UptimeRobot
  // No hace verificaciones pesadas para evitar interferencias
  
  const userAgent = request.headers.get("user-agent") || "";
  console.log(`🏥 Health check from: ${userAgent}`);

  try {
    // Verificación mínima - solo que el servidor responde
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0",
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

// También permitir POST
export async function POST(request: NextRequest) {
  return GET(request);
}
