"use client";

export default function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 overflow-y-auto py-10">
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-w-2xl w-full mx-4 p-6 space-y-5">
        <div className="flex justify-between items-start">
          <h2 className="text-lg font-semibold">How to use this</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 text-sm">close</button>
        </div>

        <section>
          <h3 className="text-sm font-medium text-orange-400 mb-1">What this is</h3>
          <p className="text-sm text-neutral-400">
            One question, answered every time you open it: who do I email next, and what do I say. Pick a goal on
            the left, review the queue in the middle, read and edit the draft on the right, then Approve, Skip,
            Snooze, or mark it Resolved elsewhere.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium text-orange-400 mb-1">The three panes</h3>
          <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
            <li><strong className="text-neutral-300">Goals (left)</strong> — what you&apos;re trying to accomplish. Click <em>+ New</em> to add one. Multiple goals can be active at once, each with its own queue.</li>
            <li><strong className="text-neutral-300">Queue (center)</strong> — everyone pending review for the selected goal, ranked by priority score. Click a row to open it.</li>
            <li><strong className="text-neutral-300">Draft detail (right)</strong> — the recipient, editable subject/body (saves automatically when you click away), the &quot;why now&quot; reasoning with its source citation, and the action buttons.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-medium text-orange-400 mb-1">Actions</h3>
          <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
            <li><strong className="text-neutral-300">Approve</strong> — marks it ready to send. Doesn&apos;t send by itself yet, see below.</li>
            <li><strong className="text-neutral-300">Skip</strong> — not a good fit, drop it.</li>
            <li><strong className="text-neutral-300">Snooze</strong> — not now, revisit later.</li>
            <li><strong className="text-neutral-300">Resolved elsewhere</strong> — handled outside email (call, in person).</li>
            <li>Click <strong className="text-neutral-300">history</strong> (top of the queue pane) to see everything you&apos;ve actioned for this goal, and <strong className="text-neutral-300">move back to pending</strong> if you want to undo any of it.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-medium text-orange-400 mb-1">Sending is agent-driven, not automatic</h3>
          <p className="text-sm text-neutral-400">
            &quot;Approve&quot; does not push a button in Gmail. An AI agent (Claude, Codex, or anything else) with its own
            Gmail access polls <code className="bg-neutral-900 px-1 rounded">GET /api/queue?status=approved</code>,
            sends using its own connection, then reports back with <code className="bg-neutral-900 px-1 rounded">PATCH /api/queue/:id</code>.
            Full details in <code className="bg-neutral-900 px-1 rounded">web/API.md</code>. This means no Google Cloud
            OAuth setup is required for v1 — that only matters if you want to send straight from this browser with
            no agent involved.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium text-orange-400 mb-1">What&apos;s real right now</h3>
          <p className="text-sm text-neutral-400">
            The 40 seeded leads are real GovContracts data with real buying-fact reasoning — not placeholder text.
            Every action you take writes to a real database. What&apos;s <em>not</em> live yet: drafts are seeded, not
            generated per-contact by an AI in real time; there&apos;s no reply/bounce tracking or scoreboard; goals
            can&apos;t be edited or archived once created (only made). See <code className="bg-neutral-900 px-1 rounded">web/SETUP.md</code> for
            the full list.
          </p>
        </section>
      </div>
    </div>
  );
}
