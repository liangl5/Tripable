import { create } from "zustand";
import { api } from "../lib/api.js";

export const useTripStore = create((set, get) => ({
  trips: [],
  currentTrip: null,
  ideas: [],
  itinerary: null,
  loading: false,
  tripsLoading: false,
  createTripLoading: false,
  tripLoading: false,
  deleteTripLoading: false,
  leaveTripLoading: false,
  ideasLoading: false,
  addIdeaLoading: false,
  updateIdeaLoading: false,
  deleteIdeaLoading: false,
  availabilitySaving: false,
  surveyDatesSaving: false,
  leadersSaving: false,
  itineraryLoading: false,
  error: null,

  loadTrips: async () => {
    set({ tripsLoading: true, error: null });
    try {
      const trips = await api.getTrips();
      set({ trips, tripsLoading: false });
    } catch (error) {
      set({ error: error.message, tripsLoading: false });
    }
  },

  createTrip: async (payload) => {
    set({ createTripLoading: true, error: null });
    try {
      const trip = await api.createTrip(payload);
      set((state) => ({ trips: [trip, ...state.trips], createTripLoading: false }));
      return trip;
    } catch (error) {
      set({ error: error.message, createTripLoading: false });
      throw error;
    }
  },

  loadTrip: async (tripId) => {
    set({ tripLoading: true, error: null });
    try {
      const trip = await api.getTrip(tripId);
      set({ currentTrip: trip, tripLoading: false });
      return trip;
    } catch (error) {
      set({ error: error.message, tripLoading: false });
      throw error;
    }
  },

  updateTripDates: async (tripId, payload) => {
    set({ tripLoading: true, error: null });
    try {
      const trip = await api.updateTripDates(tripId, payload);
      set((state) => ({
        currentTrip: state.currentTrip?.id === trip.id ? trip : state.currentTrip,
        trips: state.trips.map((candidate) => (candidate.id === trip.id ? trip : candidate)),
        tripLoading: false
      }));
      return trip;
    } catch (error) {
      set({ error: error.message, tripLoading: false });
      throw error;
    }
  },

  deleteTrip: async (tripId) => {
    set({ deleteTripLoading: true, error: null });
    try {
      await api.deleteTrip(tripId);
      set((state) => ({
        trips: state.trips.filter((trip) => trip.id !== tripId),
        currentTrip: state.currentTrip?.id === tripId ? null : state.currentTrip,
        deleteTripLoading: false
      }));
    } catch (error) {
      set({ error: error.message, deleteTripLoading: false });
      throw error;
    }
  },

  updateTripSurveyDates: async (tripId, payload) => {
    set({ surveyDatesSaving: true, error: null });
    try {
      const trip = await api.updateTripSurveyDates(tripId, payload);
      set((state) => ({
        currentTrip: state.currentTrip?.id === trip.id ? trip : state.currentTrip,
        trips: state.trips.map((candidate) => (candidate.id === trip.id ? { ...candidate, ...trip } : candidate)),
        surveyDatesSaving: false
      }));
      return trip;
    } catch (error) {
      set({ error: error.message, surveyDatesSaving: false });
      throw error;
    }
  },

  updateTripLeaders: async (tripId, payload) => {
    set({ leadersSaving: true, error: null });
    try {
      const trip = await api.updateTripLeaders(tripId, payload);
      set((state) => ({
        currentTrip: state.currentTrip?.id === trip.id ? trip : state.currentTrip,
        trips: state.trips.map((candidate) => (candidate.id === trip.id ? { ...candidate, ...trip } : candidate)),
        leadersSaving: false
      }));
      return trip;
    } catch (error) {
      set({ error: error.message, leadersSaving: false });
      throw error;
    }
  },

  updateTripAvailability: async (tripId, payload) => {
    set({ availabilitySaving: true, error: null });
    try {
      const trip = await api.updateTripAvailability(tripId, payload);
      set((state) => ({
        currentTrip: state.currentTrip?.id === trip.id ? trip : state.currentTrip,
        trips: state.trips.map((candidate) => (candidate.id === trip.id ? { ...candidate, ...trip } : candidate)),
        availabilitySaving: false
      }));
      return trip;
    } catch (error) {
      set({ error: error.message, availabilitySaving: false });
      throw error;
    }
  },

  joinTrip: async (tripId) => {
    try {
      await api.joinTrip(tripId);
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  leaveTrip: async (tripId) => {
    set({ leaveTripLoading: true, error: null });
    try {
      await api.leaveTrip(tripId);
      const trips = await api.getTrips();
      set((state) => ({
        trips,
        currentTrip: state.currentTrip?.id === tripId ? null : state.currentTrip,
        ideas: state.currentTrip?.id === tripId ? [] : state.ideas,
        itinerary: state.currentTrip?.id === tripId ? null : state.itinerary,
        leaveTripLoading: false
      }));
    } catch (error) {
      set({ error: error.message, leaveTripLoading: false });
      throw error;
    }
  },

  loadIdeas: async (tripId) => {
    set({ ideasLoading: true, error: null });
    try {
      const ideas = await api.getIdeas(tripId);
      set({ ideas, ideasLoading: false });
    } catch (error) {
      set({ error: error.message, ideasLoading: false });
      throw error;
    }
  },

  addIdea: async (tripId, payload) => {
    set({ addIdeaLoading: true, error: null });
    try {
      const idea = await api.createIdea(tripId, payload);
      set((state) => ({ ideas: [idea, ...state.ideas], addIdeaLoading: false }));
      return idea;
    } catch (error) {
      set({ error: error.message, addIdeaLoading: false });
      throw error;
    }
  },

  updateIdea: async (ideaId, tripId, payload) => {
    set({ updateIdeaLoading: true, error: null });
    try {
      const updatedIdea = await api.updateIdea(ideaId, tripId, payload);
      const ideas = await api.getIdeas(tripId);
      set({
        ideas,
        updateIdeaLoading: false
      });
      return updatedIdea;
    } catch (error) {
      set({ error: error.message, updateIdeaLoading: false });
      throw error;
    }
  },

  deleteIdea: async (ideaId, tripId) => {
    set({ deleteIdeaLoading: true, error: null });
    try {
      await api.deleteIdea(ideaId, tripId);
      const ideas = await api.getIdeas(tripId);
      set({
        ideas,
        deleteIdeaLoading: false
      });
    } catch (error) {
      set({ error: error.message, deleteIdeaLoading: false });
      throw error;
    }
  },

  voteIdea: async (ideaId, value) => {
    const previous = get().ideas;
    const priorVote = previous.find((idea) => idea.id === ideaId)?.userVote || 0;
    const delta = value - priorVote;
    set({
      ideas: previous.map((idea) =>
        idea.id === ideaId
          ? { ...idea, voteScore: idea.voteScore + delta, userVote: value }
          : idea
      )
    });
    try {
      const updated = await api.voteIdea(ideaId, value);
      set((state) => ({
        ideas: state.ideas.map((idea) => (idea.id === updated.id ? { ...idea, ...updated } : idea))
      }));
    } catch (error) {
      set({ ideas: previous, error: error.message });
    }
  },

  generateItinerary: async (tripId) => {
    set({ itineraryLoading: true, error: null });
    try {
      const itinerary = await api.generateItinerary(tripId);
      set({ itinerary, itineraryLoading: false });
      return itinerary;
    } catch (error) {
      set({ error: error.message, itineraryLoading: false });
      throw error;
    }
  },

  loadItinerary: async (tripId) => {
    set({ itineraryLoading: true, error: null });
    try {
      const itinerary = await api.getItinerary(tripId);
      set({ itinerary, itineraryLoading: false });
    } catch (error) {
      set({ error: error.message, itineraryLoading: false });
      throw error;
    }
  }
}));
