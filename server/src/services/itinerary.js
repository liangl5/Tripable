import { prisma } from "./prisma.js";

function hashLocation(location) {
  let hash = 0;
  for (let i = 0; i < location.length; i += 1) {
    hash = (hash * 31 + location.charCodeAt(i)) % 1000000;
  }
  return hash;
}

function locationToPoint(location) {
  const hash = hashLocation(location.toLowerCase());
  const lat = (hash % 180) - 90;
  const lon = ((Math.floor(hash / 180)) % 360) - 180;
  return { lat, lon };
}

function distance(a, b) {
  const dx = a.lat - b.lat;
  const dy = a.lon - b.lon;
  return Math.sqrt(dx * dx + dy * dy);
}

function daysBetween(start, end) {
  const oneDay = 24 * 60 * 60 * 1000;
  const startMs = new Date(start).setHours(0, 0, 0, 0);
  const endMs = new Date(end).setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((endMs - startMs) / oneDay) + 1);
}

export async function generateItinerary(tripId) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      ideas: {
        include: { votes: true }
      }
    }
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  const ideasWithScores = trip.ideas.map((idea) => {
    const voteScore = idea.votes.reduce((sum, vote) => sum + vote.value, 0);
    return {
      ...idea,
      voteScore,
      coords: locationToPoint(idea.location)
    };
  });

  ideasWithScores.sort((a, b) => {
    if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
    return hashLocation(a.location) - hashLocation(b.location);
  });

  const totalDays = daysBetween(trip.startDate, trip.endDate);
  const ideasPerDay = Math.max(1, Math.ceil(ideasWithScores.length / totalDays));
  const dayBuckets = Array.from({ length: totalDays }, (_, index) => ({
    dayNumber: index + 1,
    date: new Date(new Date(trip.startDate).setDate(new Date(trip.startDate).getDate() + index)),
    items: []
  }));

  const clusterAssignments = new Map();

  ideasWithScores.forEach((idea) => {
    const clusterKey = `${Math.round(idea.coords.lat / 10)}-${Math.round(idea.coords.lon / 10)}`;
    let dayIndex = clusterAssignments.get(clusterKey);

    if (dayIndex === undefined) {
      dayIndex = dayBuckets.findIndex((day) => day.items.length < ideasPerDay);
      if (dayIndex === -1) {
        dayIndex = dayBuckets.length - 1;
      }
      clusterAssignments.set(clusterKey, dayIndex);
    }

    const day = dayBuckets[dayIndex];
    const lastItem = day.items[day.items.length - 1];
    if (lastItem && distance(lastItem.coords, idea.coords) > 50) {
      const nextIndex = dayBuckets.findIndex((candidate) => candidate.items.length < ideasPerDay);
      if (nextIndex !== -1) {
        dayIndex = nextIndex;
      }
    }

    dayBuckets[dayIndex].items.push(idea);
  });

  await prisma.itineraryItem.deleteMany({
    where: { itineraryDay: { tripId } }
  });
  await prisma.itineraryDay.deleteMany({ where: { tripId } });

  const createdDays = [];
  for (const day of dayBuckets) {
    const itineraryDay = await prisma.itineraryDay.create({
      data: {
        tripId,
        dayNumber: day.dayNumber,
        date: day.date
      }
    });

    const items = await Promise.all(
      day.items.map((idea, index) =>
        prisma.itineraryItem.create({
          data: {
            itineraryDayId: itineraryDay.id,
            ideaId: idea.id,
            order: index + 1
          }
        })
      )
    );

    createdDays.push({
      ...itineraryDay,
      items: items.map((item, index) => ({
        id: item.id,
        order: item.order,
        title: day.items[index]?.title,
        location: day.items[index]?.location
      }))
    });
  }

  return createdDays;
}
