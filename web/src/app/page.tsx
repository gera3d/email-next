"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Goal, QueueItem } from "@/lib/types";
import HelpPanel from "@/components/HelpPanel";

const STATUS_LABELS: Record<QueueItem["status"], string> = {
  pending: "Pending",
  approved: "Approved -- queued for an agent to send",
  sent: "Sent",
  skipped: "Skipped",
  snoozed: "Snoozed",
  resolved_elsewhere: "Resolved elsewhere",
};

// Statuses that mean "we've reached a decision about this contact" -- these set
// a cooldown so no other goal re-suggests the same person too soon (issue #11).
const COOLDOWN_TRIGGER_STATUSES: QueueItem["status"][] = ["approved", "sent", "skipped", "resolved_elsewhere"];

export default function Home() {
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [cooldownCount, setCooldownCount] = useState(0);
  const [historyItems, setHistoryItems] = useState<QueueItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalNameInput, setGoalNameInput] = useState("");
  const [goalDescriptionInput, setGoalDescriptionInput] = useState("");
  const [goalCadenceInput, setGoalCadenceInput] = useState(30);
  const [showHelp, setShowHelp] = useState(false);

  const loadGoals = useCallback(async () => {
    const { data, error } = await supabase.from("goals").select("*").order("created_at");
    if (error) { setError(error.message); return; }
    setGoals(data ?? []);
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
    const all = (data as unknown as QueueItem[]) ?? [];
    const now = Date.now();
    const eligible = all.filter((i) => !i.contacts?.cooldown_until || new Date(i.contacts.cooldown_until).getTime() <= now);
    setItems(eligible);
    setCooldownCount(all.length - eligible.length);
  }, [supabase]);

  const loadHistory = useCallback(async (goalId: string) => {
    const { data, error } = await supabase
      .from("queue_items")
      .select("*, contacts(*)")
      .eq("goal_id", goalId)
      .neq("status", "pending")
      .order("resolved_at", { ascending: false });
    if (error) { setError(error.message); return; }
    setHistoryItems((data as unknown as QueueItem[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadGoals().finally(() => setLoading(false));
  }, [loadGoals]);

  const activeGoals = goals.filter((g) => g.status === "active");
  const archivedGoals = goals.filter((g) => g.status === "archived");

  // Select the first active goal once, after goals load -- separate from loadGoals so
  // switching goals later never gets silently overridden by a stale re-fetch.
  useEffect(() => {
    if (activeGoals.length > 0 && !selectedGoalId) setSelectedGoalId(activeGoals[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, selectedGoalId]);

  useEffect(() => {
    if (!selectedGoalId) return;
    loadQueue(selectedGoalId);
    loadHistory(selectedGoalId);
  }, [selectedGoalId, loadQueue, loadHistory]);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null;
  const selectedItem = items.find((i) => i.id === selectedItemId)
    ?? historyItems.find((i) => i.id === selectedItemId)
    ?? null;

  useEffect(() => {
    if (selectedItem) {
      setDraftSubject(selectedItem.draft_subject ?? "");
      setDraftBody(selectedItem.draft_body ?? "");
    }
  }, [selectedItem]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function updateStatus(item: QueueItem, status: QueueItem["status"]) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const { error } = await supabase
      .from("queue_items")
      .update({ status, resolved_at: status === "pending" ? null : new Date().toISOString() })
      .eq("id", item.id);

    if (error) { setSubmitting(false); setError(error.message); return; }

    // Cooldown: apply on a real decision (approve/send/skip/resolved), clear on undo.
    // Global on the contact, not per-goal, so nobody gets double-messaged across goals.
    if (status === "pending") {
      await supabase.from("contacts").update({ cooldown_until: null }).eq("id", item.contact_id);
    } else if (COOLDOWN_TRIGGER_STATUSES.includes(status)) {
      const days = selectedGoal?.cadence_limit_days ?? 30;
      const cooldownUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const update: Record<string, unknown> = { cooldown_until: cooldownUntil };
      if (status === "sent") update.last_contacted_at = new Date().toISOString();
      await supabase.from("contacts").update(update).eq("id", item.contact_id);
    }

    setSubmitting(false);
    if (selectedGoalId) { await loadQueue(selectedGoalId); await loadHistory(selectedGoalId); }
    setSelectedItemId(null);
    showToast(status === "pending" ? "Moved back to pending" : `Marked ${STATUS_LABELS[status].toLowerCase()}`);
  }

  async function saveEdits() {
    if (!selectedItem) return;
    const { error } = await supabase
      .from("queue_items")
      .update({ draft_subject: draftSubject, draft_body: draftBody })
      .eq("id", selectedItem.id);
    if (error) { setError(error.message); return; }
    showToast("Draft saved");
  }

  function openNewGoalForm() {
    setEditingGoalId(null);
    setGoalNameInput("");
    setGoalDescriptionInput("");
    setGoalCadenceInput(30);
    setShowNewGoal(true);
  }

  function openEditGoalForm(g: Goal) {
    setShowNewGoal(false);
    setEditingGoalId(g.id);
    setGoalNameInput(g.name);
    setGoalDescriptionInput(g.description ?? "");
    setGoalCadenceInput(g.cadence_limit_days ?? 30);
  }

  async function createGoal() {
    if (!goalNameInput.trim() || submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("goals")
      .insert({ name: goalNameInput.trim(), description: goalDescriptionInput.trim() || null, cadence_limit_days: goalCadenceInput, status: "active" })
      .select()
      .single();
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    setError(null);
    setGoals((prev) => [...prev, data as Goal]);
    setSelectedGoalId(data.id);
    setShowNewGoal(false);
    showToast("Goal created");
  }

  async function saveGoalEdits() {
    if (!editingGoalId || !goalNameInput.trim() || submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("goals")
      .update({ name: goalNameInput.trim(), description: goalDescriptionInput.trim() || null, cadence_limit_days: goalCadenceInput })
      .eq("id", editingGoalId)
      .select()
      .single();
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    setError(null);
    setGoals((prev) => prev.map((g) => (g.id === editingGoalId ? (data as Goal) : g)));
    setEditingGoalId(null);
    showToast("Goal updated");
  }

  async function archiveGoal(id: string) {
    if (submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("goals").update({ status: "archived" }).eq("id", id);
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status: "archived" } : g)));
    setEditingGoalId(null);
    if (selectedGoalId === id) setSelectedGoalId(null);
    showToast("Goal archived");
  }

  async function reactivateGoal(id: string) {
    if (submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("goals").update({ status: "active" }).eq("id", id);
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status: "active" } : g)));
    showToast("Goal reactivated");
  }

  if (loading) return <div className="p-8 text-neutral-400">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">email-next</h1>
          <p className="text-xs text-neutral-500">Who to email next, and what to say.</p>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="text-xs text-neutral-400 hover:text-orange-400 border border-neutral-800 hover:border-orange-800 rounded px-3 py-1.5"
        >
          How to use this
        </button>
      </header>

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      {error && (
        <div className="bg-red-950 border-b border-red-800 px-4 py-2 text-sm text-red-300 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">dismiss</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Goals rail */}
        <aside className="w-56 border-r border-neutral-800 p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase text-neutral-500">Goals</div>
            <button onClick={openNewGoalForm} className="text-xs text-orange-400 hover:text-orange-300">
              + New
            </button>
          </div>
          {activeGoals.length === 0 && <div className="text-sm text-neutral-600">No active goals</div>}
          {activeGoals.map((g) => (
            <div key={g.id} className="group flex items-center mb-1">
              <button
                onClick={() => { setSelectedGoalId(g.id); setSelectedItemId(null); setShowHistory(false); }}
                className={`flex-1 text-left px-2 py-2 rounded text-sm truncate ${
                  selectedGoalId === g.id ? "bg-orange-600 text-white" : "hover:bg-neutral-900"
                }`}
                title={g.name}
              >
                {g.name}
              </button>
              <button
                onClick={() => openEditGoalForm(g)}
                className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-orange-400 text-xs px-1"
                title="Edit goal"
              >
                edit
              </button>
            </div>
          ))}

          {(showNewGoal || editingGoalId) && (
            <div className="mt-3 p-2 border border-neutral-800 rounded space-y-2">
              <input
                autoFocus
                placeholder="Goal name"
                className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
                value={goalNameInput}
                onChange={(e) => setGoalNameInput(e.target.value)}
              />
              <textarea
                placeholder="What does 'done' look like?"
                className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs h-16"
                value={goalDescriptionInput}
                onChange={(e) => setGoalDescriptionInput(e.target.value)}
              />
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                Cooldown
                <input
                  type="number"
                  className="w-14 bg-neutral-900 border border-neutral-800 rounded px-1 py-0.5 text-xs"
                  value={goalCadenceInput}
                  onChange={(e) => setGoalCadenceInput(Number(e.target.value))}
                />
                days
              </div>
              <div className="flex gap-1 flex-wrap">
                {editingGoalId ? (
                  <>
                    <button
                      onClick={saveGoalEdits}
                      disabled={!goalNameInput.trim() || submitting}
                      className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white px-2 py-1 rounded text-xs"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => archiveGoal(editingGoalId)}
                      disabled={submitting}
                      className="bg-neutral-800 hover:bg-red-900 disabled:opacity-40 px-2 py-1 rounded text-xs"
                    >
                      Archive
                    </button>
                  </>
                ) : (
                  <button
                    onClick={createGoal}
                    disabled={!goalNameInput.trim() || submitting}
                    className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white px-2 py-1 rounded text-xs"
                  >
                    Create
                  </button>
                )}
                <button
                  onClick={() => { setShowNewGoal(false); setEditingGoalId(null); }}
                  className="bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {archivedGoals.length > 0 && (
            <div className="mt-4 pt-3 border-t border-neutral-900">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="text-xs text-neutral-600 hover:text-neutral-400"
              >
                {showArchived ? "hide" : `${archivedGoals.length} archived`}
              </button>
              {showArchived && archivedGoals.map((g) => (
                <div key={g.id} className="flex items-center justify-between mt-1">
                  <span className="text-xs text-neutral-600 truncate">{g.name}</span>
                  <button onClick={() => reactivateGoal(g.id)} className="text-xs text-orange-500 hover:text-orange-400 ml-1">
                    reactivate
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Queue */}
        <section className="w-96 border-r border-neutral-800 overflow-y-auto">
          <div className="px-3 py-2 text-xs uppercase text-neutral-500 border-b border-neutral-800 flex justify-between items-center">
            <span>{showHistory ? `History (${historyItems.length})` : `Queue (${items.length})`}</span>
            <button onClick={() => setShowHistory((v) => !v)} className="text-orange-400 hover:text-orange-300 normal-case">
              {showHistory ? "back to queue" : "history"}
            </button>
          </div>
          {!showHistory && cooldownCount > 0 && (
            <div className="px-3 py-1.5 text-xs text-neutral-600 border-b border-neutral-900">
              {cooldownCount} more on cooldown (contacted too recently)
            </div>
          )}
          {(showHistory ? historyItems : items).map((item) => (
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
                <span className="text-xs text-orange-400">
                  {showHistory ? STATUS_LABELS[item.status] : item.priority_score}
                </span>
              </div>
              <div className="text-xs text-neutral-500 truncate">{item.reasoning_text}</div>
            </button>
          ))}
          {!showHistory && items.length === 0 && (
            <div className="p-4 text-sm text-neutral-600">
              {cooldownCount > 0 ? "Everyone left is on cooldown." : "Nothing pending for this goal."}
            </div>
          )}
          {showHistory && historyItems.length === 0 && (
            <div className="p-4 text-sm text-neutral-600">Nothing resolved yet for this goal.</div>
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
                  disabled={showHistory}
                />
              </div>
              <div>
                <div className="text-xs text-neutral-500 mb-1">Body</div>
                <textarea
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm h-40"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  onBlur={saveEdits}
                  disabled={showHistory}
                />
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm">
                <div className="text-xs text-neutral-500 mb-1">Why now</div>
                {selectedItem.reasoning_text}
                {selectedItem.source_snippet && (
                  <div className="mt-1 text-neutral-500 italic">&quot;{selectedItem.source_snippet}&quot;</div>
                )}
              </div>

              {!showHistory && (
                <>
                  <div className="text-xs text-neutral-600">
                    Approve queues this for an AI agent to actually send via its own Gmail access (see &quot;How to use this&quot;) --
                    it does not send the instant you click.
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={submitting}
                      onClick={() => updateStatus(selectedItem, "approved")}
                      className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => updateStatus(selectedItem, "skipped")}
                      className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 px-4 py-2 rounded text-sm"
                    >
                      Skip
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => updateStatus(selectedItem, "snoozed")}
                      className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 px-4 py-2 rounded text-sm"
                    >
                      Snooze
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => updateStatus(selectedItem, "resolved_elsewhere")}
                      className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 px-4 py-2 rounded text-sm"
                    >
                      Resolved elsewhere
                    </button>
                  </div>
                </>
              )}

              {showHistory && (
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-neutral-500 py-2">Status: {STATUS_LABELS[selectedItem.status]}</span>
                  <button
                    disabled={submitting}
                    onClick={() => updateStatus(selectedItem, "pending")}
                    className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 px-4 py-2 rounded text-sm"
                  >
                    Move back to pending
                  </button>
                </div>
              )}
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
