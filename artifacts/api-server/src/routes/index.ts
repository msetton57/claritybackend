import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportsRouter from "./reports";
import customersRouter from "./customers";
import productsRouter from "./products";
import ordersRouter from "./orders";
import arRouter from "./ar";
import promotionsRouter from "./promotions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportsRouter);
router.use(customersRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(arRouter);
router.use(promotionsRouter);

export default router;
