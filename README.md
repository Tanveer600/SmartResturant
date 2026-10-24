# Restaurant Smart
MERN TypeScript restaurant ordering starter. React/Tailwind, Redux Toolkit and Saga, Express and tenant-scoped Mongoose.

## Run
Install Node 20+ and MongoDB. Copy `server/.env.example` to `server/.env`, set MONGODB_URI and a random JWT_SECRET (32+ chars), run `npm install` then `npm run dev`. Client is on port 5173, API on port 4000.

Redux modules are in client/src/redux: slice, saga, services, rootSaga, rootReducer and store. Server models and public order/reservation routes are in server/src. Every restaurant-owned document has tenantId and compound indexes; requests resolve tenant by slug and server queries apply that tenant. Never authorize from a client-supplied tenantId. Provider keys are optional; configure Stripe, Gmail app password and Meta WhatsApp Cloud API credentials in server/.env. JazzCash/EasyPaisa are marked pending until merchant verification and signed callbacks are configured. Configure HTTPS, backups, monitoring and payment webhooks before production use.

To create the included Copper Spoon sample restaurant, set MONGODB_URI then run the documented seed script. This is explicit and does not seed the database on API startup.

Stripe order status is updated only by the signed webhook at POST /api/webhooks/stripe. Configure that URL in Stripe and set STRIPE_WEBHOOK_SECRET; a browser redirect does not confirm payment. Run npm run seed once MONGODB_URI is set to create the sample Copper Spoon tenant. API starts only after MongoDB is reachable.
