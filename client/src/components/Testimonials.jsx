const testimonials = [
  {
    quote: "Finally a trip planner that works for groups.",
    author: "Sarah L."
  },
  {
    quote: "We planned our entire Japan trip in one place.",
    author: "Jason M."
  },
  {
    quote: "No more Google Docs and messy chats.",
    author: "Priya K."
  }
];

export default function Testimonials() {
  return (
    <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-primary">Social proof</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Planning trips with friends shouldn&apos;t feel like a group project.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((item) => (
            <article
              key={item.author}
              className="rounded-[1.75rem] border border-white bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-card"
            >
              <div className="mb-5 flex gap-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span key={index} className="h-2.5 w-2.5 rounded-full bg-brand-accent" />
                ))}
              </div>
              <p className="text-lg font-medium leading-8 text-ink">&ldquo;{item.quote}&rdquo;</p>
              <p className="mt-6 text-sm font-semibold text-ink/60">- {item.author}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
