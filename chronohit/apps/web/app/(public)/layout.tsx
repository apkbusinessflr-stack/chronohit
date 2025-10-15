export const metadata = { title: 'ChronoHit — Fast, skill-based mini-games' };
export default function Layout({ children }: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <header className="max-w-5xl mx-auto p-4 flex items-center justify-between">
          <div className="font-bold tracking-wide">CHRONOHIT</div>
          <nav className="gap-4 hidden md:flex">
            <a href="/play">Play</a><a href="/games/reaction">Reaction</a>
            <a href="/games/stroop">Stroop</a><a href="/games/sequence">Sequence</a>
            <a href="/store">Credits</a><a href="/leaderboards">Leaderboards</a>
            <a href="/help">Help</a>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto p-4">{children}</main>
        <footer className="max-w-5xl mx-auto p-4 text-sm text-neutral-400">
          © {new Date().getFullYear()} ChronoHit • <a href="/privacy">Privacy</a> • <a href="/terms">Terms</a>
        </footer>
      </body>
    </html>
  );
}