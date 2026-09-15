import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding FoodiGo database...\n');

  // ─── Categories ────────────────────────────────────────────────────────────
  console.log('📦 Seeding categories...');
  const categories = [
    { name: 'Pizza', emoji: '🍕', sortOrder: 1 },
    { name: 'Burgers', emoji: '🍔', sortOrder: 2 },
    { name: 'Asian', emoji: '🍜', sortOrder: 3 },
    { name: 'Desserts', emoji: '🍰', sortOrder: 4 },
    { name: 'Drinks', emoji: '🥤', sortOrder: 5 },
    { name: 'Indian', emoji: '🍛', sortOrder: 6 },
    { name: 'Sushi', emoji: '🍣', sortOrder: 7 },
    { name: 'Pasta', emoji: '🍝', sortOrder: 8 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log(`  ✅ ${categories.length} categories seeded`);

  // ─── Restaurants ───────────────────────────────────────────────────────────
  console.log('\n🏪 Seeding restaurants...');

  const burgerHouse = await prisma.restaurant.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'The Burger House',
      cuisineTypes: 'American • Burgers • Fast Food',
      rating: 4.8,
      reviewCount: '1.2k+',
      deliveryTimeMin: 15,
      deliveryTimeMax: 25,
      deliveryFee: 0,
      isFreeDelivery: true,
      imageUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80',
      isOpen: true,
      offerText: 'Get 20% off on orders above ₹300',
      latitude: 12.9716,
      longitude: 77.5946,
    },
  });

  const spiceGarden = await prisma.restaurant.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: 'Spice Garden',
      cuisineTypes: 'Indian • Curry • Biryani',
      rating: 4.6,
      reviewCount: '980+',
      deliveryTimeMin: 20,
      deliveryTimeMax: 30,
      deliveryFee: 1.99,
      isFreeDelivery: false,
      imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
      isOpen: true,
      offerText: 'Free delivery on orders above ₹500',
      latitude: 12.9725,
      longitude: 77.5959,
    },
  });

  const sakuraSushi = await prisma.restaurant.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      name: 'Sakura Sushi',
      cuisineTypes: 'Japanese • Sushi • Asian',
      rating: 4.9,
      reviewCount: '2.3k+',
      deliveryTimeMin: 25,
      deliveryTimeMax: 35,
      deliveryFee: 0,
      isFreeDelivery: true,
      imageUrl: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=800&q=80',
      isOpen: true,
      offerText: 'Buy 2 rolls, get 1 free today!',
      latitude: 12.9698,
      longitude: 77.5985,
    },
  });

  const pizzaPerfecto = await prisma.restaurant.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      name: 'Pizza Perfecto',
      cuisineTypes: 'Italian • Pizza • Pasta',
      rating: 4.7,
      reviewCount: '1.5k+',
      deliveryTimeMin: 20,
      deliveryTimeMax: 30,
      deliveryFee: 0.99,
      isFreeDelivery: false,
      imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
      isOpen: true,
      offerText: 'Large pizza at medium price — today only!',
      latitude: 12.9740,
      longitude: 77.5960,
    },
  });

  console.log('  ✅ 4 restaurants seeded');

  // ─── Menu Items ────────────────────────────────────────────────────────────
  console.log('\n🍽️  Seeding menu items...');

  // Burger House Menu
  const burgerMenuItems = [
    {
      restaurantId: burgerHouse.id,
      categoryName: 'Recommended',
      name: 'Double Cheese Whopper',
      description: 'Two flame-grilled beef patties, cheddar cheese, lettuce, tomato, pickles',
      price: 249.0,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80',
      rating: 4.9,
      isVeg: false,
      isBestseller: true,
    },
    {
      restaurantId: burgerHouse.id,
      categoryName: 'Recommended',
      name: 'Crispy Chicken Deluxe',
      description: 'Crispy fried chicken breast, pickles, and mayo on a toasted bun',
      price: 199.0,
      imageUrl: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=300&q=80',
      rating: 4.7,
      isVeg: false,
      isBestseller: false,
    },
    {
      restaurantId: burgerHouse.id,
      categoryName: 'Popular',
      name: 'Classic Smash Burger',
      description: 'Smashed beef patty, American cheese, caramelized onions, secret sauce',
      price: 189.0,
      imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=300&q=80',
      rating: 4.8,
      isVeg: false,
      isBestseller: true,
    },
    {
      restaurantId: burgerHouse.id,
      categoryName: 'Popular',
      name: 'Veggie Supreme Burger',
      description: 'Plant-based patty, avocado, grilled peppers, and fresh greens',
      price: 169.0,
      imageUrl: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=300&q=80',
      rating: 4.5,
      isVeg: true,
      isBestseller: false,
    },
    {
      restaurantId: burgerHouse.id,
      categoryName: 'Burgers',
      name: 'BBQ Bacon Stack',
      description: 'Triple beef patties, crispy bacon, BBQ sauce, jalapeños',
      price: 299.0,
      imageUrl: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=300&q=80',
      rating: 4.6,
      isVeg: false,
      isBestseller: true,
    },
    {
      restaurantId: burgerHouse.id,
      categoryName: 'Burgers',
      name: 'Mushroom Swiss Burger',
      description: 'Beef patty topped with sautéed mushrooms and melted Swiss cheese',
      price: 219.0,
      imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=300&q=80',
      rating: 4.4,
      isVeg: false,
      isBestseller: false,
    },
  ];

  // Spice Garden Menu
  const spiceMenuItems = [
    {
      restaurantId: spiceGarden.id,
      categoryName: 'Recommended',
      name: 'Chicken Biryani',
      description: 'Aromatic basmati rice cooked with tender chicken and exotic spices',
      price: 279.0,
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03246963d96a?w=300&q=80',
      rating: 4.9,
      isVeg: false,
      isBestseller: true,
    },
    {
      restaurantId: spiceGarden.id,
      categoryName: 'Recommended',
      name: 'Paneer Butter Masala',
      description: 'Soft paneer cubes in a rich, creamy tomato-based curry',
      price: 219.0,
      imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&q=80',
      rating: 4.7,
      isVeg: true,
      isBestseller: false,
    },
    {
      restaurantId: spiceGarden.id,
      categoryName: 'Curries',
      name: 'Dal Makhani',
      description: 'Slow-cooked black lentils in a rich buttery tomato gravy',
      price: 179.0,
      imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&q=80',
      rating: 4.6,
      isVeg: true,
      isBestseller: false,
    },
    {
      restaurantId: spiceGarden.id,
      categoryName: 'Curries',
      name: 'Butter Chicken',
      description: 'Tender chicken pieces in a velvety tomato-cream sauce',
      price: 259.0,
      imageUrl: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=300&q=80',
      rating: 4.8,
      isVeg: false,
      isBestseller: true,
    },
  ];

  // Sakura Sushi Menu
  const sushiMenuItems = [
    {
      restaurantId: sakuraSushi.id,
      categoryName: 'Recommended',
      name: 'Dragon Roll',
      description: 'Shrimp tempura, cucumber, avocado, topped with tuna and tobiko',
      price: 329.0,
      imageUrl: 'https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=300&q=80',
      rating: 4.9,
      isVeg: false,
      isBestseller: true,
    },
    {
      restaurantId: sakuraSushi.id,
      categoryName: 'Recommended',
      name: 'Salmon Nigiri (6 pcs)',
      description: 'Fresh Atlantic salmon over seasoned sushi rice',
      price: 279.0,
      imageUrl: 'https://images.unsplash.com/photo-1540648639573-8c848de23f0a?w=300&q=80',
      rating: 4.8,
      isVeg: false,
      isBestseller: false,
    },
    {
      restaurantId: sakuraSushi.id,
      categoryName: 'Rolls',
      name: 'Rainbow Roll',
      description: 'California roll topped with assorted sashimi and avocado',
      price: 349.0,
      imageUrl: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=300&q=80',
      rating: 4.9,
      isVeg: false,
      isBestseller: true,
    },
  ];

  // Pizza Perfecto Menu
  const pizzaMenuItems = [
    {
      restaurantId: pizzaPerfecto.id,
      categoryName: 'Recommended',
      name: 'Margherita Classic',
      description: 'San Marzano tomato sauce, fresh mozzarella, basil, extra virgin olive oil',
      price: 239.0,
      imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=300&q=80',
      rating: 4.8,
      isVeg: true,
      isBestseller: true,
    },
    {
      restaurantId: pizzaPerfecto.id,
      categoryName: 'Recommended',
      name: 'Pepperoni Feast',
      description: 'Loaded with premium pepperoni, mozzarella, and tomato sauce',
      price: 299.0,
      imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=300&q=80',
      rating: 4.7,
      isVeg: false,
      isBestseller: false,
    },
    {
      restaurantId: pizzaPerfecto.id,
      categoryName: 'Specialty',
      name: 'BBQ Chicken Pizza',
      description: 'Grilled chicken, BBQ sauce, red onions, cheddar and mozzarella',
      price: 319.0,
      imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&q=80',
      rating: 4.6,
      isVeg: false,
      isBestseller: true,
    },
    {
      restaurantId: pizzaPerfecto.id,
      categoryName: 'Pasta',
      name: 'Penne Arrabbiata',
      description: 'Penne pasta in a spicy tomato sauce with garlic and fresh herbs',
      price: 199.0,
      imageUrl: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=300&q=80',
      rating: 4.5,
      isVeg: true,
      isBestseller: false,
    },
  ];

  // Clear existing menu items (safe — restaurant IDs are known)
  await prisma.menuItem.deleteMany({
    where: { restaurantId: { in: [1, 2, 3, 4] } },
  });

  const allMenuItems = [
    ...burgerMenuItems,
    ...spiceMenuItems,
    ...sushiMenuItems,
    ...pizzaMenuItems,
  ];

  await prisma.menuItem.createMany({ data: allMenuItems });
  console.log(`  ✅ ${allMenuItems.length} menu items seeded`);

  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
