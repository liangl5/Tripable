import { Router } from "express";
import {
  listTrips,
  createTrip,
  deleteTrip,
  getTrip,
  updateTripDates,
  updateTripAvailability,
  updateTripLeaders,
  updateTripSurveyDates,
  joinTrip,
  listIdeas,
  createIdea,
  generateTripItinerary,
  getTripItinerary
} from "../controllers/tripsController.js";

export const tripsRouter = Router();

tripsRouter.get("/", listTrips);
tripsRouter.post("/", createTrip);
tripsRouter.get("/:id", getTrip);
tripsRouter.delete("/:id", deleteTrip);
tripsRouter.patch("/:id", updateTripDates);
tripsRouter.put("/:id/availability", updateTripAvailability);
tripsRouter.put("/:id/leaders", updateTripLeaders);
tripsRouter.put("/:id/survey-dates", updateTripSurveyDates);
tripsRouter.post("/:id/join", joinTrip);
tripsRouter.get("/:id/ideas", listIdeas);
tripsRouter.post("/:id/ideas", createIdea);
tripsRouter.post("/:id/generate-itinerary", generateTripItinerary);
tripsRouter.get("/:id/itinerary", getTripItinerary);
