import { Router, type IRouter } from "express";
import healthRouter from "./health";
import photosRouter from "./photos";

const router: IRouter = Router();

router.use(healthRouter);
router.use(photosRouter);

export default router;
