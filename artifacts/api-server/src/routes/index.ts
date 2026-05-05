import { Router, type IRouter } from "express";
import healthRouter from "./health";
import manifestRouter from "./public/manifest";
import cronRouter from "./public/cron";
import tablesRouter from "./tables";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/public", manifestRouter);
router.use("/public", cronRouter);
router.use("/api", tablesRouter);

export default router;
