// https://clerk.com/docs/nextjs/middleware

import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/",
    "/api/generate/character",
    "/api/generate/character/:field",
    "/api/save/character/:field",
    "/character",
    "/character/:id",
  ],
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
