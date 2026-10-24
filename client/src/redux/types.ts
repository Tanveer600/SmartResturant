export type Item = {
  _id: string;
  name: string;
  nameUr?: string;
  description: string;
  descriptionUr?: string;
  category: string;
  categoryUr?: string;
  price: number;
  image: string;
  popular?: boolean;
};
export type Line = { item: Item; quantity: number };


