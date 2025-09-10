import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Log para monitoreo (mantener info del user agent para seguridad)
    const userAgent = request.headers.get("user-agent") || "";
    const isUptimeRobot = userAgent.toLowerCase().includes("uptimerobot") || 
                         userAgent.toLowerCase().includes("uptime") ||
                         userAgent.toLowerCase().includes("monitor");
    
    console.log(`🏓 Keepalive request from: ${userAgent}${isUptimeRobot ? ' [UPTIME BOT DETECTED]' : ''}`);

    // Si es UptimeRobot, devolver respuesta rápida sin verificaciones pesadas
    if (isUptimeRobot) {
      console.log("🤖 UptimeRobot detected - returning fast response");
      return NextResponse.json({
        success: true,
        message: "Service is up",
        timestamp: new Date().toISOString(),
        uptime: true,
      });
    }

    // Opcional: Verificar token solo si está configurado (para uso avanzado)
    const authHeader = request.headers.get("authorization");
    if (process.env.KEEPALIVE_SECRET && authHeader) {
      if (authHeader !== `Bearer ${process.env.KEEPALIVE_SECRET}`) {
        console.log("❌ Invalid keepalive token provided");
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      console.log("✅ Valid keepalive token provided");
    }

    // Verificar que Supabase admin está disponible
    if (!supabaseAdmin) {
      console.error("Supabase admin client not available");
      return NextResponse.json(
        {
          success: false,
          error: "Supabase admin client not available",
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Ping simple a Supabase para mantener la conexión activa
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Keepalive Supabase error:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    console.log(`✅ Keepalive successful at ${new Date().toISOString()}`);
    console.log(`📊 Supabase connection verified, user count query executed`);

    return NextResponse.json({
      success: true,
      message: "Supabase connection active",
      timestamp: new Date().toISOString(),
      userAgent: userAgent,
      data: data,
    });
  } catch (error) {
    console.error("Keepalive error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// También permitir POST para mayor flexibilidad
export async function POST(request: NextRequest) {
  return GET(request);
}
