import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/extension-removed")({
  head: () => ({
    meta: [
      { title: "Extension removed — DeveloperX" },
      { name: "description", content: "DeveloperX Chrome extension has been uninstalled." },
      { property: "og:title", content: "Extension removed — DeveloperX" },
      { property: "og:description", content: "You have removed the DeveloperX extension from your browser." },
    ],
  }),
  component: ExtensionRemovedPage,
});

function ExtensionRemovedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-10 shadow-2xl">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center text-3xl">
          👋
        </div>
        <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
          Extension removed
        </h1>
        <p className="text-white/70 mb-6 leading-relaxed">
          You've uninstalled the <strong>DeveloperX</strong> extension. Your Google account and Flow session were
          not touched by us — if you're seeing a signed-out state, just sign back into Google normally.
        </p>
        <p className="text-white/50 text-sm mb-8">
          Changed your mind? You can re-install the extension anytime from your dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/dashboard"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:opacity-90 transition"
          >
            Re-install extension
          </Link>
          <a
            href="https://wa.me/8801410014442"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition"
          >
            Contact support
          </a>
        </div>
      </div>
    </main>
  );
}
