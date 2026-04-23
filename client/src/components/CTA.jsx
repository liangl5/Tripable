import { useNavigate } from "react-router-dom";
import { useSession } from "../App";
import TripableLogo from "./TripableLogo.jsx";

export default function CTA() {
  const navigate = useNavigate();
  const session = useSession();

  const handlePlanTrip = () => {
    if (session) {
      navigate("/trips/new");
    } else {
      navigate("/auth");
    }
  };

  return (
    <section className="px-5 py-10 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2.25rem] bg-[#1e4840] px-8 py-14 text-center shadow-card sm:px-12">
        <TripableLogo alt="Tripable" surface="dark" size="sm" className="mx-auto" />
        <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Make planning the beginning of the trip.
        </h2>
        <button
          onClick={handlePlanTrip}
          className="mt-8 inline-flex rounded-2xl bg-[#baf59c] px-7 py-4 text-base font-semibold text-[#1e4840] shadow-soft transition hover:bg-[#a7ee84]"
        >
          Plan trip
        </button>
      </div>
    </section>
  );
}
