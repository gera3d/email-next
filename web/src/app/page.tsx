"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Goal, QueueItem } from "@/lib/types";

export default function Home() {
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    const { data, error } = await supabase.from("goals").select("*").order("created_at");
    if (error) { setError(error.message); return; }
    setGoals(data ?? []);
    if (data && data.length > 0 && !selectedGoalId) setSelectedGoalId(data[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadQueue = useCallback(async (goalId: string) => {
    const { data, error } = await supabase
      .from("queue_items")
      .select("*, contacts(*)")
      .eq("goal_id", goalId)
      .eq("status", "pending")
      .order("priority_score", { ascending: false });
    if (error) { setError(error.message); return; }
    setItems((data as unknown as QueueItem[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadGoals().finally(() => setLoading(false));
  }, [loadGoals]);

  useEffect(() => {
    if (selectedGoalId) loadQueue(selectedGoalId);
  }, [selectedGoalId, loadQueue]);

  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;

  useEffect(() => {
    if (selectedItem) {
      setDraftSubject(selectedItem.draft_subject ?? "");
      setDraftBody(selectedItem.draft_body ?? "");
    }
  }, [selectedItem]);

  async function updateStatus(id: string, status: QueueItem["status"]) {
    const { error } = await supabase.from("queue_items").update({ status, resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) { setError(error.message); return; }
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedItemId(null);
    setToast(`Marked ${status}`);
    setTimeout(() => setToast(null), 2000);
  }

  async function saveEdits() {
    if (!selectedItem) return;
    const { error } = await supabase
      .from("queue_items")
      .update({ draft_subject: draftSubject, draft_body: draftBody })
      .eq("id", selectedItem.id);
    if (error) { setError(error.message); return; }
    setToast("Draft saved");
    setTimeout(() => setToast(null), 2000);
  }

  if (loading) return <div className="p-8 text-neutral-400">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-4 py-3">
        <h1 className="text-lg font-semibold">email-next</h1>
        <p className="text-xs text-neutral-500">Who to email next, and what to say.</p>
      </header>

      {error && (
        <div className="bg-red-950 border-b border-red-800 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Goals rail */}
        <aside className="w-56 border-r border-neutral-800 p-3 overflow-y-auto">
          <div className="text-xs uppercase text-neutral-500 mb-2">Goals</div>
          {goals.length === 0 && <div className="text-sm text-neutral-600">No goals yet</div>}
          {goals.map((g) => (
            <button
              key={g.id}
              onClick={() => { setSelectedGoalId(g.id); setSelectedItemId(null); }}
              className={`w-full text-left px-2 py-2 rounded mb-1 text-sm ${
                selectedGoalId === g.id ? "bg-orange-600 text-white" : "hover:bg-neutral-900"
              }`}
            >
              {g.name}
            </button>
          ))}
        </aside>

        {/* Queue */}
        <section className="w-96 border-r border-neutral-800 overflow-y-auto">
          <div className="px-3 py-2 text-xs uppercase text-neutral-500 border-b border-neutral-800">
            Queue ({items.length})
          </div>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItemId(item.id)}
              className={`w-full text-left px-3 py-3 border-b border-neutral-900 ${
                selectedItemId === item.id ? "bg-neutral-900" : "hover:bg-neutral-900/50"
              }`}
            >
              <div className="flex justify-between items-baseline">
                <span className="font-medium text-sm">
                  {item.contacts?.display_name ?? item.contacts?.canonical_email}
                </span>
                <span className="text-xs text-orange-400">{item.priority_score}</span>
              </div>
              <div className="text-xs text-neutral-500 truncate">{item.reasoning_text}</div>
            </button>
          ))}
          {items.length === 0 && (
            <div className="p-4 text-sm text-neutral-600">Nothing pending for this goal.</div>
          )}
        </section>

        {/* Draft detail */}
        <section className="flex-1 overflow-y-auto p-6">
          {!selectedItem && (
            <div className="text-neutral-600 text-sm">Select someone from the queue to see their draft.</div>
          )}
          {selectedItem && (
            <div className="max-w-2xl space-y-4">
              <div>
                <div className="text-xs text-neutral-500">To</div>
                <div className="text-sm">{selectedItem.contacts?.canonical_email}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 mb-1">Subject</div>
                <input
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  onBlur={saveEdits}
                />
              </div>
              <div>
                <div className="text-xs text-neutral-500 mb-1">Body</div>
                <textarea
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm h-40"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  onBlur={saveEdits}
                />
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm">
                <div className="text-xs text-neutral-500 mb-1">Why now</div>
                {selectedItem.reasoning_text}
                {selectedItem.source_snippet && (
                  <div className="mt-1 text-neutral-500 italic">&quot;{selectedItem.source_snippet}&quot;</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateStatus(selectedItem.id, "approved")}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Approve &amp; Send
                </button>
                <button
                  onClick={() => updateStatus(selectedItem.id, "skipped")}
                  className="bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded text-sm"
                >
                  Skip
                </button>
                <button
                  onClick={() => updateStatus(selectedItem.id, "snoozed")}
                  className="bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded text-sm"
                >
                  Snooze
                </button>
                <button
                  onClick={() => updateStatus(selectedItem.id, "resolved_elsewhere")}
                  className="bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded text-sm"
                >
                  Resolved elsewhere
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-neutral-800 border border-neutral-700 px-4 py-2 rounded text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
