import mongoose, { Schema } from "mongoose";
const base = { timestamps: true, strict: "throw" as const };
const tenant = { type: Schema.Types.ObjectId, required: true, index: true };
const restaurantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^[a-z0-9-]+$/,
    },
    description: String,
    phone: String,
    email: String,
    address: String,
    currency: { type: String, default: "PKR" },
    timezone: { type: String, default: "Asia/Karachi" },
    active: { type: Boolean, default: true },
  },
  base,
);
const categorySchema = new Schema(
  {
    tenantId: tenant,
    name: { type: String, required: true },
    nameUr: String,
    sort: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  base,
);
categorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
const itemSchema = new Schema(
  {
    tenantId: tenant,
    name: { type: String, required: true, trim: true },
    nameUr: String,
    description: String,
    descriptionUr: String,
    price: { type: Number, min: 0, required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    image: String,
    available: { type: Boolean, default: true },
    popular: Boolean,
    options: [Schema.Types.Mixed],
  },
  base,
);
itemSchema.index({ tenantId: 1, category: 1, available: 1 });
const userSchema = new Schema(
  {
    tenantId: { ...tenant, required: false, default: null },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["super_admin", "owner", "kitchen", "customer"],
      default: "customer",
    },
    active: { type: Boolean, default: true },
  },
  base,
);
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
const tableSchema = new Schema(
  {
    tenantId: tenant,
    number: { type: String, required: true },
    capacity: { type: Number, min: 1, required: true },
    status: {
      type: String,
      enum: ["available", "reserved", "occupied"],
      default: "available",
    },
    section: String,
    floor: { type: String, required: true, default: "First Floor", trim: true },
  },
  base,
);
tableSchema.index({ tenantId: 1, number: 1 }, { unique: true });
const orderSchema = new Schema(
  {
    tenantId: tenant,
    customer: { name: String, phone: String, email: String },
    items: [
      {
        menuItemId: Schema.Types.ObjectId,
        name: String,
        quantity: { type: Number, min: 1 },
        unitPrice: { type: Number, min: 0 },
      },
    ],
    type: {
      type: String,
      enum: ["delivery", "pickup", "dine_in"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "preparing",
        "ready",
        "out_for_delivery",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed"],
      default: "unpaid",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "stripe", "jazzcash", "easypaisa"],
      default: "cash",
    },
    total: { type: Number, min: 0, required: true },
    notes: { type: String, maxlength: 500 },
  },
  base,
);
orderSchema.index({ tenantId: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, status: 1, createdAt: 1 });
const reservationSchema = new Schema(
  {
    tenantId: tenant,
    customer: { name: String, phone: String, email: String },
    tableId: { type: Schema.Types.ObjectId, ref: "Table" },
    tableIds: [{ type: Schema.Types.ObjectId, ref: "Table" }],
    tableAssignments: [{
      tableId: { type: Schema.Types.ObjectId, ref: "Table", required: true },
      seats: { type: Number, min: 1, required: true },
    }],
    floor: { type: String, required: true, default: "First Floor", trim: true },
    startsAt: { type: Date, required: true },
    guestCount: { type: Number, min: 1, max: 30, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "seated", "cancelled", "completed"],
      default: "pending",
    },
    cancellationReason: { type: String, enum: ["customer_cancelled", "no_show", "staff_cancelled"] },
    notes: String,
  },
  base,
);
reservationSchema.index({ tenantId: 1, startsAt: 1, status: 1 });
export const Restaurant =
  mongoose.models.Restaurant ?? mongoose.model("Restaurant", restaurantSchema);
export const Category =
  mongoose.models.Category ?? mongoose.model("Category", categorySchema);
export const MenuItem =
  mongoose.models.MenuItem ?? mongoose.model("MenuItem", itemSchema);
export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
export const Table =
  mongoose.models.Table ?? mongoose.model("Table", tableSchema);
export const Order =
  mongoose.models.Order ?? mongoose.model("Order", orderSchema);
export const Reservation =
  mongoose.models.Reservation ??
  mongoose.model("Reservation", reservationSchema);
