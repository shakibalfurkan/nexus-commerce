import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { CustomerRoutes } from "../modules/customer/customer.route.js";
import { SellerRoutes } from "../modules/seller/seller.route.js";
import { AdminRoutes } from "../modules/admin/admin.route.js";

const globalRouter: Router = Router();

/**
 * Prefix-per-module mounting. Module routers declare RELATIVE paths only; the
 * prefix is owned here so a role's surface is obvious from its mount point.
 *
 *   /auth      → session-level auth shared by every surface
 *   /customers → customer-app registration (OTP verified) and login
 *   /sellers   → seller-app registration (OTP verified) and login
 *   /admins    → admin-app login and the admin invite flow
 */
const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
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
    path: "/admins",
    route: AdminRoutes,
  },
];

moduleRoutes.forEach((route) => globalRouter.use(route.path, route.route));

export default globalRouter;
