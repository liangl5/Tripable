import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { tripsRouter } from "./routes/trips.js";
import { ideasRouter } from "./routes/ideas.js";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/trips", tripsRouter);
app.use("/api/ideas", ideasRouter);

app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: err.errors.map((e) => e.message).join(", ") });
  }

  if (err.message?.includes("x-user-id")) {
    return res.status(400).json({ message: err.message });
  }

  console.error(err);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Tripute API running on ${PORT}`);
});
