/**
 * Mock order data.
 *
 * This module acts as the data-access layer for orders until the
 * backend orders module is implemented. Replace `getOrderById` /
 * `getAllOrders` with real API calls once the backend is ready.
 */

import type { Order } from "@/types/order.types";

export const MOCK_ORDERS: Order[] = [
  // ─── Active order ────────────────────────────────────────────────────────────
  {
    id: "FG10284",
    orderNumber: "FG10284",
    status: "OUT_FOR_DELIVERY",
    statusLabel: "On the way",
    eta: "10–15 min",
    restaurant: {
      id: "r1",
      name: "The Burger Joint",
      cuisine: "American, Fast Food",
      rating: 4.8,
      distanceKm: 2.4,
      imageUrl:
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&q=80",
      location: {
        latitude: 12.9719,
        longitude: 77.6412,
      },
    },
    items: [
      {
        id: "i1",
        name: "Classic Smash Burger",
        quantity: 1,
        price: 249,
        customisation: "Regular, Extra Cheese, Extra Sauce",
      },
    ],
    bill: {
      subtotal: 249,
      deliveryFee: 29,
      taxes: 18,
      discount: 50,
      grandTotal: 246,
      currencySymbol: "₹",
    },
    deliveryAddress: {
      label: "Home",
      line1: "A-402, Sunset Heights Apartments, MG Road, Bangalore",
      location: {
        latitude: 12.9756,
        longitude: 77.6192,
      },
    },
    payment: {
      method: "UPI (Google Pay)",
      isPaid: true,
    },
    tracking: {
      restaurantLocation: {
        latitude: 12.9719,
        longitude: 77.6412,
      },
      customerLocation: {
        latitude: 12.9756,
        longitude: 77.6192,
      },
      deliveryPartnerLocation: {
        latitude: 12.9728,
        longitude: 77.6335,
      },
      deliveryPartnerHeading: 285,
      estimatedArrival: "10–15 min",
      distanceRemainingMeters: 1800,
      deliveryPartner: {
        id: "dp-101",
        name: "Ravi Kumar",
        phone: "+919876543210",
        rating: 4.8,
        totalDeliveries: 1243,
        avatarUrl:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80",
      },
    },
  },

  // ─── Completed order ─────────────────────────────────────────────────────────
  {
    id: "FG10283",
    orderNumber: "FG10283",
    status: "DELIVERED",
    statusLabel: "Delivered",
    completedAt: "2026-08-28T20:42:00.000Z",
    restaurant: {
      id: "r1",
      name: "The Burger Joint",
      cuisine: "American, Fast Food",
      rating: 4.8,
      distanceKm: 2.4,
      imageUrl:
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&q=80",
      location: {
        latitude: 12.9719,
        longitude: 77.6412,
      },
    },
    items: [
      {
        id: "i2",
        name: "Classic Smash Burger",
        quantity: 1,
        price: 1250,
        customisation: undefined,
      },
      {
        id: "i3",
        name: "French Fries",
        quantity: 1,
        price: 450,
        customisation: undefined,
      },
    ],
    bill: {
      subtotal: 1700,
      deliveryFee: 299,
      taxes: 185,
      discount: 0,
      grandTotal: 2184,
      currencySymbol: "$",
    },
    deliveryAddress: {
      label: "Home",
      line1: "A-402, Sunset Heights Apartments, MG Road, Bangalore",
      location: {
        latitude: 12.9756,
        longitude: 77.6192,
      },
    },
    payment: {
      method: "Credit Card",
      isPaid: true,
    },
    userRating: null,
    userComment: "",
  },

  // ─── Cancelled order ─────────────────────────────────────────────────────────
  {
    id: "FG10190",
    orderNumber: "FG10190",
    status: "CANCELLED",
    statusLabel: "Cancelled",
    completedAt: "2026-10-05T14:30:00.000Z",
    restaurant: {
      id: "r2",
      name: "Pizza Roma",
      cuisine: "Italian, Pizza",
      rating: 4.2,
      distanceKm: 3.1,
      imageUrl: undefined,
      location: {
        latitude: 12.9698,
        longitude: 77.6015,
      },
    },
    items: [
      {
        id: "i4",
        name: "Farmhouse Special Pizza",
        quantity: 1,
        price: 380,
        customisation: undefined,
      },
    ],
    bill: {
      subtotal: 380,
      deliveryFee: 30,
      taxes: 20,
      discount: 0,
      grandTotal: 430,
      currencySymbol: "₹",
    },
    deliveryAddress: {
      label: "Home",
      line1: "A-402, Sunset Heights Apartments, MG Road, Bangalore",
      location: {
        latitude: 12.9756,
        longitude: 77.6192,
      },
    },
    payment: {
      method: "UPI",
      isPaid: false,
    },
  },
];

/** Fetch a single order by id (mock). */
export function getOrderById(id: string): Order | undefined {
  return MOCK_ORDERS.find((o) => o.id === id);
}

/** Fetch all orders (mock). */
export function getAllOrders(): Order[] {
  return MOCK_ORDERS;
}
