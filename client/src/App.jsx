import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const TripListPage = lazy(() => import("./pages/TripListPage.jsx"));
const CreateTripPage = lazy(() => import("./pages/CreateTripPage.jsx"));
const TripDashboardPage = lazy(() => import("./pages/TripDashboardPage.jsx"));
const ItineraryPage = lazy(() => import("./pages/ItineraryPage.jsx"));

export default function App() {
  return (
    <div className="app-shell min-h-screen">
      <Suspense
        fallback={
          <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12 text-sm text-slate-500">
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/trips" element={<TripListPage />} />
          <Route path="/trips/new" element={<CreateTripPage />} />
          <Route path="/trips/:tripId" element={<TripDashboardPage />} />
          <Route path="/trips/:tripId/itinerary" element={<ItineraryPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}
