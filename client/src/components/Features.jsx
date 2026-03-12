function AvailabilityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="4" />
      <path d="M8 3v4M16 3v4M3 10h18M8 14h3M8 17h6" />
    </svg>
  );
}

function VoteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 11V5a3 3 0 0 1 6 0v2h3a2 2 0 0 1 1.9 2.6l-1.7 6A3 3 0 0 1 14.3 18H8" />
      <path d="M4 10h4v8H4z" />
    </svg>
  );
}

function ItineraryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 4h14M5 12h14M5 20h14M5 4l3 3M5 12l3 3M5 20l3 3" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 18l-5 2V6l5-2 6 2 5-2v14l-5 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function ExpenseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M7 12h.01M17 10c-1.657 0-3 1.343-3 3" />
      <path d="M12 9c-1.657 0-3 1.343-3 3s1.343 3 3 3" />
    </svg>
  );
}

function CollaborationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3.5" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.74" />
    </svg>
  );
}

const features = [
  {
    title: "Shared Availability",
    description: "Find overlapping dates with a shared group calendar.",
    icon: AvailabilityIcon,
    tone: "bg-brand-primary/10 text-brand-primary"
  },
  {
    title: "Vote on Destinations",
    description: "Everyone suggests places and votes on what the group wants to do.",
    icon: VoteIcon,
    tone: "bg-brand-secondary/15 text-[#2C8B44]"
  },
  {
    title: "Auto-Built Itinerary",
    description: "Tripable automatically organizes selected activities into a realistic plan.",
    icon: ItineraryIcon,
    tone: "bg-brand-accent/20 text-[#D78528]"
  },
  {
    title: "Map View",
    description: "See all destinations and activities visually on a shared map.",
    icon: MapIcon,
    tone: "bg-brand-primary/10 text-brand-primary"
  },
  {
    title: "Expense Tracking",
    description: "Split costs and track shared expenses across the group.",
    icon: ExpenseIcon,
    tone: "bg-brand-accent/20 text-[#D78528]"
  },
  {
    title: "Collaborative Planning",
    description: "Everyone can add ideas, edit the plan, and participate.",
    icon: CollaborationIcon,
    tone: "bg-brand-secondary/15 text-[#2C8B44]"
  }
];

export default function Features() {
  return (
    <section id="features" className="px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-primary">Features</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Everything your group needs to plan the trip
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-[1.75rem] border border-white bg-white p-6 shadow-soft">
                <div className={`inline-flex rounded-2xl p-3 ${feature.tone}`}>
                  <Icon />
                </div>
                <h3 className="mt-5 text-xl font-bold text-ink">{feature.title}</h3>
                <p className="mt-3 text-base leading-7 text-ink/68">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
