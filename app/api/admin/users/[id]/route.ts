import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { auth } from "@/lib/auth";

// DELETE - Eliminar usuario
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;

    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Verificar que el usuario existe y obtener información
    const { data: userToDelete, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, email, name")
      .eq("id", userId)
      .single();

    if (fetchError || !userToDelete) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevenir que el admin se elimine a sí mismo
    if (userToDelete.email === session.user.email) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Eliminar usuario
    const { error: deleteError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return NextResponse.json(
        { error: "Error deleting user" },
        { status: 500 }
      );
    }

    // Log del evento de seguridad
    // Obtener el ID del admin que está realizando la acción
    const { data: adminUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", session.user.email)
      .single();

    await logSecurityEvent(adminUser?.id || null, "user_deleted", request, {
      admin_email: session.user.email,
      deleted_user_email: userToDelete.email,
      deleted_user_name: userToDelete.name,
      deleted_user_id: userId,
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper para logging de eventos de seguridad
async function logSecurityEvent(
  userId: string | null,
  eventType: string,
  request: NextRequest,
  details: Record<string, unknown> = {}
) {
  try {
    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      console.warn(
        "Cannot log security event: Supabase admin client not available"
      );
      return;
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "";

    await supabaseAdmin.from("security_logs").insert({
      user_id: userId,
      event_type: eventType,
      ip_address: ip,
      user_agent: userAgent,
      details: details,
    });
  } catch (error) {
    console.error("Error logging security event:", error);
  }
}
