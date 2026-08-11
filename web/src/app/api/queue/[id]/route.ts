import { NextResponse } from "next/server";
import { createServerClient, checkAgentAuth } from "@/lib/supabase-server";

const VALID_STATUSES = ["pending", "approved", "sent", "skipped", "snoozed", "resolved_elsewhere"];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAgentAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from("queue_items").select("*, contacts(*), goals(name)").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ queue_item: data });
}

// PATCH /api/queue/:id -- the send bridge. An agent that just sent (or drafted)
// an email via its own Gmail access reports back here:
//   { "status": "sent", "gmail_message_id": "...", "gmail_thread_id": "..." }
// Also accepts draft_subject/draft_body edits, or any other status transition.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAgentAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const supabase = createServerClient();
  const update: Record<string, unknown> = {};
  if (body.status) {
    update.status = body.status;
    update.resolved_at = body.status === "pending" ? null : new Date().toISOString();
  }
  if (body.draft_subject !== undefined) update.draft_subject = body.draft_subject;
  if (body.draft_body !== undefined) update.draft_body = body.draft_body;
  if (body.gmail_draft_id !== undefined) update.gmail_draft_id = body.gmail_draft_id;

  const { data, error } = await supabase.from("queue_items").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A real send gets logged to sent_emails too, so tracking has something to work with later.
  if (body.status === "sent" && body.gmail_message_id) {
    await supabase.from("sent_emails").insert({
      queue_item_id: id,
      gmail_message_id: body.gmail_message_id,
      gmail_thread_id: body.gmail_thread_id ?? null,
      sent_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ queue_item: data });
}
