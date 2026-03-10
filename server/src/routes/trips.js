import { Router } from "express";
import {
  listTrips,
  createTrip,
  getTrip,
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
tripsRouter.post("/:id/join", joinTrip);
tripsRouter.get("/:id/ideas", listIdeas);
tripsRouter.post("/:id/ideas", createIdea);
tripsRouter.post("/:id/generate-itinerary", generateTripItinerary);
tripsRouter.get("/:id/itinerary", getTripItinerary);
