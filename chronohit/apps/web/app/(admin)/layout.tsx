export const metadata = { title: 'ChronoHit — Admin' };
export default function Layout({ children }: {children: React.ReactNode}) {
  return (
    <html lang="el">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="max-w-6xl mx-auto p-4 flex items-center justify-between">
          <div className="font-bold">CHRONOHIT • ADMIN</div>
          <nav className="gap-4 hidden md:flex">
            <a href="/el/admin">Πίνακας</a><a href="/el/admin/credits">Credits</a>
            <a href="/el/admin/leaderboards">Leaderboards</a><a href="/el/admin/flags">Flags</a>
            <a href="/el/admin/antiabuse">Anti-abuse</a><a href="/el/admin/logs">Logs</a>
          </nav>
        </header>
        <main className="max-w-6xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}