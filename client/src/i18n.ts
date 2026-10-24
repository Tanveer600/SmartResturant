import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { menu: "Our menu", about: "Our story", reserve: "Reserve a table", start: "Start an order", all: "All dishes", starters: "Starters", mains: "Mains", drinks: "Drinks", desserts: "Desserts", add: "Add to order", basket: "Your order", empty: "Your basket is waiting", checkout: "Place order", language: "اردو", popular: "House favorites", fresh: "Seasonal · Local · Made with care", delivery: "Pickup · Dine in · Delivery", intro: "A neighborhood table for moments worth sharing.", heroSecond: "at our table.", favorite: "House favorite", search: "Search dishes", storyStart: "Good food is", storyEnd: "a kind of hello.", storyBody: "We cook with the seasons, buy from our neighbors, and make room at the table for everyone.", name: "Your name", phone: "Phone number", email: "Email for receipt (optional)", date: "Date", time: "Time", guests: "Guests", sendReservation: "Send reservation request" } },
    ur: { translation: { menu: "ہمارا مینیو", about: "ہماری کہانی", reserve: "میز بک کریں", start: "آرڈر شروع کریں", all: "تمام کھانے", starters: "ابتدائی پکوان", mains: "اہم پکوان", drinks: "مشروبات", desserts: "میٹھا", add: "آرڈر میں شامل کریں", basket: "آپ کا آرڈر", empty: "آپ کی ٹوکری خالی ہے", checkout: "آرڈر بھیجیں", language: "English", popular: "گھر کے پسندیدہ پکوان", fresh: "موسمی · مقامی · محبت سے تیار", delivery: "پک اپ · ریسٹورنٹ · ڈیلیوری", intro: "محلے کی میز، یادگار لمحات کے لیے۔", heroSecond: "ہماری میز پر۔", favorite: "خاص پسند", search: "کھانے تلاش کریں", storyStart: "اچھا کھانا", storyEnd: "محبت بھرا سلام ہے۔", storyBody: "ہم موسم کے مطابق کھانا بناتے ہیں، مقامی لوگوں سے خریدتے ہیں اور ہر ایک کے لیے میز پر جگہ رکھتے ہیں۔", name: "آپ کا نام", phone: "فون نمبر", email: "رسید کے لیے ای میل (اختیاری)", date: "تاریخ", time: "وقت", guests: "مہمان", sendReservation: "میز کی درخواست بھیجیں" } },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});
export default i18n;
