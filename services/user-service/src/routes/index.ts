import { Router } from "express";
import { UserRoutes } from "../modules/user/user.route.js";

const globalRouter: Router = Router();

const moduleRoutes = [
  {
    path: "/users",
    route: UserRoutes,
  },
];

moduleRoutes.forEach((route) => globalRouter.use(route.path, route.route));

export default globalRouter;
