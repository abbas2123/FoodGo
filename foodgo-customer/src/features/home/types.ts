export interface DishItem {
  id: number;
  name: string;
  category: string;
  rating: string;
  reviews: string;
  price: string;
  image: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  emoji: string;
}
