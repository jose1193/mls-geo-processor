import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";

const createUserSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

// GET - Listar todos los usuarios
export async function GET() {
  try {
    // Verificar autenticación
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verificar que supabaseAdmin esté disponible
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 500 }
      );
    }

    // Obtener usuarios de la base de datos
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name, last_login, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { error: "Error fetching users" },
        { status: 500 }
      );
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo usuario
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, name } = createUserSchema.parse(body);

    // Verificar que supabaseAdmin esté disponible
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 500 }
      );
    }

    // Verificar si el usuario ya existe
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Crear nuevo usuario
    const { data: newUser, error } = await supabaseAdmin
      .from("users")
      .insert({
        email,
        name,
      })
      .select("id, email, name, created_at")
      .single();

    if (error) {
      console.error("Error creating user:", error);
      return NextResponse.json(
        { error: "Error creating user" },
        { status: 500 }
      );
    }

    // Log del evento de seguridad
    await logSecurityEvent(session.user.email, "user_created", request, {
      created_user_email: email,
      created_user_name: name,
    });

    return NextResponse.json({
      success: true,
      message: "User created successfully",
      user: newUser,
    });
  } catch (error) {
    console.error("Create user error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper para logging de eventos de seguridad
async function logSecurityEvent(
  adminEmail: string,
  eventType: string,
  request: NextRequest,
  details: Record<string, unknown> = {}
) {
  try {
    // Verificar que supabaseAdmin esté disponible
    if (!supabaseAdmin) {
      console.error("supabaseAdmin not available for logging");
      return;
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "";

    await supabaseAdmin.from("security_logs").insert({
      user_id: null, // Could be improved to get actual user ID
      event_type: eventType,
      ip_address: ip,
      user_agent: userAgent,
      details: {
        admin_email: adminEmail,
        ...details,
      },
    });
  } catch (error) {
    console.error("Error logging security event:", error);
  }
}
