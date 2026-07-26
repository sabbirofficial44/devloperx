import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAlertLog } from "@/lib/flow-admin.functions";
import { ArrowLeft, Bell, CheckCircle2, XCircle, MinusCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-alerts")({
  head: () => ({
    meta: [
      { title: "Alert Log · DeveloperX Admin" },
      { name: "description", content: "Recent monitoring alerts with delivery status per channel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AlertLogPage,
});

function StatusPill({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null || ok === undefined) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/50 ring-1 ring-white/10">
        <MinusCircle size={12} /> {label}: n/a
      </span>
    );
  }
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-400/30">
      <CheckCircle2 size={12} /> {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300 ring-1 ring-rose-400/30">
      <XCircle size={12} /> {label} failed
    </span>
  );
}

function AlertLogPage() {
  const fetchAlerts = useServerFn(listAlertLog);
  const router = useRouter();
  const q = useQuery({
    queryKey: ["admin", "alert-log"],
    queryFn: () => fetchAlerts(),
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/_authenticated/admin" className="ax-btn ax-btn-ghost" aria-label="Back to admin">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
                <Bell size={20} className="text-amber-300" /> Alert Log
              </h1>
              <p className="text-sm text-white/60">Last 100 monitoring alerts · delivery status per channel</p>
            </div>
          </div>
          <button
            onClick={() => { q.refetch(); router.invalidate(); }}
            className="ax-btn ax-btn-ghost inline-flex items-center gap-2"
            disabled={q.isFetching}
          >
            <RefreshCw size={14} className={q.isFetching ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {q.isLoading ? (
          <div className="rounded-2xl bg-white/5 p-8 text-center text-white/60 ring-1 ring-white/10">Loading…</div>
        ) : q.error ? (
          <div className="rounded-2xl bg-rose-500/10 p-6 text-rose-200 ring-1 ring-rose-500/30">
            {(q.error as Error).message}
          </div>
        ) : !q.data?.length ? (
          <div className="rounded-2xl bg-white/5 p-8 text-center text-white/60 ring-1 ring-white/10">
            No alerts recorded yet. 🎉
          </div>
        ) : (
          <ul className="space-y-3">
            {q.data.map((a) => {
              const dt = new Date(a.created_at);
              return (
                <li
                  key={a.id}
                  className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-white/80">
                          {a.kind}
                        </span>
                        {a.subject && (
                          <span className="truncate text-sm font-medium text-white/90">{a.subject}</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-white/50" title={dt.toISOString()}>
                        {dt.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill ok={a.email_ok} label="Email" />
                      <StatusPill ok={a.slack_ok} label="Slack" />
                    </div>
                  </div>
                  {a.message && (
                    <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 font-mono text-xs text-white/70 ring-1 ring-white/5">
{a.message}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
