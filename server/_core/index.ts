import "dotenv/config";
import express from "express";
import { createServer } from "http";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduler } from "../scheduler";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  const apiLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
  const crawlerLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false, message: "Muitas requisições ao crawler. Tente novamente em 1 minuto." });

  app.use("/api/trpc", apiLimiter);
  app.use("/api/trpc/offers.runCrawler", crawlerLimiter);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000");

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Iniciar scheduler de crawler
    startScheduler();
  });
}

startServer().catch(console.error);
