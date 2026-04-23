import { Link } from "react-router-dom";
import TripableLogo from "./TripableLogo.jsx";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function TripableLogoLink({
  className = "",
  size = "md",
  showTagline = false,
  surface = "light"
}) {
  return (
    <Link
      to="/"
      aria-label="Go to the Tripable home page"
      className={joinClasses(
        "group inline-flex flex-col items-start gap-1 transition",
        className
      )}
    >
      <TripableLogo
        alt=""
        surface={surface}
        size={size}
        className="transition-transform group-hover:scale-[1.03]"
      />
      {showTagline ? (
        <p className={joinClasses("pl-1 text-xs font-medium", surface === "dark" ? "text-white/70" : "text-ink/60")}>
          Plan together
        </p>
      ) : null}
    </Link>
  );
}
