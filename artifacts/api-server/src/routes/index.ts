import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userRouter from "./user";
import adsRouter from "./ads";
import jackpotRouter from "./jackpot";
import streakRouter from "./streak";
import referralRouter from "./referral";
import winnersRouter from "./winners";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userRouter);
router.use(adsRouter);
router.use(jackpotRouter);
router.use(streakRouter);
router.use(referralRouter);
router.use(winnersRouter);

export default router;
