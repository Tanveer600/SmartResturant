import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import Joi from "joi";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import {
  Restaurant,
  Category,
  MenuItem,
  Order,
  Reservation,
  User,
  Table,
} from "./models.js";
const app = express();
const staffStreams = new Map<string, Set<Response>>();
function publishTenantUpdate(tenantId: unknown, type: "orders" | "reservations") {
  const clients = staffStreams.get(String(tenantId));
  if (!clients) return;
  const message = `data: ${JSON.stringify({ type })}\n\n`;
  for (const client of clients) client.write(message);
}
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || [process.env.CLIENT_ORIGIN, process.env.CLIENT_URL, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"].filter(Boolean).includes(origin)),
    credentials: true,
  }),
);
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (q, r) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = q.headers["stripe-signature"];
    if (
      !secret ||
      typeof signature !== "string" ||
      !process.env.STRIPE_SECRET_KEY
    )
      return r
        .status(503)
        .json({ message: "Stripe webhook is not configured" });
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const event = stripe.webhooks.constructEvent(q.body, signature, secret);
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
      ) {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        const orderId = session.metadata?.orderId;
        if (tenantId && orderId)
          await Order.updateOne(
            { _id: orderId, tenantId, paymentStatus: "pending" },
            { paymentStatus: "paid" },
          );
      }
      if (
        event.type === "checkout.session.async_payment_failed" ||
        event.type === "checkout.session.expired"
      ) {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        const orderId = session.metadata?.orderId;
        if (tenantId && orderId)
          await Order.updateOne(
            { _id: orderId, tenantId, paymentStatus: "pending" },
            { paymentStatus: "failed" },
          );
      }
      r.json({ received: true });
    } catch {
      r.status(400).json({ message: "Invalid Stripe signature" });
    }
  },
);
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 900000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
type U = { userId: string; tenantId: string | null; role: string };
const auth = (q: Request) => {
  const token = q.cookies?.access_token;
  if (!token) throw Object.assign(Error("Sign in required"), { status: 401 });
  return jwt.verify(token, process.env.JWT_SECRET!) as U;
};
const tenant = async (slug: string): Promise<any> => {
  const r = await Restaurant.findOne({ slug, active: true }).lean();
  if (!r) throw Object.assign(Error("Restaurant not found"), { status: 404 });
  return r;
};
const member = (u: U, r: { _id: unknown }) => {
  if (!["owner", "kitchen", "super_admin"].includes(u.role))
    throw Object.assign(Error("Staff role required"), { status: 403 });
  if (u.role !== "super_admin" && u.tenantId !== String(r._id))
    throw Object.assign(Error("Tenant access denied"), { status: 403 });
};
const reservedSeatsOnTable = (booking: any, table: any, tables: any[]) => {
  const explicit = (booking.tableAssignments || []).find((row: any) => String(row.tableId) === String(table._id));
  if (explicit) return Math.min(table.capacity, Number(explicit.seats) || 0);
  const ids = (booking.tableIds || []).map((id: any) => String(id));
  const currentIndex = ids.indexOf(String(table._id));
  if (currentIndex >= 0) {
    const precedingCapacity = ids.slice(0, currentIndex).reduce((sum: number, id: string) => sum + (tables.find((row: any) => String(row._id) === id)?.capacity || 0), 0);
    return Math.min(table.capacity, Math.max(0, booking.guestCount - precedingCapacity));
  }
  return String(booking.tableId || "") === String(table._id) ? Math.min(table.capacity, booking.guestCount) : 0;
};
async function notify(
  to: string | undefined,
  phone: string | undefined,
  text: string,
  subject = "Restaurant Smart update",
  html?: string,
) {
  const jobs: Promise<unknown>[] = [];
  if (to && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const mail = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    jobs.push(
      mail.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    );
  } else if (to) {
    console.warn("Order email skipped: configure GMAIL_USER and GMAIL_APP_PASSWORD in server/.env");
  }
  if (
    phone &&
    (process.env.WHATSAPP_ACCESS_TOKEN ?? process.env.WHATSAPP_TOKEN) &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  )
    jobs.push(
      fetch(
        "https://graph.facebook.com/v21.0/" +
          process.env.WHATSAPP_PHONE_NUMBER_ID +
          "/messages",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + (process.env.WHATSAPP_ACCESS_TOKEN ?? process.env.WHATSAPP_TOKEN),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body: text },
          }),
        },
      ),
    );
  const results = await Promise.allSettled(jobs);
  for (const result of results)
    if (result.status === "rejected")
      console.error("Notification delivery failed:", result.reason instanceof Error ? result.reason.message : result.reason);
}
app.get("/health", (_q, r) => r.json({ status: "ok" }));
app.get("/api/owner/restaurants/:slug/events", async (q, r, n) => {
  let clientSet: Set<Response> | undefined;
  let heartbeat: NodeJS.Timeout | undefined;
  try {
    const user = auth(q);
    const restaurant = await tenant(q.params.slug);
    member(user, restaurant);
    const key = String(restaurant._id);
    clientSet = staffStreams.get(key);
    if (!clientSet) staffStreams.set(key, (clientSet = new Set<Response>()));
    r.status(200);
    r.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    r.flushHeaders();
    clientSet.add(r);
    r.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    heartbeat = setInterval(() => r.write(": keep-alive\n\n"), 25000);
    heartbeat.unref();
    r.on("close", () => {
      if (heartbeat) clearInterval(heartbeat);
      clientSet?.delete(r);
      if (clientSet?.size === 0) staffStreams.delete(key);
    });
  } catch (error) { n(error); }
});
app.get("/api/owner/restaurants/:slug/integrations/email", async (q, r, n) => {
  try {
    const user = auth(q);
    const restaurant = await tenant(q.params.slug);
    member(user, restaurant);
    r.json({ configured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD), sender: process.env.GMAIL_USER || null });
  } catch (error) { n(error); }
});
app.post("/api/auth/onboard", async (q, r, n) => {
  try {
    const { value, error } = Joi.object({
      restaurant: Joi.object({
        name: Joi.string().min(2).max(120).required(),
        slug: Joi.string()
          .lowercase()
          .pattern(/^[a-z0-9-]+$/)
          .required(),
        email: Joi.string().email().optional(),
        phone: Joi.string().optional(),
      }).required(),
      owner: Joi.object({
        name: Joi.string().min(2).max(120).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(12).required(),
      }).required(),
    }).validate(q.body);
    if (error)
      return r
        .status(400)
        .json({ message: "Check restaurant and owner details" });
    const restaurant = await Restaurant.create(value.restaurant);
    const owner = value.owner;
    const user = await User.create({
      tenantId: restaurant._id,
      name: owner.name,
      email: owner.email.toLowerCase(),
      passwordHash: await bcrypt.hash(owner.password, 12),
      role: "owner",
    });
    r.status(201).json({
      restaurant: { id: restaurant.id, slug: restaurant.slug },
      ownerId: user.id,
    });
  } catch (e) {
    n(e);
  }
});
app.post("/api/auth/bootstrap-owner", async (q, r, n) => {
  try {
    const { value, error } = Joi.object({
      setupKey: Joi.string().required(),
      slug: Joi.string().lowercase().pattern(/^[a-z0-9-]+$/).required(),
      restaurantName: Joi.string().trim().min(2).max(120).required(),
      name: Joi.string().min(2).max(120).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(12).required(),
    }).validate(q.body);
    if (error) return r.status(400).json({ message: "Check setup details; password must be at least 12 characters" });
    const expected = process.env.OWNER_SETUP_KEY || "";
    const supplied = String(value.setupKey);
    if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)))
      return r.status(403).json({ message: "Invalid owner setup key" });
    let rest: any = await Restaurant.findOne({ slug: value.slug }).lean();
    if (!rest) {
      rest = await Restaurant.findOneAndUpdate(
        { slug: value.slug },
        { $setOnInsert: {
          name: value.restaurantName,
          slug: value.slug,
          description: "A restaurant powered by Restaurant Smart.",
          currency: "PKR",
          timezone: "Asia/Karachi",
          active: true,
        } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
    }
    if (!rest.active) rest = await Restaurant.findByIdAndUpdate(rest._id, { active: true }, { new: true }).lean();
    if (await User.exists({ tenantId: rest._id, role: "owner" }))
      return r.status(409).json({ message: "An owner account is already set up for this restaurant" });
    const user = await User.create({ tenantId: rest._id, name: value.name, email: value.email.toLowerCase(), passwordHash: await bcrypt.hash(value.password, 12), role: "owner" });
    let firstFloorTables = await Table.find({ tenantId: rest._id, floor: "First Floor" }).sort({ number: 1 }).lean();
    if (!firstFloorTables.length) {
      await Table.insertMany(Array.from({ length: 5 }, (_, index) => ({ tenantId: rest._id, number: String(index + 1), capacity: 4, floor: "First Floor", section: "Main dining" })));
      firstFloorTables = await Table.find({ tenantId: rest._id, floor: "First Floor" }).sort({ number: 1 }).lean();
    }
    if (firstFloorTables.length > 5) {
      const overflowIds = firstFloorTables.slice(5).map((table: any) => table._id);
      await Table.updateMany({ tenantId: rest._id, _id: mongoose.trusted({ $in: overflowIds }) }, { $set: { floor: "Second Floor" } });
    }
    const allTableNumbers = new Set((await Table.find({ tenantId: rest._id }).select("number").lean()).map((table: any) => table.number));
    const missingCount = Math.max(0, 5 - Math.min(firstFloorTables.length, 5));
    const missingTables: any[] = [];
    for (let index = 0; index < missingCount; index++) {
      let number = `F1-${index + 1}`;
      while (allTableNumbers.has(number)) number = `F1-${number}`;
      allTableNumbers.add(number);
      missingTables.push({ tenantId: rest._id, number, capacity: 4, floor: "First Floor", section: "Main dining" });
    }
    if (missingTables.length) await Table.insertMany(missingTables);
    await Table.updateMany({ tenantId: rest._id, floor: { $exists: false } }, { $set: { floor: "First Floor" } });
    await Reservation.updateMany({ tenantId: rest._id, floor: { $exists: false } }, { $set: { floor: "First Floor" } });
    r.status(201).json({ id: user.id, message: "Owner account created. Sign in to open the dashboard." });
  } catch (e) { n(e); }
});
app.post("/api/auth/login", async (q, r, n) => {
  try {
    const { value, error } = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
      slug: Joi.string().lowercase().pattern(/^[a-z0-9-]+$/).required(),
    }).validate(q.body);
    if (error)
      return r.status(400).json({ message: "Invalid email or password" });
    const restaurant: any = await Restaurant.findOne({ slug: value.slug, active: true }).select("_id").lean();
    if (!restaurant) return r.status(404).json({ message: "Restaurant not found" });
    let user: any = await User.findOne({
      email: value.email.toLowerCase(),
      tenantId: restaurant._id,
      active: true,
    }).select("+passwordHash");
    if (!user) user = await User.findOne({ email: value.email.toLowerCase(), role: "super_admin", active: true }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(value.password, user.passwordHash)))
      return r.status(401).json({ message: "Invalid email or password" });
    const key = process.env.JWT_SECRET;
    if (!key || key.length < 32)
      return r
        .status(503)
        .json({ message: "Authentication is not configured" });
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId?.toString() ?? null,
        role: user.role,
      },
      key,
      { expiresIn: "8h" },
    );
    r.cookie("access_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 28800000,
    });
    r.json({ id: user.id, name: user.name, role: user.role });
  } catch (e) {
    n(e);
  }
});
app.get("/api/auth/me", async (q, r, n) => {
  try {
    const u = auth(q); const user: any = await User.findById(u.userId).select("name email role tenantId").lean();
    if (!user) return r.status(401).json({ message: "Sign in required" });
    r.json({ name: user.name, email: user.email, role: user.role });
  } catch (e) { n(e); }
});app.post("/api/auth/logout", (_q, r) => {
  r.clearCookie("access_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
  });
  r.status(204).end();
});
app.get("/api/public/restaurants/:slug/floors", async (q, r, n) => {
  try {
    const rest = await tenant(q.params.slug);
    const startsAt = typeof q.query.startsAt === "string" ? new Date(q.query.startsAt) : new Date();
    if (Number.isNaN(startsAt.getTime())) return r.status(400).json({ message: "Invalid reservation time" });
    const slotStart = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000);
    const slotEnd = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    const [floors, bookings] = await Promise.all([
      Table.find({ tenantId: rest._id }).select("number capacity floor section").sort({ floor: 1, number: 1 }).lean(),
      Reservation.find({ tenantId: rest._id, startsAt: mongoose.trusted({ $gt: slotStart, $lt: slotEnd }), status: mongoose.trusted({ $in: ["pending", "confirmed", "seated"] }) }).select("floor guestCount tableId tableIds tableAssignments").lean(),
    ]);
    const floorsByName = new Map<string, any[]>();
    for (const table of floors as any[]) floorsByName.set(table.floor, [...(floorsByName.get(table.floor) || []), table]);
    r.json([...floorsByName.entries()].map(([name, tables]) => {
      const floorBookings = (bookings as any[]).filter((booking) => booking.floor === name);
      const tableAvailability = tables.map((table) => {
        const bookedSeats = floorBookings.reduce((sum, booking) => sum + reservedSeatsOnTable(booking, table, tables), 0);
        return { id: String(table._id), number: table.number, capacity: table.capacity, section: table.section, bookedSeats, availableSeats: Math.max(0, table.capacity - bookedSeats) };
      });
      const seats = tables.reduce((sum, table) => sum + table.capacity, 0);
      const bookedSeats = tableAvailability.reduce((sum, table) => sum + table.bookedSeats, 0);
      return { name, tableCount: tables.length, seats, bookedSeats, availableSeats: Math.max(0, seats - bookedSeats), tables: tableAvailability };
    }));
  } catch (e) { n(e); }
});
app.get("/api/public/restaurants/:slug", async (q, r, n) => {
  try {
    const rest = await tenant(q.params.slug);
    // Copper Spoon's built-in preview dishes must be real tenant menu records so
    // their Mongo IDs can be validated when a customer checks out.
    if (rest.slug === "copper-spoon" && !(await MenuItem.exists({ tenantId: rest._id }))) {
      const catalog = [
        ["Starters", "Burrata & stone fruit", "Heirloom tomato, grilled peach, basil oil", 1850, "photo-1608039829572-78524f79c4c7", true],
        ["Starters", "Wood-fired sourdough", "Cultured butter, flaky salt, warm from oven", 680, "photo-1585478259715-876acc5be8eb", false],
        ["Mains", "Brown butter ravioli", "Ricotta, sage, toasted hazelnut", 2450, "photo-1551183053-bf91a1d81141", true],
        ["Mains", "Slow-roast chicken", "Lemon jus, crispy potatoes, garden herbs", 2850, "photo-1532550907401-a500c9a57435", false],
        ["Drinks", "House-made lemonade", "Meyer lemon, rosemary, sparkle", 620, "photo-1513558161293-cdaf765edfd7", false],
        ["Desserts", "Olive oil cake", "Whipped mascarpone, seasonal berries", 950, "photo-1578985545062-69928b1d9587", false],
      ] as const;
      const categoryIds = new Map<string, unknown>();
      for (const [sort, name] of ["Starters", "Mains", "Drinks", "Desserts"].entries()) {
        const category = await Category.findOneAndUpdate(
          { tenantId: rest._id, name },
          { $set: { tenantId: rest._id, name, nameUr: name, sort, active: true } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        categoryIds.set(name, category._id);
      }
      await MenuItem.insertMany(catalog.map(([category, name, description, price, image, popular]) => ({
        tenantId: rest._id,
        category: categoryIds.get(category),
        name,
        description,
        price,
        image: `https://images.unsplash.com/${image}?auto=format&fit=crop&w=900&q=85`,
        popular,
        available: true,
      })));
    }
    const [categories, items] = await Promise.all([
      Category.find({ tenantId: rest._id, active: true })
        .sort({ sort: 1 })
        .lean(),
      MenuItem.find({ tenantId: rest._id, available: true })
        .sort({ popular: -1, name: 1 })
        .lean(),
    ]);
    const categoryById = new Map(categories.map((entry: any) => [String(entry._id), entry]));
    r.json({ restaurant: rest, categories, items: items.map((item: any) => {
      const category = categoryById.get(String(item.category));
      return { ...item, categoryUr: category?.nameUr, category: category?.name ?? "Other" };
    }) });
  } catch (e) {
    n(e);
  }
});
app.get("/api/owner/restaurants/:slug/menu", async (q, r, n) => {
  try {
    const u = auth(q), rest = await tenant(q.params.slug); member(u, rest);
    const [categories, items] = await Promise.all([
      Category.find({ tenantId: rest._id }).sort({ sort: 1, name: 1 }).lean(),
      MenuItem.find({ tenantId: rest._id }).sort({ name: 1 }).lean(),
    ]);
    r.json({ categories, items });
  } catch (e) { n(e); }
});
app.post("/api/owner/restaurants/:slug/categories", async (q, r, n) => {
  try {
    const u = auth(q), rest = await tenant(q.params.slug); member(u, rest);
    const { value, error } = Joi.object({ name: Joi.string().trim().min(2).max(60).required(), nameUr: Joi.string().trim().max(60).allow("") }).validate(q.body);
    if (error) return r.status(400).json({ message: "Enter a category name" });
    if (await Category.exists({ tenantId: rest._id, name: value.name })) return r.status(409).json({ message: "That category already exists" });
    r.status(201).json(await Category.create({ ...value, tenantId: rest._id }));
  } catch (e) { n(e); }
});
app.post("/api/owner/restaurants/:slug/items", async (q, r, n) => {
  try {
    const u = auth(q), rest = await tenant(q.params.slug); member(u, rest);
    const { value, error } = Joi.object({ name: Joi.string().trim().min(2).max(120).required(), nameUr: Joi.string().trim().max(120).allow(""), description: Joi.string().max(500).allow(""), descriptionUr: Joi.string().max(500).allow(""), price: Joi.number().min(0).required(), category: Joi.string().hex().length(24).required(), image: Joi.string().uri().max(1000).allow("") }).validate(q.body);
    if (error) return r.status(400).json({ message: "Check the dish name, price, category, and image URL" });
    const category = await Category.findOne({ _id: value.category, tenantId: rest._id });
    if (!category) return r.status(400).json({ message: "Choose a category belonging to this restaurant" });
    r.status(201).json(await MenuItem.create({ ...value, tenantId: rest._id, available: true }));
  } catch (e) { n(e); }
});
app.patch("/api/owner/restaurants/:slug/items/:itemId", async (q, r, n) => {
  try {
    const u = auth(q), rest = await tenant(q.params.slug); member(u, rest);
    const { value, error } = Joi.object({ name: Joi.string().trim().min(2).max(120), nameUr: Joi.string().trim().max(120).allow(""), description: Joi.string().max(500).allow(""), descriptionUr: Joi.string().max(500).allow(""), price: Joi.number().min(0), category: Joi.string().hex().length(24), image: Joi.string().uri().max(1000).allow(""), available: Joi.boolean() }).min(1).validate(q.body);
    if (error) return r.status(400).json({ message: "Invalid menu item update" });
    if (value.category && !(await Category.exists({ _id: value.category, tenantId: rest._id }))) return r.status(400).json({ message: "Choose a category belonging to this restaurant" });
    const item = await MenuItem.findOneAndUpdate({ _id: q.params.itemId, tenantId: rest._id }, { $set: value }, { new: true, runValidators: true });
    if (!item) return r.status(404).json({ message: "Menu item not found" });
    r.json(item);
  } catch (e) { n(e); }
});
app.delete("/api/owner/restaurants/:slug/items/:itemId", async (q, r, n) => {
  try {
    const u = auth(q), rest = await tenant(q.params.slug); member(u, rest);
    const item = await MenuItem.findOneAndDelete({ _id: q.params.itemId, tenantId: rest._id });
    if (!item) return r.status(404).json({ message: "Menu item not found" });
    r.status(204).end();
  } catch (e) { n(e); }
});
app.post("/api/public/restaurants/:slug/orders", async (q, r, n) => {
  try {
    const rest = await tenant(q.params.slug);
    const { value, error } = Joi.object({
      items: Joi.array()
        .min(1)
        .items(
          Joi.object({
            menuItemId: Joi.string().required(),
            quantity: Joi.number().integer().min(1).max(30).required(),
          }),
        )
        .required(),
      type: Joi.string().valid("delivery", "pickup", "dine_in").required(),
      paymentMethod: Joi.string().valid("cash", "stripe", "jazzcash", "easypaisa").default("cash"),
      customer: Joi.object({
        name: Joi.string().max(120).required(),
        phone: Joi.string().max(30).required(),
        email: Joi.string().email().required(),
      }).required(),
      notes: Joi.string().max(500).allow(""),
    }).validate(q.body);
    if (error) return r.status(400).json({ message: "Check order details" });
    if (
      value.items.some(
        (x: { menuItemId: string }) => !mongoose.isValidObjectId(x.menuItemId),
      )
    )
      return r.status(400).json({ message: "Invalid menu item" });
    const ids = value.items.map((x: { menuItemId: string }) => x.menuItemId);
    const found = await MenuItem.find({
      tenantId: rest._id,
      _id: mongoose.trusted({ $in: ids }),
      available: true,
    }).lean();
    if (found.length !== new Set(ids.map(String)).size)
      return r.status(400).json({ message: "A menu item is unavailable" });
    const byId = new Map(found.map((x) => [String(x._id), x]));
    const items = value.items.map(
      (x: { menuItemId: string; quantity: number }) => {
        const item = byId.get(x.menuItemId)!;
        return {
          menuItemId: item._id,
          name: item.name,
          quantity: x.quantity,
          unitPrice: item.price,
        };
      },
    );
    const total = items.reduce(
      (sum: number, x: { quantity: number; unitPrice: number }) =>
        sum + x.quantity * x.unitPrice,
      0,
    );
    const order = await Order.create({
      tenantId: rest._id,
      customer: value.customer,
      items,
      total,
      type: value.type,
      paymentMethod: value.paymentMethod,
      notes: value.notes,
    });
    const safe = (input: unknown) => String(input ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
    const itemRows = items.map((item: any) => `<tr><td>${safe(item.name)}</td><td>${item.quantity}</td><td>PKR ${(item.unitPrice * item.quantity).toLocaleString()}</td></tr>`).join("");
    const orderEmail = `<div style="font-family:Arial,sans-serif;color:#26241f;max-width:620px;margin:auto;padding:28px;border:1px solid #e7e1d6"><p style="color:#a83b2d;letter-spacing:2px;font-size:12px;font-weight:bold">${safe(rest.name)} · ORDER RECEIVED</p><h1 style="font-family:Georgia,serif">Thanks, ${safe(value.customer.name)}!</h1><p>Your order <b>#${safe(order.id)}</b> has been received and is now <b>${safe(order.status)}</b>.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">Item</th><th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">Qty</th><th style="text-align:right;padding:10px;border-bottom:1px solid #ddd">Amount</th></tr></thead><tbody>${itemRows}</tbody></table><p style="text-align:right;font-size:20px"><b>Total: PKR ${total.toLocaleString()}</b></p><p>Order type: ${safe(value.type.replace(/_/g, " "))} · Payment: ${safe(value.paymentMethod)}</p><p style="color:#777">We will contact you if we need any details.</p></div>`;
    const owner = await User.findOne({ tenantId: rest._id, role: "owner", active: true }).select("email").lean();
    const orderRecipients = [...new Set([value.customer.email, owner?.email].filter((email): email is string => Boolean(email)))].join(",");
    void notify(
      orderRecipients,
      value.customer.phone,
      "Thank you " + value.customer.name + ". Order " + order.id + " received.",
      `${rest.name} · ${owner?.email === value.customer.email ? "Order received" : "New order received"}`,
      orderEmail,
    );
    publishTenantUpdate(rest._id, "orders");
    r.status(201).json({ id: order.id, status: order.status, total });
  } catch (e) {
    n(e);
  }
});
app.post("/api/public/restaurants/:slug/reservations", async (q, r, n) => {
  try {
    const rest = await tenant(q.params.slug);
    const { value, error } = Joi.object({
      name: Joi.string().min(2).max(120).required(),
      phone: Joi.string().min(7).max(30).required(),
      email: Joi.string().email().optional(),
      startsAt: Joi.date().greater("now").required(),
      guestCount: Joi.number().integer().min(1).max(30).required(),
      floor: Joi.string().trim().min(2).max(80).default("First Floor"),
      tableIds: Joi.array().items(Joi.string().hex().length(24)).unique().max(10).default([]),
      notes: Joi.string().max(500).allow(""),
    }).validate(q.body);
    if (error)
      return r.status(400).json({ message: "Check reservation details" });
    const floorTables = await Table.find({ tenantId: rest._id, floor: value.floor }).sort({ number: 1 }).lean();
    if (!floorTables.length) return r.status(409).json({ message: "This floor is not configured for reservations yet" });
    const bookingDate = new Date(value.startsAt);
    const slotStart = new Date(bookingDate.getTime() - 2 * 60 * 60 * 1000);
    const slotEnd = new Date(bookingDate.getTime() + 2 * 60 * 60 * 1000);
    const sameSlot = await Reservation.find({ tenantId: rest._id, floor: value.floor, startsAt: mongoose.trusted({ $gt: slotStart, $lt: slotEnd }), status: mongoose.trusted({ $in: ["pending", "confirmed", "seated"] }) }).select("guestCount tableId tableIds tableAssignments").lean();
    const availableByTable = new Map<string, number>();
    for (const table of floorTables as any[]) {
      const used = (sameSlot as any[]).reduce((sum, booking) => sum + reservedSeatsOnTable(booking, table, floorTables as any[]), 0);
      availableByTable.set(String(table._id), Math.max(0, table.capacity - used));
    }
    const selectedIds: string[] = value.tableIds.length ? value.tableIds : (floorTables as any[]).sort((a, b) => (availableByTable.get(String(b._id)) || 0) - (availableByTable.get(String(a._id)) || 0)).map((table) => String(table._id));
    if (selectedIds.some((id) => !availableByTable.has(id))) return r.status(400).json({ message: "One of the selected tables is not on this floor" });
    const tableAssignments: { tableId: any; seats: number }[] = [];
    let seatsRemaining = value.guestCount;
    for (const id of selectedIds) {
      if (seatsRemaining <= 0) break;
      const available = availableByTable.get(id) || 0;
      if (!available) continue;
      const seats = Math.min(available, seatsRemaining);
      tableAssignments.push({ tableId: new Types.ObjectId(id), seats });
      seatsRemaining -= seats;
    }
    if (seatsRemaining > 0) return r.status(409).json({ message: `The selected tables do not have ${value.guestCount} seats free at this time. Choose another table or floor.` });
    const booking = await Reservation.create({
      tenantId: rest._id,
      customer: { name: value.name, phone: value.phone, email: value.email },
      startsAt: value.startsAt,
      guestCount: value.guestCount,
      floor: value.floor,
      tableIds: tableAssignments.map((assignment) => assignment.tableId),
      tableAssignments,
      notes: value.notes,
    });
    void notify(
      value.email,
      value.phone,
      "Reservation request received for " +
        booking.startsAt.toLocaleString() +
        ". Confirmation pending.",
    );
    publishTenantUpdate(rest._id, "reservations");
    r.status(201).json({ id: booking.id, status: booking.status });
  } catch (e) {
    n(e);
  }
});
app.get("/api/owner/restaurants/:slug/orders", async (q, r, n) => {
  try {
    const u = auth(q),
      rest = await tenant(q.params.slug);
    member(u, rest);
    r.json(
      await Order.find({ tenantId: rest._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    );
  } catch (e) {
    n(e);
  }
});
app.patch(
  "/api/owner/restaurants/:slug/orders/:orderId/status",
  async (q, r, n) => {
    try {
      const u = auth(q),
        rest = await tenant(q.params.slug);
      member(u, rest);
      const status = Joi.string()
        .valid(
          "pending",
          "preparing",
          "ready",
          "out_for_delivery",
          "completed",
          "cancelled",
        )
        .validate(q.body.status);
      if (status.error)
        return r.status(400).json({ message: "Invalid order status" });
      const order = await Order.findOneAndUpdate(
        { _id: q.params.orderId, tenantId: rest._id },
        { status: status.value },
        { new: true },
      );
      if (!order) return r.status(404).json({ message: "Order not found" });
      publishTenantUpdate(rest._id, "orders");
      r.json(order);
    } catch (e) {
      n(e);
    }
  },
);
app.get("/api/owner/restaurants/:slug/reservations", async (q, r, n) => {
  try {
    const u = auth(q),
      rest = await tenant(q.params.slug);
    member(u, rest);
    r.json(
      await Reservation.find({ tenantId: rest._id })
        .sort({ startsAt: 1 })
        .limit(100)
        .lean(),
    );
  } catch (e) {
    n(e);
  }
});
app.get("/api/owner/restaurants/:slug/floor-summary", async (q, r, n) => {
  try {
    const u = auth(q), rest = await tenant(q.params.slug); member(u, rest);
    const dateText = typeof q.query.date === "string" ? q.query.date : new Date().toISOString().slice(0, 10);
    const timeText = typeof q.query.time === "string" ? q.query.time : "12:00";
    const slotCenter = new Date(`${dateText}T${timeText}:00`);
    if (Number.isNaN(slotCenter.getTime())) return r.status(400).json({ message: "Invalid date or time" });
    const slotStart = new Date(slotCenter.getTime() - 2 * 60 * 60 * 1000);
    const slotEnd = new Date(slotCenter.getTime() + 2 * 60 * 60 * 1000);
    const [floorRows, bookings, tableRows] = await Promise.all([
      Table.aggregate([{ $match: { tenantId: rest._id } }, { $group: { _id: "$floor", tableCount: { $sum: 1 }, seats: { $sum: "$capacity" } } }, { $sort: { _id: 1 } }]),
      Reservation.find({ tenantId: rest._id, startsAt: mongoose.trusted({ $gt: slotStart, $lt: slotEnd }), status: mongoose.trusted({ $in: ["pending", "confirmed", "seated"] }) }).select("floor guestCount tableId tableIds tableAssignments status").lean(),
      Table.find({ tenantId: rest._id }).select("number capacity floor section").sort({ floor: 1, number: 1 }).lean(),
    ]);
    r.json(floorRows.map((f: any) => {
      const floorBookings = bookings.filter((b: any) => b.floor === f._id);
      const bookedSeats = floorBookings.reduce((sum: number, b: any) => sum + b.guestCount, 0);
      const tables = tableRows.filter((table: any) => table.floor === f._id).map((table: any) => {
        const bookedAtTable = floorBookings.reduce((sum: number, booking: any) => sum + reservedSeatsOnTable(booking, table, tableRows as any[]), 0);
        const availableAtTable = Math.max(0, table.capacity - bookedAtTable);
        return { number: table.number, capacity: table.capacity, section: table.section, bookedSeats: bookedAtTable, availableSeats: availableAtTable, status: availableAtTable === 0 ? "full" : bookedAtTable > 0 ? "partial" : "available" };
      });
      const bookedTables = tables.filter((table: any) => table.availableSeats === 0).length;
      return { floor: f._id, tableCount: f.tableCount, seats: f.seats, bookings: floorBookings.length, bookedSeats, availableSeats: Math.max(f.seats - bookedSeats, 0), bookedTables, availableTables: tables.filter((table: any) => table.availableSeats > 0).length, tables };
    }));
  } catch (e) { n(e); }
});app.post("/api/owner/restaurants/:slug/tables", async (q, r, n) => {
  try {
    const u = auth(q), rest = await tenant(q.params.slug); member(u, rest);
    const { value, error } = Joi.object({ number: Joi.string().trim().min(1).max(30).required(), capacity: Joi.number().integer().min(1).max(30).required(), floor: Joi.string().trim().min(2).max(80).required(), section: Joi.string().trim().max(80).allow("") }).validate(q.body);
    if (error) return r.status(400).json({ message: "Enter a table number, capacity, and floor" });
    if (value.floor.toLowerCase() === "first floor") {
      const firstFloor = await Table.find({ tenantId: rest._id, floor: "First Floor" }).select("capacity").lean();
      const capacityTotal = firstFloor.reduce((sum: number, table: any) => sum + table.capacity, 0);
      if (firstFloor.length >= 5 || capacityTotal + value.capacity > 20) return r.status(409).json({ message: "First Floor is limited to 5 tables and 20 seats. Add this table to Second Floor instead." });
    }
    const table = await Table.create({ ...value, tenantId: rest._id }); r.status(201).json(table);
  } catch (e) { n(e); }
});
app.patch("/api/owner/restaurants/:slug/reservations/:reservationId/status", async (q, r, n) => {
  try {
    const u = auth(q), rest = await tenant(q.params.slug); member(u, rest);
    const { value, error } = Joi.object({
      status: Joi.string().valid("pending", "confirmed", "seated", "cancelled", "completed").required(),
      cancellationReason: Joi.string().valid("customer_cancelled", "no_show", "staff_cancelled").when("status", { is: "cancelled", then: Joi.required(), otherwise: Joi.optional() }),
    }).validate(q.body);
    if (error) return r.status(400).json({ message: "Choose a cancellation reason when cancelling a reservation" });
    const update = value.status === "cancelled" ? { $set: { status: value.status, cancellationReason: value.cancellationReason } } : { $set: { status: value.status }, $unset: { cancellationReason: 1 } };
    const booking = await Reservation.findOneAndUpdate({ _id: q.params.reservationId, tenantId: rest._id }, update, { new: true });
    if (!booking) return r.status(404).json({ message: "Reservation not found" });
    publishTenantUpdate(rest._id, "reservations");
    r.json(booking);
  } catch (e) { n(e); }
});
app.get("/api/owner/restaurants/:slug/analytics", async (q, r, n) => {
  try {
    const u = auth(q),
      rest = await tenant(q.params.slug);
    member(u, rest);
    const from = new Date(Date.now() - 30 * 86400000);
    const [stats] = await Order.aggregate([
      {
        $match: {
          tenantId: rest._id,
          createdAt: mongoose.trusted({ $gte: from }),
          status: mongoose.trusted({ $ne: "cancelled" }),
        },
      },
      {
        $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } },
      },
    ]);
    r.json(stats ?? { revenue: 0, orders: 0 });
  } catch (e) {
    n(e);
  }
});
app.post(
  "/api/owner/restaurants/:slug/orders/:orderId/checkout",
  async (q, r, n) => {
    try {
      const u = auth(q),
        rest = await tenant(q.params.slug);
      member(u, rest);
      const order = await Order.findOne({
        _id: q.params.orderId,
        tenantId: rest._id,
      });
      if (!order) return r.status(404).json({ message: "Order not found" });
      const provider = q.body.provider;
      if (provider === "jazzcash" || provider === "easypaisa")
        return r.status(202).json({
          status: "pending",
          message: "Merchant credentials and signed callback setup required",
        });
      if (provider !== "stripe" || !process.env.STRIPE_SECRET_KEY)
        return r.status(503).json({ message: "Payment provider unavailable" });
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: order.items.map(
          (x: { quantity: number; unitPrice: number; name: string }) => ({
            quantity: x.quantity,
            price_data: {
              currency: (rest.currency || "PKR").toLowerCase(),
              unit_amount: Math.round(x.unitPrice * 100),
              product_data: { name: x.name },
            },
          }),
        ),
        success_url:
          (process.env.CLIENT_ORIGIN || "http://localhost:5173") +
          "/?payment=return",
        cancel_url:
          (process.env.CLIENT_ORIGIN || "http://localhost:5173") +
          "/?payment=cancel",
        metadata: { tenantId: String(rest._id), orderId: order.id },
      });
      await Order.updateOne(
        { _id: order._id, tenantId: rest._id },
        { paymentStatus: "pending", paymentMethod: "stripe" },
      );
      r.json({ url: session.url, status: "pending" });
    } catch (e) {
      n(e);
    }
  },
);
app.post(
  "/api/public/restaurants/:slug/orders/:orderId/payments",
  async (q, r, n) => {
    try {
      const rest = await tenant(q.params.slug);
      const { value, error } = Joi.object({
        provider: Joi.string()
          .valid("stripe", "jazzcash", "easypaisa")
          .required(),
      }).validate(q.body);
      if (error)
        return r.status(400).json({ message: "Unsupported payment provider" });
      const order = await Order.findOne({
        _id: q.params.orderId,
        tenantId: rest._id,
        paymentStatus: "unpaid",
      });
      if (!order)
        return r.status(404).json({ message: "Unpaid order not found" });
      if (value.provider !== "stripe")
        return r.status(202).json({
          status: "pending",
          message:
            "Local gateway setup is pending merchant credentials and signed callbacks.",
        });
      if (!process.env.STRIPE_SECRET_KEY)
        return r.status(503).json({ message: "Stripe is not configured" });
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: order.items.map(
          (x: { quantity: number; unitPrice: number; name: string }) => ({
            quantity: x.quantity,
            price_data: {
              currency: (rest.currency || "PKR").toLowerCase(),
              unit_amount: Math.round(x.unitPrice * 100),
              product_data: { name: x.name },
            },
          }),
        ),
        success_url:
          (process.env.CLIENT_ORIGIN || "http://localhost:5173") +
          "/?payment=pending",
        cancel_url:
          (process.env.CLIENT_ORIGIN || "http://localhost:5173") +
          "/?payment=cancelled",
        metadata: { tenantId: String(rest._id), orderId: order.id },
      });
      await Order.updateOne(
        { _id: order._id, tenantId: rest._id },
        { paymentStatus: "pending", paymentMethod: "stripe" },
      );
      r.json({ status: "pending", url: session.url });
    } catch (e) {
      n(e);
    }
  },
);
app.use((_q, r) => r.status(404).json({ message: "Route not found" }));
app.use((e: unknown, _q: Request, r: Response, _n: NextFunction) => {
  const err = e as Error & { status?: number };
  if ((err.status ?? 500) >= 500) console.error(e);
  r.status(err.status ?? 500).json({
    message: err.status ? err.message : "Something went wrong",
  });
});
if (!process.env.MONGODB_URI) throw Error("MONGODB_URI is required");
mongoose.set("sanitizeFilter", true);
await mongoose.connect(process.env.MONGODB_URI, {
  autoIndex: process.env.NODE_ENV !== "production",
});
const defaultRestaurant: any = await Restaurant.findOne({ slug: "copper-spoon" }).select("_id").lean();
if (defaultRestaurant) {
  const firstFloorTables: any[] = await Table.find({ tenantId: defaultRestaurant._id, floor: "First Floor" }).sort({ number: 1 }).select("_id").lean();
  if (firstFloorTables.length > 5) {
    const overflowIds = firstFloorTables.slice(5).map((table: any) => table._id);
    await Reservation.updateMany(
      { tenantId: defaultRestaurant._id, status: mongoose.trusted({ $in: ["pending", "confirmed", "seated"] }), tableIds: mongoose.trusted({ $in: overflowIds }) },
      { $set: { floor: "Second Floor" } },
    );
    await Reservation.updateMany(
      { tenantId: defaultRestaurant._id, status: mongoose.trusted({ $in: ["pending", "confirmed", "seated"] }), tableId: mongoose.trusted({ $in: overflowIds }) },
      { $set: { floor: "Second Floor" } },
    );
    await Table.updateMany({ tenantId: defaultRestaurant._id, _id: mongoose.trusted({ $in: overflowIds }) }, { $set: { floor: "Second Floor" } });
    console.log("Moved extra Copper Spoon tables to Second Floor; First Floor is capped at five tables.");
  }
}
app.listen(Number(process.env.PORT ?? 4000), () =>
  console.log("Restaurant Smart API ready"),
);








