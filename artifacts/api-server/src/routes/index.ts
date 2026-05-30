import { Router, type IRouter } from "express";
import healthRouter from "./health";
import threatsRouter from "./threats";
import recommendationsRouter from "./recommendations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(threatsRouter);
router.use(recommendationsRouter);

export default router;
