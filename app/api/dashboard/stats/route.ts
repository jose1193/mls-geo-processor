import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

// Helper function to calculate time ago
function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInMs = now.getTime() - past.getTime();

  const seconds = Math.floor(diffInMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (seconds > 30) return `${seconds} second${seconds > 1 ? "s" : ""} ago`;

  return "Just now";
}

export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get total users count
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    // Get last activity from multiple sources (prioritized)
    let lastActivity = "Never";

    // 1. Try to get from user_sessions table first (most accurate)
    const { data: sessionData, error: sessionError } = await supabase
      .from("user_sessions")
      .select("last_activity")
      .order("last_activity", { ascending: false })
      .limit(1)
      .single();

    console.log("🔍 Session data:", sessionData, "Error:", sessionError);

    if (sessionData?.last_activity) {
      lastActivity = getTimeAgo(sessionData.last_activity);
      console.log("✅ Using session data:", lastActivity);
    } else {
      // 2. Fallback to users.last_login if no session data
      const { data: userLoginData, error: loginError } = await supabase
        .from("users")
        .select("last_login")
        .order("last_login", { ascending: false })
        .limit(1)
        .single();

      console.log("🔍 User login data:", userLoginData, "Error:", loginError);

      if (userLoginData?.last_login) {
        lastActivity = getTimeAgo(userLoginData.last_login);
        console.log("✅ Using user login data:", lastActivity);
      } else {
        // 3. Fallback to security_logs if no login data
        const { data: securityLogData, error: logError } = await supabase
          .from("security_logs")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        console.log(
          "🔍 Security log data:",
          securityLogData,
          "Error:",
          logError
        );

        if (securityLogData?.created_at) {
          lastActivity = getTimeAgo(securityLogData.created_at);
          console.log("✅ Using security log data:", lastActivity);
        }
      }
    }

    console.log("🎯 Final lastActivity:", lastActivity);

    // For now, we'll simulate some stats since we don't have processing tables yet
    // You can replace this with real data from your processing tables
    const stats = {
      totalUsers: totalUsers || 0,
      totalProcessed: 1250, // Replace with real count from processing table
      successRate: "94%", // Calculate from real processing results
      lastActivity: lastActivity,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
