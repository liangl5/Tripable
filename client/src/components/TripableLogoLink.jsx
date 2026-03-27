import { Link } from "react-router-dom";
import tripableLogo from "../../imgs/icon.png";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function TripableLogoLink({
  className = "",
  compact = false,
  showTagline = true,
  surface = false
}) {
  return (
    <Link
      to="/"
      aria-label="Go to the Tripable home page"
      className={joinClasses(
        "group inline-flex items-center gap-3 transition",
        surface && "rounded-full bg-white/90 px-4 py-2 shadow-card backdrop-blur-sm",
        className
      )}
    >
      <img
        src={tripableLogo}
        alt="Tripable logo"
        className={joinClasses(
          "w-auto object-contain transition-transform group-hover:scale-[1.03]",
          compact ? "h-10" : "h-12"
        )}
      />
      <div>
        <p className={joinClasses("font-bold tracking-tight text-ink", compact ? "text-base" : "text-lg")}>
          Tripable
        </p>
        {showTagline ? <p className="text-xs text-ink/60">Plan together</p> : null}
      </div>
    </Link>
  );
}
