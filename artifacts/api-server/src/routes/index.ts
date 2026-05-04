import { Router, type IRouter } from "express";
import healthRouter from "./health";
import manifestRouter from "./public/manifest";
import cronRouter from "./public/cron";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/public", manifestRouter);
router.use("/public", cronRouter);

export default router;
