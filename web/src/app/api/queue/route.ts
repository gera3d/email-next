import { NextResponse } from "next/server";
import { createServerClient, checkAgentAuth } from "@/lib/supabase-server";

// GET /api/queue?goal_id=...&status=pending|approved|... (default: approved -- the
// set an agent should be looking for: reviewed by a human, ready to actually send)
export async function GET(req: Request) {
  if (!checkAgentAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const goalId = searchParams.get("goal_id");
  const status = searchParams.get("status") ?? "approved";

  const supabase = createServerClient();
  let query = supabase
    .from("queue_items")
    .select("*, contacts(*), goals(name)")
    .eq("status", status)
    .order("priority_score", { ascending: false });
  if (goalId) query = query.eq("goal_id", goalId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ queue_items: data });
}
