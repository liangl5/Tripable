import { create } from "zustand";
import { api } from "../lib/api.js";
import { trackEvent } from "../lib/analytics.js";

export const useTripStore = create((set, get) => ({
  trips: [],
  currentTrip: null,
  ideas: [],
  itinerary: null,
  loading: false,
  tripsLoading: false,
  createTripLoading: false,
  inviteSendLoading: false,
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
  flashNotice: null,
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
      void trackEvent("trip_created", {
        trip_id: trip.id,
        invitee_count: Array.isArray(payload?.invitees) ? payload.invitees.length : 0
      });
      return trip;
    } catch (error) {
      set({ error: error.message, createTripLoading: false });
      throw error;
    }
  },

  duplicateTrip: async (tripId, payload) => {
    set({ createTripLoading: true, error: null });
    try {
      const trip = await api.duplicateTrip(tripId, payload);
      set((state) => ({ trips: [trip, ...state.trips], createTripLoading: false }));
      void trackEvent("trip_duplicated", {
        trip_id: trip.id,
        source_trip_id: tripId
      });
      return trip;
    } catch (error) {
      set({ error: error.message, createTripLoading: false });
      throw error;
    }
  },

  setFlashNotice: (flashNotice) => {
    set({ flashNotice });
  },

  clearFlashNotice: () => {
    set({ flashNotice: null });
  },

  sendTripInvites: async (payload) => {
    set({ inviteSendLoading: true, error: null });
    try {
      const result = await api.sendTripInvites(payload);
      set({ inviteSendLoading: false });
      void trackEvent("trip_invite_sent", {
        trip_id: payload?.tripId,
        total: result?.total || 0,
        sent: result?.sent || 0,
        failed: result?.failed || 0
      });
      return result;
    } catch (error) {
      set({ error: error.message, inviteSendLoading: false });
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

  loadTripInvitePreview: async (tripId) => {
    set({ tripLoading: true, error: null });
    try {
      const trip = await api.getTripInvitePreview(tripId);
      set({ tripLoading: false });
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
      void trackEvent("trip_dates_finalized", {
        trip_id: tripId,
        start_date: payload?.startDate || "",
        end_date: payload?.endDate || ""
      });
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
      void trackEvent("trip_deleted", { trip_id: tripId });
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
      void trackEvent("trip_survey_dates_updated", {
        trip_id: tripId,
        date_count: Array.isArray(payload?.dates) ? payload.dates.length : 0
      });
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
      void trackEvent("availability_submitted", {
        trip_id: tripId,
        date_count: Array.isArray(payload?.dates) ? payload.dates.length : 0
      });
      return trip;
    } catch (error) {
      set({ error: error.message, availabilitySaving: false });
      throw error;
    }
  },

  joinTrip: async (tripId) => {
    try {
      await api.joinTrip(tripId);
      void trackEvent("trip_joined", { trip_id: tripId });
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
      void trackEvent("trip_left", { trip_id: tripId });
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
      void trackEvent("idea_created", {
        trip_id: tripId,
        idea_id: idea.id,
        category: payload?.category || ""
      });
      return idea;
    } catch (error) {
      set({ error: error.message, addIdeaLoading: false });
      throw error;
    }
  },

  updateTripMeta: async (tripId, payload) => {
    set({ tripLoading: true, error: null });
    try {
      const trip = await api.updateTripMeta(tripId, payload);
      set((state) => ({
        currentTrip: state.currentTrip?.id === trip.id ? trip : state.currentTrip,
        trips: state.trips.map((candidate) => (candidate.id === trip.id ? { ...candidate, ...trip } : candidate)),
        tripLoading: false
      }));
      return trip;
    } catch (error) {
      set({ error: error.message, tripLoading: false });
      throw error;
    }
  },

  updateIdea: async (ideaId, tripId, payload) => {
    set({ updateIdeaLoading: true, error: null });
    try {
      const updatedIdea = await api.updateIdea(ideaId, tripId, payload);
      set((state) => ({
        ideas: state.ideas.some((idea) => idea.id === updatedIdea.id)
          ? state.ideas.map((idea) => (idea.id === updatedIdea.id ? updatedIdea : idea))
          : [updatedIdea, ...state.ideas],
        updateIdeaLoading: false
      }));
      void trackEvent("idea_updated", {
        trip_id: tripId,
        idea_id: ideaId,
        category: payload?.category || ""
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
      void trackEvent("idea_deleted", {
        trip_id: tripId,
        idea_id: ideaId
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
      void trackEvent("idea_voted", {
        idea_id: ideaId,
        vote_value: value,
        previous_vote: priorVote
      });
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
