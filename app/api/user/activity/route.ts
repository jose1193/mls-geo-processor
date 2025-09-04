import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateUserActivity } from "@/lib/activity-tracker";

export async function POST() {
  try {
    const session = await auth();

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update user activity
    await updateUserActivity(session.user.email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating activity:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
