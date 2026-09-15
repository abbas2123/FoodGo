export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  rating: number;
  isVeg: boolean;
  category: string;
  isBestseller?: boolean;
}

export interface RestaurantData {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviewCount: string;
  deliveryTime: string;
  deliveryFee: string;
  image: string;
  isOpen: boolean;
  offer?: string;
  menu: MenuItem[];
}
