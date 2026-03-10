import { prisma } from "./prisma.js";

export async function ensureUser(req) {
  const userId = req.header("x-user-id");
  if (!userId) {
    throw new Error("Missing x-user-id header");
  }

  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@tripute.local`,
        name: "Tripute User"
      }
    });
  }
  return user;
}
