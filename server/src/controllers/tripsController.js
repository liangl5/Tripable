import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { ensureUser } from "../services/user.js";
import { generateItinerary } from "../services/itinerary.js";

const tripSchema = z.object({
  name: z.string().min(2),
  startDate: z.string(),
  endDate: z.string()
});

export async function listTrips(req, res, next) {
  try {
    const user = await ensureUser(req);
    const memberships = await prisma.tripMember.findMany({
      where: { userId: user.id },
      include: { trip: true }
    });

    const trips = await Promise.all(
      memberships.map(async (membership) => {
        const memberCount = await prisma.tripMember.count({
          where: { tripId: membership.tripId }
        });
        return {
          id: membership.trip.id,
          name: membership.trip.name,
          startDate: membership.trip.startDate.toISOString().slice(0, 10),
          endDate: membership.trip.endDate.toISOString().slice(0, 10),
          memberCount
        };
      })
    );

    res.json(trips);
  } catch (error) {
    next(error);
  }
}

export async function createTrip(req, res, next) {
  try {
    const user = await ensureUser(req);
    const payload = tripSchema.parse(req.body);
    const trip = await prisma.trip.create({
      data: {
        name: payload.name,
        startDate: new Date(payload.startDate),
        endDate: new Date(payload.endDate),
        createdById: user.id,
        members: {
          create: {
            userId: user.id
          }
        }
      }
    });

    res.status(201).json({
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate.toISOString().slice(0, 10),
      endDate: trip.endDate.toISOString().slice(0, 10),
      memberCount: 1
    });
  } catch (error) {
    next(error);
  }
}

export async function getTrip(req, res, next) {
  try {
    const { id } = req.params;
    const trip = await prisma.trip.findUnique({
      where: { id }
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const memberCount = await prisma.tripMember.count({ where: { tripId: id } });

    res.json({
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate.toISOString().slice(0, 10),
      endDate: trip.endDate.toISOString().slice(0, 10),
      memberCount
    });
  } catch (error) {
    next(error);
  }
}

export async function joinTrip(req, res, next) {
  try {
    const user = await ensureUser(req);
    const { id } = req.params;

    await prisma.tripMember.upsert({
      where: {
        tripId_userId: {
          tripId: id,
          userId: user.id
        }
      },
      update: {},
      create: {
        tripId: id,
        userId: user.id
      }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listIdeas(req, res, next) {
  try {
    const user = await ensureUser(req);
    const { id } = req.params;

    const ideas = await prisma.idea.findMany({
      where: { tripId: id },
      include: {
        createdBy: true,
        votes: true
      },
      orderBy: { createdAt: "desc" }
    });

    const formatted = ideas.map((idea) => {
      const voteScore = idea.votes.reduce((sum, vote) => sum + vote.value, 0);
      const userVote = idea.votes.find((vote) => vote.userId === user.id)?.value || 0;
      return {
        id: idea.id,
        title: idea.title,
        description: idea.description,
        location: idea.location,
        category: idea.category,
        createdAt: idea.createdAt,
        submittedBy: idea.createdBy.name,
        voteScore,
        userVote
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
}

export async function createIdea(req, res, next) {
  try {
    const user = await ensureUser(req);
    const { id } = req.params;
    const ideaSchema = z.object({
      title: z.string().min(2),
      description: z.string().min(2),
      location: z.string().min(2),
      category: z.string().optional()
    });
    const payload = ideaSchema.parse(req.body);

    const idea = await prisma.idea.create({
      data: {
        tripId: id,
        title: payload.title,
        description: payload.description,
        location: payload.location,
        category: payload.category,
        createdById: user.id
      },
      include: { createdBy: true }
    });

    res.status(201).json({
      id: idea.id,
      title: idea.title,
      description: idea.description,
      location: idea.location,
      category: idea.category,
      createdAt: idea.createdAt,
      submittedBy: idea.createdBy.name,
      voteScore: 0,
      userVote: 0
    });
  } catch (error) {
    next(error);
  }
}

export async function generateTripItinerary(req, res, next) {
  try {
    const { id } = req.params;
    await generateItinerary(id);
    const itinerary = await getItineraryPayload(id);
    res.json(itinerary);
  } catch (error) {
    next(error);
  }
}

export async function getTripItinerary(req, res, next) {
  try {
    const { id } = req.params;
    const itinerary = await getItineraryPayload(id);
    res.json(itinerary);
  } catch (error) {
    next(error);
  }
}

async function getItineraryPayload(tripId) {
  const days = await prisma.itineraryDay.findMany({
    where: { tripId },
    include: {
      items: {
        include: { idea: true },
        orderBy: { order: "asc" }
      }
    },
    orderBy: { dayNumber: "asc" }
  });

  return {
    tripId,
    days: days.map((day) => {
      const locationLabel = day.items[0]?.idea?.location || "";
      return {
        dayNumber: day.dayNumber,
        date: day.date.toISOString().slice(0, 10),
        locationLabel,
        items: day.items.map((item) => ({
          id: item.id,
          order: item.order,
          title: item.idea?.title,
          location: item.idea?.location
        }))
      };
    })
  };
}
