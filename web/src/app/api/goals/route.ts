import { NextResponse } from "next/server";
import { createServerClient, checkAgentAuth } from "@/lib/supabase-server";

export async function GET(req: Request) {
  if (!checkAgentAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = createServerClient();
  const { data, error } = await supabase.from("goals").select("*").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goals: data });
}

export async function POST(req: Request) {
  if (!checkAgentAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      name: body.name,
      description: body.description ?? null,
      target_segment: body.target_segment ?? null,
      cadence_limit_days: body.cadence_limit_days ?? 30,
      tone: body.tone ?? null,
      status: body.status ?? "active",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal: data }, { status: 201 });
}
