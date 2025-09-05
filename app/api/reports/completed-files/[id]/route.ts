import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

interface RouteParams {
  params: {
    id: string;
  };
}

// DELETE - Eliminar archivo completado
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Verificar autenticación
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fileId = params.id;

    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Verificar que el archivo existe y obtener información
    const { data: fileToDelete, error: fetchError } = await supabaseAdmin
      .from("mls_completed_files")
      .select("id, original_filename, user_id, storage_path")
      .eq("id", fileId)
      .single();

    if (fetchError || !fileToDelete) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Verificar que el usuario tiene permisos para eliminar este archivo
    if (fileToDelete.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "You can only delete your own files" },
        { status: 403 }
      );
    }

    // Eliminar archivo de storage si existe
    if (fileToDelete.storage_path) {
      try {
        const { error: storageError } = await supabaseAdmin.storage
          .from("mls-processed-files")
          .remove([fileToDelete.storage_path]);

        if (storageError) {
          console.warn(
            "Warning: Could not delete file from storage:",
            storageError
          );
          // Continue with database deletion even if storage deletion fails
        }
      } catch (storageErr) {
        console.warn("Warning: Storage deletion error:", storageErr);
        // Continue with database deletion
      }
    }

    // Eliminar registro de base de datos
    const { error: deleteError } = await supabaseAdmin
      .from("mls_completed_files")
      .delete()
      .eq("id", fileId);

    if (deleteError) {
      console.error("Error deleting file record:", deleteError);
      return NextResponse.json(
        { error: "Error deleting file record" },
        { status: 500 }
      );
    }

    // Log del evento de seguridad
    await logSecurityEvent(session.user.email, "file_deleted", request, {
      deleted_file_name: fileToDelete.original_filename,
      deleted_file_id: fileId,
      storage_path: fileToDelete.storage_path,
    });

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper para logging de eventos de seguridad
async function logSecurityEvent(
  userEmail: string,
  eventType: string,
  request: NextRequest,
  details: Record<string, unknown> = {}
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "";

    if (supabaseAdmin) {
      await supabaseAdmin.from("security_logs").insert({
        user_id: null,
        event_type: eventType,
        ip_address: ip,
        user_agent: userAgent,
        details: {
          user_email: userEmail,
          ...details,
        },
      });
    }
  } catch (error) {
    console.error("Error logging security event:", error);
  }
}
