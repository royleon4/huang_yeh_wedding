import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from "express";
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
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use("/api", router);

const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: "API route not found",
    code: "NOT_FOUND",
  });
};

const handleError: ErrorRequestHandler = (error, request, response, _next) => {
  request.log.error({ error }, "Unhandled API request failure");
  if (response.headersSent) {
    response.end();
    return;
  }
  response.status(500).json({
    error: "The API request could not be completed",
    code: "INTERNAL_ERROR",
  });
};

app.use(notFound);
app.use(handleError);

export default app;
