import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { ensureUser } from "../services/user.js";

const voteSchema = z.object({
  value: z.number().int().min(-1).max(1)
});

export async function voteOnIdea(req, res, next) {
  try {
    const user = await ensureUser(req);
    const { id } = req.params;
    const payload = voteSchema.parse(req.body);

    await prisma.vote.upsert({
      where: {
        ideaId_userId: {
          ideaId: id,
          userId: user.id
        }
      },
      update: { value: payload.value },
      create: {
        ideaId: id,
        userId: user.id,
        value: payload.value
      }
    });

    const idea = await prisma.idea.findUnique({
      where: { id },
      include: { votes: true, createdBy: true }
    });

    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }

    const voteScore = idea.votes.reduce((sum, vote) => sum + vote.value, 0);
    const userVote = idea.votes.find((vote) => vote.userId === user.id)?.value || 0;

    res.json({
      id: idea.id,
      title: idea.title,
      description: idea.description,
      location: idea.location,
      category: idea.category,
      createdAt: idea.createdAt,
      submittedBy: idea.createdBy.name,
      voteScore,
      userVote
    });
  } catch (error) {
    next(error);
  }
}
