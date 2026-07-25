import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { CustomerRoutes } from "../modules/customer/customer.route.js";

const globalRouter: Router = Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/customers",
    route: CustomerRoutes,
  },
];

moduleRoutes.forEach((route) => globalRouter.use(route.path, route.route));

export default globalRouter;
