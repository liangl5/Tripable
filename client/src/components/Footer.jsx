export default function Footer() {
  return (
    <footer className="border-t border-white/70 px-5 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm text-ink/65 md:flex-row md:items-center md:justify-between">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 font-medium">
          {["Product", "Features", "Pricing", "About", "Contact"].map((item) => (
            <a key={item} href="#" className="transition hover:text-brand-primary">
              {item}
            </a>
          ))}
        </nav>
        <p>© 2026 Tripable</p>
      </div>
    </footer>
  );
}
