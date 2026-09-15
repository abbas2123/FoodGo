import { RestaurantData } from "../types";

export const RESTAURANT_DATA: Record<string, RestaurantData> = {
  "1": {
    id: "1",
    name: "The Burger House",
    cuisine: "American • Burgers • Fast Food",
    rating: 4.8,
    reviewCount: "1.2k+",
    deliveryTime: "15-25 min",
    deliveryFee: "Free",
    image:
      "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80",
    isOpen: true,
    offer: "Get 20% off on orders above ₹300",
    menu: [
      {
        id: "m1",
        name: "Double Cheese Whopper",
        description:
          "Two flame-grilled beef patties, cheddar cheese, lettuce, tomato, pickles",
        price: 12.5,
        image:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80",
        rating: 4.9,
        isVeg: false,
        category: "Recommended",
        isBestseller: true,
      },
      {
        id: "m2",
        name: "Crispy Chicken Deluxe",
        description:
          "Crispy fried chicken breast, pickles, and mayo on a toasted bun",
        price: 10.99,
        image:
          "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=300&q=80",
        rating: 4.7,
        isVeg: false,
        category: "Recommended",
      },
      {
        id: "m3",
        name: "Classic Smash Burger",
        description:
          "Smashed beef patty, American cheese, caramelized onions, secret sauce",
        price: 9.99,
        image:
          "https://images.unsplash.com/photo-1550547660-d9450f859349?w=300&q=80",
        rating: 4.8,
        isVeg: false,
        category: "Popular",
        isBestseller: true,
      },
      {
        id: "m4",
        name: "Veggie Supreme Burger",
        description:
          "Plant-based patty, avocado, grilled peppers, and fresh greens",
        price: 8.99,
        image:
          "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=300&q=80",
        rating: 4.5,
        isVeg: true,
        category: "Popular",
      },
      {
        id: "m5",
        name: "BBQ Bacon Stack",
        description: "Triple beef patties, crispy bacon, BBQ sauce, jalapeños",
        price: 14.99,
        image:
          "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=300&q=80",
        rating: 4.6,
        isVeg: false,
        category: "Burgers",
        isBestseller: true,
      },
      {
        id: "m6",
        name: "Mushroom Swiss Burger",
        description:
          "Beef patty topped with sautéed mushrooms and melted Swiss cheese",
        price: 11.5,
        image:
          "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=300&q=80",
        rating: 4.4,
        isVeg: false,
        category: "Burgers",
      },
    ],
  },
  "2": {
    id: "2",
    name: "Spice Garden",
    cuisine: "Indian • Curry • Biryani",
    rating: 4.6,
    reviewCount: "980+",
    deliveryTime: "20-30 min",
    deliveryFee: "$1.99",
    image:
      "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
    isOpen: true,
    offer: "Free delivery on orders above ₹500",
    menu: [
      {
        id: "s1",
        name: "Chicken Biryani",
        description:
          "Aromatic basmati rice cooked with tender chicken and exotic spices",
        price: 13.99,
        image:
          "https://images.unsplash.com/photo-1563379091339-03246963d96a?w=300&q=80",
        rating: 4.9,
        isVeg: false,
        category: "Recommended",
        isBestseller: true,
      },
      {
        id: "s2",
        name: "Paneer Butter Masala",
        description: "Soft paneer cubes in a rich, creamy tomato-based curry",
        price: 11.5,
        image:
          "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&q=80",
        rating: 4.7,
        isVeg: true,
        category: "Recommended",
      },
    ],
  },
  "3": {
    id: "3",
    name: "Sakura Sushi",
    cuisine: "Japanese • Sushi • Asian",
    rating: 4.9,
    reviewCount: "2.3k+",
    deliveryTime: "25-35 min",
    deliveryFee: "Free",
    image:
      "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=800&q=80",
    isOpen: true,
    offer: "Buy 2 rolls, get 1 free today!",
    menu: [
      {
        id: "j1",
        name: "Dragon Roll",
        description:
          "Shrimp tempura, cucumber, avocado, topped with tuna and tobiko",
        price: 16.5,
        image:
          "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=300&q=80",
        rating: 4.9,
        isVeg: false,
        category: "Recommended",
        isBestseller: true,
      },
      {
        id: "j2",
        name: "Salmon Nigiri (6 pcs)",
        description: "Fresh Atlantic salmon over seasoned sushi rice",
        price: 14.0,
        image:
          "https://images.unsplash.com/photo-1540648639573-8c848de23f0a?w=300&q=80",
        rating: 4.8,
        isVeg: false,
        category: "Recommended",
      },
    ],
  },
  "4": {
    id: "4",
    name: "Pizza Perfecto",
    cuisine: "Italian • Pizza • Pasta",
    rating: 4.7,
    reviewCount: "1.5k+",
    deliveryTime: "20-30 min",
    deliveryFee: "$0.99",
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
    isOpen: true,
    offer: "Large pizza at medium price — today only!",
    menu: [
      {
        id: "p1",
        name: "Margherita Classic",
        description:
          "San Marzano tomato sauce, fresh mozzarella, basil, extra virgin olive oil",
        price: 11.99,
        image:
          "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=300&q=80",
        rating: 4.8,
        isVeg: true,
        category: "Recommended",
        isBestseller: true,
      },
      {
        id: "p2",
        name: "Pepperoni Feast",
        description:
          "Loaded with premium pepperoni, mozzarella, and tomato sauce",
        price: 14.99,
        image:
          "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=300&q=80",
        rating: 4.7,
        isVeg: false,
        category: "Recommended",
      },
    ],
  },
};
