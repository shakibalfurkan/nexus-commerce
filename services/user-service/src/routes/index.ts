import { Router } from "express";
import { UserRoutes } from "../modules/user/user.route.js";
import { CustomerRoutes } from "../modules/customer/customer.route.js";
import { SellerRoutes } from "../modules/seller/seller.route.js";
import { DeadLetterRoutes } from "../modules/dead-letter-event/deadLetter.route.js";
import { AdminRoutes } from "../modules/admin/admin.route.js";

const globalRouter: Router = Router();

/**
 * Prefix-per-module mounting. Module routers declare RELATIVE paths only; the
 * prefix is owned here so a role's surface is obvious from its mount point.
 *
 *   /users              → generic, role-agnostic user operations
 *   /customers          → customer registration (internal) + customer self-service
 *   /sellers            → seller registration (internal)
 *   /dead-letters → dead-letter administration (elevated roles, own module)
 *   /admins             → admin registration (internal)
 *
 * `/admins/dead-letters` is mounted BEFORE `/admins` so the dead-letter module
 * receives its requests first; AdminRoutes carries no router-level middleware,
 * but the explicit order keeps that a non-dependency.
 */
const moduleRoutes = [
  {
    path: "/users",
    route: UserRoutes,
  },
  {
    path: "/customers",
    route: CustomerRoutes,
  },
  {
    path: "/sellers",
    route: SellerRoutes,
  },
  {
    path: "/dead-letters",
    route: DeadLetterRoutes,
  },
  {
    path: "/admins",
    route: AdminRoutes,
  },
];

moduleRoutes.forEach((route) => globalRouter.use(route.path, route.route));

export default globalRouter;
