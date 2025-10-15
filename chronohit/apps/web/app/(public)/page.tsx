export default function Page() {
  return (
    <section className="grid md:grid-cols-2 gap-8 items-center">
      <div>
        <h1 className="text-3xl md:text-5xl font-extrabold">ChronoHit</h1>
        <p className="mt-4 text-neutral-300">Fast, skill-based mini-games. Reaction. Stroop. Sequence. Play for credits. No email required.</p>
        <div className="mt-6 flex gap-3">
          <a className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500" href="/play">Play now</a>
          <a className="px-5 py-3 rounded-xl bg-neutral-800" href="/store">Get credits</a>
        </div>
      </div>
      <div className="aspect-video rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
        <span className="text-neutral-400">Game preview</span>
      </div>
    </section>
  );
}