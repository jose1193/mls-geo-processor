import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function updateUserActivity(userEmail: string): Promise<void> {
  try {
    // Update last_login in users table
    await supabase
      .from("users")
      .update({
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail);

    // Update last_activity in user_sessions table for this user
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .single();

    if (user) {
      await supabase
        .from("user_sessions")
        .update({ last_activity: new Date().toISOString() })
        .eq("user_id", user.id);
    }
  } catch (error) {
    console.error("Error updating user activity:", error);
  }
}

export async function logUserActivity(
  userEmail: string,
  eventType: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .single();

    if (user) {
      await supabase.from("security_logs").insert({
        user_id: user.id,
        event_type: eventType,
        ip_address: ipAddress,
        user_agent: userAgent,
        details: details || {},
        created_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error logging user activity:", error);
  }
}

/**
 * Log security events with admin privileges - for use in API routes
 */
export async function logSecurityEvent(
  userIdOrEmail: string | null,
  eventType: string,
  request: NextRequest,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase");

    if (!supabaseAdmin) {
      console.warn(
        "Cannot log security event: Supabase admin client not available"
      );
      return;
    }

    let userId: string | null = null;

    // Si se proporciona un email, obtener el ID del usuario
    if (userIdOrEmail && userIdOrEmail.includes("@")) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", userIdOrEmail)
        .single();
      userId = user?.id || null;
    } else {
      userId = userIdOrEmail;
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
