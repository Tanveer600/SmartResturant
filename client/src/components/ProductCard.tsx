import { Check, Plus } from "lucide-react";
import type { Item } from "../redux/types";

type ProductCardProps = {
  item: Item;
  language: "en" | "ur";
  quantity: number;
  onAdd: (item: Item) => void;
};

export default function ProductCard({ item, language, quantity, onAdd }: ProductCardProps) {
  const name = language === "ur" && item.nameUr ? item.nameUr : item.name;
  const description = language === "ur" && item.descriptionUr ? item.descriptionUr : item.description;

  return (
    <article className="product-card">
      <div className="product-image">
        <img src={item.image} alt={name} loading="lazy" />
        {item.popular && <span className="product-badge">Guest favorite</span>}
        <button className={`add-product ${quantity ? "is-added" : ""}`} onClick={() => onAdd(item)} aria-label={`Add ${name} to order`}>
          {quantity ? <Check size={17} /> : <Plus size={18} />}
          <span>{quantity ? `Add another · ${quantity} in order` : "Add to order"}</span>
        </button>
      </div>
      <div className="product-copy">
        <div className="product-meta"><span>{item.category}</span><span>PKR {item.price.toLocaleString()}</span></div>
        <h3 lang={language}>{name}</h3>
        <p lang={language}>{description}</p>
      </div>
    </article>
  );
}
