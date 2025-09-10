import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Verificar que la request viene de GitHub Actions o un servicio autorizado
    const userAgent = request.headers.get("user-agent") || "";
    const authHeader = request.headers.get("authorization");

    // Verificar token de autorización (opcional pero recomendado)
    if (
      process.env.KEEPALIVE_SECRET &&
      authHeader !== `Bearer ${process.env.KEEPALIVE_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      .select("count(*)")
      .limit(1);

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
