import "dotenv/config";
import mongoose from "mongoose";
import { Restaurant, Category, MenuItem } from "./models.js";
const uri = process.env.MONGODB_URI;
if (!uri) throw Error("MONGODB_URI is required");
await mongoose.connect(uri);
const restaurant = await Restaurant.findOneAndUpdate(
  { slug: "copper-spoon" },
  {
    $set: {
      name: "Copper Spoon",
      slug: "copper-spoon",
      description: "Seasonal plates and warm hospitality in Lahore.",
      currency: "PKR",
      phone: "+923001234567",
      email: "hello@copperspoon.pk",
      address: "Gulberg III, Lahore",
      active: true,
    },
  },
  { upsert: true, new: true, setDefaultsOnInsert: true },
);
const groups = ["Starters", "Mains", "Drinks", "Desserts"];
const cats = new Map<string, string>();
for (const [i, name] of groups.entries()) {
  const c = await Category.findOneAndUpdate(
    { tenantId: restaurant._id, name },
    {
      $set: {
        tenantId: restaurant._id,
        name,
        nameUr: name,
        sort: i,
        active: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  cats.set(name, c.id);
}
const urNames: Record<string, string> = {
  "Burrata & stone fruit": "برراٹا اور موسمی پھل",
  "Wood-fired sourdough": "تندور کی گرم روٹی",
  "Brown butter ravioli": "مکھن والی راویولی",
  "Slow-roast chicken": "آہستہ بھنا مرغ",
  "House-made lemonade": "گھر کا لیمونیڈ",
  "Olive oil cake": "زیتون کے تیل کا کیک",
};
const urDescriptions: Record<string, string> = {
  "Burrata & stone fruit": "دیسی ٹماٹر، آڑو، تلسی کا تیل",
  "Wood-fired sourdough": "کلچرڈ مکھن اور سمندری نمک",
  "Brown butter ravioli": "ریکوٹا، سیج اور بھنے ہیزل نٹ",
  "Slow-roast chicken": "لیموں، خستہ آلو اور تازہ جڑی بوٹیاں",
  "House-made lemonade": "لیموں، روزمیری اور ہلکی سی چمک",
  "Olive oil cake": "مسکارپونے اور موسمی بیریز",
};
const data = [
  [
    "Burrata & stone fruit",
    "Heirloom tomato, grilled peach, basil oil",
    "Starters",
    1850,
    "photo-1608039829572-78524f79c4c7",
    true,
  ],
  [
    "Wood-fired sourdough",
    "Cultured butter, flaky salt, warm from oven",
    "Starters",
    680,
    "photo-1585478259715-876acc5be8eb",
    false,
  ],
  [
    "Brown butter ravioli",
    "Ricotta, sage, toasted hazelnut",
    "Mains",
    2450,
    "photo-1551183053-bf91a1d81141",
    true,
  ],
  [
    "Slow-roast chicken",
    "Lemon jus, crispy potatoes, garden herbs",
    "Mains",
    2850,
    "photo-1532550907401-a500c9a57435",
    false,
  ],
  [
    "House-made lemonade",
    "Meyer lemon, rosemary, sparkle",
    "Drinks",
    620,
    "photo-1513558161293-cdaf765edfd7",
    false,
  ],
  [
    "Olive oil cake",
    "Whipped mascarpone, seasonal berries",
    "Desserts",
    950,
    "photo-1578985545062-69928b1d9587",
    false,
  ],
] as const;
for (const [name, description, category, price, image, popular] of data)
  await MenuItem.findOneAndUpdate(
    { tenantId: restaurant._id, name },
    {
      $set: {
        tenantId: restaurant._id,
        name,
        nameUr: urNames[name],
        description,
        descriptionUr: urDescriptions[name],
        category: cats.get(category),
        price,
        image:
          "https://images.unsplash.com/" +
          image +
          "?auto=format&fit=crop&w=700&q=80",
        popular,
        available: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
console.log("Seeded Copper Spoon demo restaurant.");
await mongoose.disconnect();
