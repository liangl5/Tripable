import { Link } from "react-router-dom";

export default function CTA() {
  return (
    <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2.25rem] bg-[#4C6FFF] px-8 py-14 text-center shadow-card sm:px-12">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">Tripable</p>
        <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Make planning the beginning of the trip.
        </h2>
        <Link
          to="/trips/new"
          className="mt-8 inline-flex rounded-full bg-white px-7 py-4 text-base font-semibold text-[#4C6FFF] shadow-soft transition hover:bg-slate-100"
        >
          Plan trip
        </Link>
      </div>
    </section>
  );
}
