import { Router } from "express";
import { voteOnIdea } from "../controllers/ideasController.js";

export const ideasRouter = Router();

ideasRouter.post("/:id/vote", voteOnIdea);
