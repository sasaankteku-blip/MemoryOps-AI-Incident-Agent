import { Router, type IRouter } from "express";
import healthRouter from "./health";
import memoryopsRouter from "./memoryops";

const router: IRouter = Router();

router.use(healthRouter);
router.use(memoryopsRouter);

export default router;
