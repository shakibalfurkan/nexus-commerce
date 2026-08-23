import { Router } from "express";
import { UserRoutes } from "../modules/user/user.route.js";
import { DeadLetterRoutes } from "../modules/dead-letter-event/deadLetter.route.js";

const globalRouter: Router = Router();

const moduleRoutes = [
  {
    path: "/users",
    route: UserRoutes,
  },
  {
    path: "/admin",
    route: DeadLetterRoutes,
  },
];

export default globalRouter;
