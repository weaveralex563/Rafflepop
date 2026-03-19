import { Router, type IRouter } from "express";
import healthRouter from "./health";
import userRouter from "./user";
import raffleRouter from "./raffle";
import drawsRouter from "./draws";

const router: IRouter = Router();

router.use(healthRouter);
router.use(userRouter);
router.use(raffleRouter);
router.use(drawsRouter);

export default router;
