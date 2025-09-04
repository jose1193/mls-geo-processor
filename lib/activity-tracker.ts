import { createClient } from "@supabase/supabase-js";

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
