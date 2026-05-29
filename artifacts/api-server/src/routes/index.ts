import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coversRouter from "./covers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(coversRouter);

export default router;
