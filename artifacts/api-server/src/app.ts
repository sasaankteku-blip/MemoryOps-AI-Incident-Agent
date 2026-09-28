import express, { type Express, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin: process.env.APP_ORIGIN || false,
}));
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "not_found",
      message: "Route not found",
      details: {},
    },
  });
});

app.use((err: unknown, _req: unknown, res: Response) => {
  logger.error({ err }, "Unhandled request error");
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "The server could not complete the request.",
      details: {},
    },
  });
});

export default app;
