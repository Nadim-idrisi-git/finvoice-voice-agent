import { Router } from "express";
import { isExplicitConfirmation, validateAction } from "../lib/validate.js";
import { HttpError } from "../http.js";

export function actionRoutes({ actions }) {
  const router = Router();

  router.get("/actions", async (_req, res) => res.json(await actions.list(res.locals.user.id)));

  router.post("/actions", async (req, res) => {
    const { value, error } = validateAction(req.body);
    if (error) throw new HttpError(400, error);
    res.status(201).json(await actions.propose(res.locals.user.id, value));
  });

  router.post("/actions/:id/confirm", async (req, res) => {
    if (!isExplicitConfirmation(req.body)) throw new HttpError(400, "Explicit confirmation is required.");
    res.json(await actions.confirm(res.locals.user.id, req.params.id));
  });

  return router;
}
