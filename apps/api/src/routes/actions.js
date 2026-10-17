import { Router } from "express";
import { actionSchema, confirmationSchema } from "@finance-agent/shared";
import { HttpError } from "../http.js";

export function actionRoutes({ actions }) {
  const router = Router();

  router.get("/actions", async (_req, res) => res.json(await actions.list(res.locals.user.id)));

  router.post("/actions", async (req, res) => {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid action.");
    res.status(201).json(await actions.propose(res.locals.user.id, parsed.data));
  });

  router.post("/actions/:id/confirm", async (req, res) => {
    if (!confirmationSchema.safeParse(req.body).success) throw new HttpError(400, "Explicit confirmation is required.");
    res.json(await actions.confirm(res.locals.user.id, req.params.id));
  });

  return router;
}
