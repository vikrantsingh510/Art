import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middlewares/auth.middleware.js';
import adminRouter from './admin.routes.js';
import authRouter from './auth.routes.js';
import { artworkPublicRouter } from './artwork.routes.js';
import { blogPublicRouter } from './blog.routes.js';
import { cartRouter, addressRouter, checkoutRouter, orderRouter, wishlistRouter } from './cart.routes.js';
import { categoryPublicRouter, collectionPublicRouter } from './catalog.routes.js';
import healthRouter from './health.routes.js';
import { paymentRouter, webhookRouter } from './payment.routes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/artworks', artworkPublicRouter);
apiRouter.use('/categories', categoryPublicRouter);
apiRouter.use('/collections', collectionPublicRouter);
apiRouter.use('/blogs', blogPublicRouter);
apiRouter.use('/cart', requireAuth, cartRouter);
apiRouter.use('/wishlist', requireAuth, wishlistRouter);
apiRouter.use('/addresses', requireAuth, addressRouter);
apiRouter.use('/checkout', requireAuth, checkoutRouter);
apiRouter.use('/orders', requireAuth, orderRouter);
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/webhooks', webhookRouter);
apiRouter.use('/admin', requireAuth, requireAdmin, adminRouter);

export default apiRouter;
