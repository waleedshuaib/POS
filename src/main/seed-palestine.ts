/**
 * Rich initial dataset for a Palestinian supermarket.
 *
 * Populates:
 *   - store settings (name, address, tax id, ILS currency, 17% VAT)
 *   - 3 users (admin + manager + cashiers) with Arabic names
 *   - 14 product categories (bilingual)
 *   - ~90 products covering every aisle of a West Bank / Palestinian market,
 *     with realistic barcodes, SKUs, costs, prices, tax rates, units
 *   - 5 suppliers (well-known Palestinian distributors)
 *   - 6 customers (mix of walk-ins, regulars with credit, and a business)
 *   - starting inventory for every product
 *
 * Runs only when the DB is empty (no existing users). Safe to call repeatedly —
 * it's idempotent against an already-seeded DB.
 */

import { db, schema } from './db/client';
import { hashPassword } from './auth/password';

interface CatRow {
  key: string;
  nameAr: string;
  nameEn: string;
}
interface ProductRow {
  sku: string;
  barcode: string;
  cat: string;
  nameAr: string;
  nameEn: string;
  cost: number;
  price: number;
  tax: number;
  unit: 'pc' | 'kg' | 'g' | 'l' | 'ml' | 'm';
  stock: number;
  low: number;
}

const CATEGORIES: CatRow[] = [
  { key: 'food', nameAr: 'المواد الغذائية', nameEn: 'Groceries' },
  { key: 'oil', nameAr: 'زيوت', nameEn: 'Oils' },
  { key: 'dairy', nameAr: 'ألبان وأجبان', nameEn: 'Dairy & Cheese' },
  { key: 'meat', nameAr: 'لحوم ودواجن', nameEn: 'Meat & Poultry' },
  { key: 'vegfruit', nameAr: 'خضروات وفواكه', nameEn: 'Vegetables & Fruits' },
  { key: 'bakery', nameAr: 'مخبوزات وحلويات شرقية', nameEn: 'Bakery & Oriental Sweets' },
  { key: 'canned', nameAr: 'معلبات', nameEn: 'Canned Goods' },
  { key: 'snacks', nameAr: 'حلويات وسناكات', nameEn: 'Snacks & Sweets' },
  { key: 'drinks', nameAr: 'مشروبات', nameEn: 'Beverages' },
  { key: 'cleaning', nameAr: 'منظفات', nameEn: 'Cleaning Supplies' },
  { key: 'personal', nameAr: 'عناية شخصية', nameEn: 'Personal Care' },
  { key: 'baby', nameAr: 'مستلزمات الأطفال', nameEn: 'Baby Care' },
  { key: 'tobacco', nameAr: 'تبغ', nameEn: 'Tobacco' },
  { key: 'stationery', nameAr: 'قرطاسية', nameEn: 'Stationery' },
];

// Prices in ILS (₪). VAT 17% applies to everything except fresh produce
// (tomatoes, cucumber, etc.), which is 0% by Palestinian VAT law.
const VAT = 17;

const PRODUCTS: ProductRow[] = [
  // === Groceries / food ===
  { sku: 'GR-0001', barcode: '6281000000011', cat: 'food', nameAr: 'خبز عربي كبير', nameEn: 'Arabic Bread Large', cost: 2.0, price: 3.0, tax: 0, unit: 'pc', stock: 120, low: 30 },
  { sku: 'GR-0002', barcode: '6281000000028', cat: 'food', nameAr: 'خبز عربي صغير', nameEn: 'Arabic Bread Small', cost: 1.2, price: 2.0, tax: 0, unit: 'pc', stock: 80, low: 20 },
  { sku: 'GR-0003', barcode: '6281000000035', cat: 'food', nameAr: 'أرز مصري 5 كغ', nameEn: 'Egyptian Rice 5kg', cost: 38, price: 48, tax: VAT, unit: 'pc', stock: 40, low: 5 },
  { sku: 'GR-0004', barcode: '6281000000042', cat: 'food', nameAr: 'أرز بسمتي 2 كغ', nameEn: 'Basmati Rice 2kg', cost: 28, price: 38, tax: VAT, unit: 'pc', stock: 30, low: 5 },
  { sku: 'GR-0005', barcode: '6281000000059', cat: 'food', nameAr: 'سكر أبيض 1 كغ', nameEn: 'White Sugar 1kg', cost: 4.5, price: 6.5, tax: VAT, unit: 'pc', stock: 80, low: 15 },
  { sku: 'GR-0006', barcode: '6281000000066', cat: 'food', nameAr: 'ملح طعام 500 غ', nameEn: 'Table Salt 500g', cost: 2.0, price: 3.0, tax: VAT, unit: 'pc', stock: 50, low: 10 },
  { sku: 'GR-0007', barcode: '6281000000073', cat: 'food', nameAr: 'دقيق أبيض 1 كغ', nameEn: 'White Flour 1kg', cost: 3.5, price: 5.5, tax: VAT, unit: 'pc', stock: 60, low: 15 },
  { sku: 'GR-0008', barcode: '6281000000080', cat: 'food', nameAr: 'برغل ناعم 1 كغ', nameEn: 'Fine Bulgur 1kg', cost: 9, price: 13, tax: VAT, unit: 'pc', stock: 35, low: 8 },
  { sku: 'GR-0009', barcode: '6281000000097', cat: 'food', nameAr: 'برغل خشن 1 كغ', nameEn: 'Coarse Bulgur 1kg', cost: 9, price: 13, tax: VAT, unit: 'pc', stock: 35, low: 8 },
  { sku: 'GR-0010', barcode: '6281000000103', cat: 'food', nameAr: 'عدس أحمر 1 كغ', nameEn: 'Red Lentils 1kg', cost: 11, price: 15, tax: VAT, unit: 'pc', stock: 30, low: 8 },
  { sku: 'GR-0011', barcode: '6281000000110', cat: 'food', nameAr: 'حمص حب 1 كغ', nameEn: 'Chickpeas 1kg', cost: 9, price: 13, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'GR-0012', barcode: '6281000000127', cat: 'food', nameAr: 'فول حب 1 كغ', nameEn: 'Fava Beans 1kg', cost: 7, price: 11, tax: VAT, unit: 'pc', stock: 30, low: 10 },
  { sku: 'GR-0013', barcode: '6281000000134', cat: 'food', nameAr: 'مكرونة سباغيتي 500 غ', nameEn: 'Spaghetti 500g', cost: 5, price: 8, tax: VAT, unit: 'pc', stock: 60, low: 15 },
  { sku: 'GR-0014', barcode: '6281000000141', cat: 'food', nameAr: 'شعرية 500 غ', nameEn: 'Vermicelli 500g', cost: 4, price: 6, tax: VAT, unit: 'pc', stock: 50, low: 12 },
  { sku: 'GR-0015', barcode: '6281000000158', cat: 'food', nameAr: 'زعتر مخلوط 500 غ', nameEn: 'Mixed Zaatar 500g', cost: 18, price: 26, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'GR-0016', barcode: '6281000000165', cat: 'food', nameAr: 'طحينة 900 غ', nameEn: 'Tahini 900g', cost: 22, price: 30, tax: VAT, unit: 'pc', stock: 30, low: 8 },
  { sku: 'GR-0017', barcode: '6281000000172', cat: 'food', nameAr: 'دبس رمان 500 مل', nameEn: 'Pomegranate Molasses 500ml', cost: 15, price: 22, tax: VAT, unit: 'pc', stock: 25, low: 5 },
  { sku: 'GR-0018', barcode: '6281000000189', cat: 'food', nameAr: 'زيتون أخضر 500 غ', nameEn: 'Green Olives 500g', cost: 12, price: 17, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'GR-0019', barcode: '6281000000196', cat: 'food', nameAr: 'زيتون أسود 500 غ', nameEn: 'Black Olives 500g', cost: 14, price: 20, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'GR-0020', barcode: '6281000000202', cat: 'food', nameAr: 'مخلل مشكل 1 كغ', nameEn: 'Mixed Pickles 1kg', cost: 10, price: 15, tax: VAT, unit: 'pc', stock: 25, low: 5 },

  // === Oils ===
  { sku: 'OL-0001', barcode: '6281000100015', cat: 'oil', nameAr: 'زيت زيتون فلسطيني 3 لتر', nameEn: 'Palestinian Olive Oil 3L', cost: 150, price: 190, tax: VAT, unit: 'pc', stock: 30, low: 6 },
  { sku: 'OL-0002', barcode: '6281000100022', cat: 'oil', nameAr: 'زيت زيتون فلسطيني 1 لتر', nameEn: 'Palestinian Olive Oil 1L', cost: 55, price: 72, tax: VAT, unit: 'pc', stock: 40, low: 8 },
  { sku: 'OL-0003', barcode: '6281000100039', cat: 'oil', nameAr: 'زيت ذرة 1 لتر', nameEn: 'Corn Oil 1L', cost: 11, price: 16, tax: VAT, unit: 'pc', stock: 60, low: 12 },
  { sku: 'OL-0004', barcode: '6281000100046', cat: 'oil', nameAr: 'زيت دوار الشمس 1 لتر', nameEn: 'Sunflower Oil 1L', cost: 10, price: 14, tax: VAT, unit: 'pc', stock: 50, low: 12 },
  { sku: 'OL-0005', barcode: '6281000100053', cat: 'oil', nameAr: 'سمنة نباتية 2 كغ', nameEn: 'Vegetable Ghee 2kg', cost: 35, price: 48, tax: VAT, unit: 'pc', stock: 20, low: 5 },

  // === Dairy ===
  { sku: 'DA-0001', barcode: '6281000200019', cat: 'dairy', nameAr: 'حليب طازج 1 لتر', nameEn: 'Fresh Milk 1L', cost: 5, price: 7, tax: VAT, unit: 'pc', stock: 80, low: 20 },
  { sku: 'DA-0002', barcode: '6281000200026', cat: 'dairy', nameAr: 'حليب مبستر 1 لتر', nameEn: 'Pasteurized Milk 1L', cost: 4.5, price: 6, tax: VAT, unit: 'pc', stock: 70, low: 20 },
  { sku: 'DA-0003', barcode: '6281000200033', cat: 'dairy', nameAr: 'حليب مجفف 400 غ', nameEn: 'Powder Milk 400g', cost: 24, price: 32, tax: VAT, unit: 'pc', stock: 30, low: 6 },
  { sku: 'DA-0004', barcode: '6281000200040', cat: 'dairy', nameAr: 'لبن رايب 1 لتر', nameEn: 'Yogurt 1L', cost: 6, price: 9, tax: VAT, unit: 'pc', stock: 50, low: 12 },
  { sku: 'DA-0005', barcode: '6281000200057', cat: 'dairy', nameAr: 'لبنة 500 غ', nameEn: 'Labneh 500g', cost: 14, price: 20, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'DA-0006', barcode: '6281000200064', cat: 'dairy', nameAr: 'جبنة بيضاء 500 غ', nameEn: 'White Cheese 500g', cost: 19, price: 28, tax: VAT, unit: 'pc', stock: 30, low: 8 },
  { sku: 'DA-0007', barcode: '6281000200071', cat: 'dairy', nameAr: 'جبنة نابلسية 500 غ', nameEn: 'Nabulsi Cheese 500g', cost: 38, price: 52, tax: VAT, unit: 'pc', stock: 25, low: 6 },
  { sku: 'DA-0008', barcode: '6281000200088', cat: 'dairy', nameAr: 'جبنة عكاوي 500 غ', nameEn: 'Akkawi Cheese 500g', cost: 30, price: 42, tax: VAT, unit: 'pc', stock: 25, low: 6 },
  { sku: 'DA-0009', barcode: '6281000200095', cat: 'dairy', nameAr: 'جبنة صفراء شرائح', nameEn: 'Yellow Cheese Slices', cost: 22, price: 30, tax: VAT, unit: 'pc', stock: 30, low: 8 },
  { sku: 'DA-0010', barcode: '6281000200101', cat: 'dairy', nameAr: 'زبدة 200 غ', nameEn: 'Butter 200g', cost: 14, price: 20, tax: VAT, unit: 'pc', stock: 35, low: 8 },
  { sku: 'DA-0011', barcode: '6281000200118', cat: 'dairy', nameAr: 'قشطة 250 غ', nameEn: 'Cream 250g', cost: 7, price: 11, tax: VAT, unit: 'pc', stock: 30, low: 8 },
  { sku: 'DA-0012', barcode: '6281000200125', cat: 'dairy', nameAr: 'بيض 30 حبة', nameEn: 'Eggs 30-pack', cost: 23, price: 32, tax: VAT, unit: 'pc', stock: 40, low: 8 },
  { sku: 'DA-0013', barcode: '6281000200132', cat: 'dairy', nameAr: 'بيض 10 حبة', nameEn: 'Eggs 10-pack', cost: 9, price: 13, tax: VAT, unit: 'pc', stock: 40, low: 10 },

  // === Meat & Poultry (priced by weight) ===
  { sku: 'MT-0001', barcode: '6281000300013', cat: 'meat', nameAr: 'دجاج كامل طازج', nameEn: 'Fresh Whole Chicken', cost: 22, price: 30, tax: VAT, unit: 'kg', stock: 50, low: 15 },
  { sku: 'MT-0002', barcode: '6281000300020', cat: 'meat', nameAr: 'صدور دجاج', nameEn: 'Chicken Breast', cost: 35, price: 48, tax: VAT, unit: 'kg', stock: 40, low: 12 },
  { sku: 'MT-0003', barcode: '6281000300037', cat: 'meat', nameAr: 'أوراك دجاج', nameEn: 'Chicken Thighs', cost: 25, price: 34, tax: VAT, unit: 'kg', stock: 35, low: 10 },
  { sku: 'MT-0004', barcode: '6281000300044', cat: 'meat', nameAr: 'لحم بقر مفروم', nameEn: 'Ground Beef', cost: 70, price: 90, tax: VAT, unit: 'kg', stock: 25, low: 8 },
  { sku: 'MT-0005', barcode: '6281000300051', cat: 'meat', nameAr: 'لحم عجل طازج', nameEn: 'Fresh Veal', cost: 80, price: 105, tax: VAT, unit: 'kg', stock: 20, low: 5 },
  { sku: 'MT-0006', barcode: '6281000300068', cat: 'meat', nameAr: 'لحم خروف', nameEn: 'Lamb Meat', cost: 100, price: 130, tax: VAT, unit: 'kg', stock: 15, low: 5 },
  { sku: 'MT-0007', barcode: '6281000300075', cat: 'meat', nameAr: 'كبدة دجاج', nameEn: 'Chicken Liver', cost: 20, price: 28, tax: VAT, unit: 'kg', stock: 15, low: 4 },
  { sku: 'MT-0008', barcode: '6281000300082', cat: 'meat', nameAr: 'شاورما دجاج متبلة', nameEn: 'Marinated Chicken Shawarma', cost: 30, price: 42, tax: VAT, unit: 'kg', stock: 20, low: 5 },
  { sku: 'MT-0009', barcode: '6281000300099', cat: 'meat', nameAr: 'مرتديلا', nameEn: 'Mortadella', cost: 27, price: 38, tax: VAT, unit: 'kg', stock: 15, low: 5 },

  // === Vegetables & Fruits (0% VAT, priced by weight) ===
  { sku: 'VF-0001', barcode: '6281000400017', cat: 'vegfruit', nameAr: 'بندورة', nameEn: 'Tomato', cost: 3, price: 5, tax: 0, unit: 'kg', stock: 80, low: 20 },
  { sku: 'VF-0002', barcode: '6281000400024', cat: 'vegfruit', nameAr: 'خيار', nameEn: 'Cucumber', cost: 4, price: 6, tax: 0, unit: 'kg', stock: 60, low: 15 },
  { sku: 'VF-0003', barcode: '6281000400031', cat: 'vegfruit', nameAr: 'بطاطا', nameEn: 'Potato', cost: 2.5, price: 4, tax: 0, unit: 'kg', stock: 100, low: 25 },
  { sku: 'VF-0004', barcode: '6281000400048', cat: 'vegfruit', nameAr: 'بصل أبيض', nameEn: 'White Onion', cost: 2.5, price: 4, tax: 0, unit: 'kg', stock: 80, low: 20 },
  { sku: 'VF-0005', barcode: '6281000400055', cat: 'vegfruit', nameAr: 'بصل أحمر', nameEn: 'Red Onion', cost: 3, price: 5, tax: 0, unit: 'kg', stock: 50, low: 15 },
  { sku: 'VF-0006', barcode: '6281000400062', cat: 'vegfruit', nameAr: 'ثوم', nameEn: 'Garlic', cost: 15, price: 22, tax: 0, unit: 'kg', stock: 25, low: 5 },
  { sku: 'VF-0007', barcode: '6281000400079', cat: 'vegfruit', nameAr: 'جزر', nameEn: 'Carrot', cost: 3, price: 5, tax: 0, unit: 'kg', stock: 40, low: 10 },
  { sku: 'VF-0008', barcode: '6281000400086', cat: 'vegfruit', nameAr: 'خس', nameEn: 'Lettuce', cost: 2.5, price: 4, tax: 0, unit: 'pc', stock: 40, low: 10 },
  { sku: 'VF-0009', barcode: '6281000400093', cat: 'vegfruit', nameAr: 'فلفل أخضر حلو', nameEn: 'Green Sweet Pepper', cost: 7, price: 10, tax: 0, unit: 'kg', stock: 30, low: 8 },
  { sku: 'VF-0010', barcode: '6281000400109', cat: 'vegfruit', nameAr: 'فلفل أحمر حلو', nameEn: 'Red Sweet Pepper', cost: 9, price: 13, tax: 0, unit: 'kg', stock: 25, low: 6 },
  { sku: 'VF-0011', barcode: '6281000400116', cat: 'vegfruit', nameAr: 'ملوخية طازجة', nameEn: 'Fresh Molokhia', cost: 5, price: 8, tax: 0, unit: 'kg', stock: 20, low: 5 },
  { sku: 'VF-0012', barcode: '6281000400123', cat: 'vegfruit', nameAr: 'سبانخ', nameEn: 'Spinach', cost: 4, price: 6, tax: 0, unit: 'kg', stock: 25, low: 6 },
  { sku: 'VF-0013', barcode: '6281000400130', cat: 'vegfruit', nameAr: 'كوسا', nameEn: 'Zucchini', cost: 4, price: 6, tax: 0, unit: 'kg', stock: 35, low: 10 },
  { sku: 'VF-0014', barcode: '6281000400147', cat: 'vegfruit', nameAr: 'باذنجان', nameEn: 'Eggplant', cost: 3, price: 5, tax: 0, unit: 'kg', stock: 40, low: 10 },
  { sku: 'VF-0015', barcode: '6281000400154', cat: 'vegfruit', nameAr: 'زعتر أخضر طازج', nameEn: 'Fresh Thyme', cost: 3, price: 5, tax: 0, unit: 'pc', stock: 20, low: 5 },
  { sku: 'VF-0016', barcode: '6281000400161', cat: 'vegfruit', nameAr: 'نعناع أخضر', nameEn: 'Fresh Mint', cost: 2, price: 3, tax: 0, unit: 'pc', stock: 25, low: 6 },
  { sku: 'VF-0017', barcode: '6281000400178', cat: 'vegfruit', nameAr: 'بقدونس', nameEn: 'Parsley', cost: 2, price: 3, tax: 0, unit: 'pc', stock: 30, low: 8 },
  { sku: 'VF-0018', barcode: '6281000400185', cat: 'vegfruit', nameAr: 'تفاح أحمر', nameEn: 'Red Apple', cost: 5, price: 8, tax: 0, unit: 'kg', stock: 60, low: 15 },
  { sku: 'VF-0019', barcode: '6281000400192', cat: 'vegfruit', nameAr: 'تفاح أخضر', nameEn: 'Green Apple', cost: 6, price: 9, tax: 0, unit: 'kg', stock: 40, low: 10 },
  { sku: 'VF-0020', barcode: '6281000400208', cat: 'vegfruit', nameAr: 'موز', nameEn: 'Banana', cost: 5, price: 7, tax: 0, unit: 'kg', stock: 50, low: 12 },
  { sku: 'VF-0021', barcode: '6281000400215', cat: 'vegfruit', nameAr: 'برتقال يافاوي', nameEn: 'Jaffa Orange', cost: 3, price: 5, tax: 0, unit: 'kg', stock: 70, low: 15 },
  { sku: 'VF-0022', barcode: '6281000400222', cat: 'vegfruit', nameAr: 'ليمون', nameEn: 'Lemon', cost: 5, price: 8, tax: 0, unit: 'kg', stock: 40, low: 10 },
  { sku: 'VF-0023', barcode: '6281000400239', cat: 'vegfruit', nameAr: 'عنب أحمر', nameEn: 'Red Grape', cost: 11, price: 16, tax: 0, unit: 'kg', stock: 25, low: 6 },
  { sku: 'VF-0024', barcode: '6281000400246', cat: 'vegfruit', nameAr: 'تين طازج', nameEn: 'Fresh Fig', cost: 20, price: 28, tax: 0, unit: 'kg', stock: 15, low: 4 },
  { sku: 'VF-0025', barcode: '6281000400253', cat: 'vegfruit', nameAr: 'بطيخ', nameEn: 'Watermelon', cost: 2, price: 3, tax: 0, unit: 'kg', stock: 80, low: 20 },

  // === Bakery & Oriental sweets ===
  { sku: 'BK-0001', barcode: '6281000500014', cat: 'bakery', nameAr: 'كعك بالسمسم', nameEn: 'Sesame Cake', cost: 3, price: 5, tax: 0, unit: 'pc', stock: 40, low: 10 },
  { sku: 'BK-0002', barcode: '6281000500021', cat: 'bakery', nameAr: 'معمول بالتمر', nameEn: 'Date Maamoul', cost: 2, price: 3.5, tax: 0, unit: 'pc', stock: 80, low: 20 },
  { sku: 'BK-0003', barcode: '6281000500038', cat: 'bakery', nameAr: 'بقلاوة', nameEn: 'Baklava', cost: 45, price: 65, tax: 0, unit: 'kg', stock: 15, low: 4 },
  { sku: 'BK-0004', barcode: '6281000500045', cat: 'bakery', nameAr: 'كنافة نابلسية', nameEn: 'Nabulsi Kunafa', cost: 25, price: 38, tax: 0, unit: 'kg', stock: 20, low: 5 },
  { sku: 'BK-0005', barcode: '6281000500052', cat: 'bakery', nameAr: 'مناقيش زعتر', nameEn: 'Zaatar Manaqish', cost: 3, price: 5, tax: 0, unit: 'pc', stock: 50, low: 15 },

  // === Canned ===
  { sku: 'CN-0001', barcode: '6281000600018', cat: 'canned', nameAr: 'تونة بالزيت 170 غ', nameEn: 'Tuna in Oil 170g', cost: 9, price: 13, tax: VAT, unit: 'pc', stock: 80, low: 20 },
  { sku: 'CN-0002', barcode: '6281000600025', cat: 'canned', nameAr: 'ذرة حلوة معلبة', nameEn: 'Canned Sweet Corn', cost: 6, price: 9, tax: VAT, unit: 'pc', stock: 50, low: 12 },
  { sku: 'CN-0003', barcode: '6281000600032', cat: 'canned', nameAr: 'فاصولياء معلبة', nameEn: 'Canned Beans', cost: 7, price: 11, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'CN-0004', barcode: '6281000600049', cat: 'canned', nameAr: 'فول مدمس معلب', nameEn: 'Canned Fava Beans', cost: 5, price: 8, tax: VAT, unit: 'pc', stock: 70, low: 15 },
  { sku: 'CN-0005', barcode: '6281000600056', cat: 'canned', nameAr: 'حمص جاهز', nameEn: 'Canned Hummus', cost: 6, price: 9, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'CN-0006', barcode: '6281000600063', cat: 'canned', nameAr: 'صلصة بندورة 1 كغ', nameEn: 'Tomato Paste 1kg', cost: 9, price: 13, tax: VAT, unit: 'pc', stock: 35, low: 8 },

  // === Snacks / sweets ===
  { sku: 'SN-0001', barcode: '4011100000014', cat: 'snacks', nameAr: 'مارس', nameEn: 'Mars Bar', cost: 2.5, price: 4, tax: VAT, unit: 'pc', stock: 100, low: 20 },
  { sku: 'SN-0002', barcode: '4011100000021', cat: 'snacks', nameAr: 'سنيكرز', nameEn: 'Snickers', cost: 2.5, price: 4, tax: VAT, unit: 'pc', stock: 100, low: 20 },
  { sku: 'SN-0003', barcode: '4011100000038', cat: 'snacks', nameAr: 'كيت كات', nameEn: 'Kit Kat', cost: 2.5, price: 4, tax: VAT, unit: 'pc', stock: 100, low: 20 },
  { sku: 'SN-0004', barcode: '4011100000045', cat: 'snacks', nameAr: 'بسكويت أوريو', nameEn: 'Oreo', cost: 3, price: 5, tax: VAT, unit: 'pc', stock: 80, low: 15 },
  { sku: 'SN-0005', barcode: '4011100000052', cat: 'snacks', nameAr: 'رقائق بطاطا 150 غ', nameEn: 'Potato Chips 150g', cost: 4, price: 6, tax: VAT, unit: 'pc', stock: 60, low: 15 },
  { sku: 'SN-0006', barcode: '4011100000069', cat: 'snacks', nameAr: 'حلاوة طحينية 400 غ', nameEn: 'Halva 400g', cost: 17, price: 24, tax: VAT, unit: 'pc', stock: 30, low: 8 },
  { sku: 'SN-0007', barcode: '4011100000076', cat: 'snacks', nameAr: 'بوظة ڤانيلا', nameEn: 'Vanilla Ice Cream', cost: 8, price: 12, tax: VAT, unit: 'pc', stock: 40, low: 10 },

  // === Beverages ===
  { sku: 'DR-0001', barcode: '5449000000017', cat: 'drinks', nameAr: 'مياه 1.5 لتر', nameEn: 'Water 1.5L', cost: 1.5, price: 2.5, tax: VAT, unit: 'pc', stock: 200, low: 40 },
  { sku: 'DR-0002', barcode: '5449000000024', cat: 'drinks', nameAr: 'مياه 500 مل', nameEn: 'Water 500ml', cost: 0.8, price: 1.5, tax: VAT, unit: 'pc', stock: 250, low: 50 },
  { sku: 'DR-0003', barcode: '5449000000031', cat: 'drinks', nameAr: 'كوكا كولا 1.5 لتر', nameEn: 'Coca-Cola 1.5L', cost: 6, price: 9, tax: VAT, unit: 'pc', stock: 80, low: 20 },
  { sku: 'DR-0004', barcode: '5449000000048', cat: 'drinks', nameAr: 'كوكا كولا 330 مل', nameEn: 'Coca-Cola Can 330ml', cost: 2.5, price: 4, tax: VAT, unit: 'pc', stock: 150, low: 30 },
  { sku: 'DR-0005', barcode: '5449000000055', cat: 'drinks', nameAr: 'بيبسي 1.5 لتر', nameEn: 'Pepsi 1.5L', cost: 5, price: 8, tax: VAT, unit: 'pc', stock: 70, low: 20 },
  { sku: 'DR-0006', barcode: '5449000000062', cat: 'drinks', nameAr: 'سبرايت 1.5 لتر', nameEn: 'Sprite 1.5L', cost: 6, price: 9, tax: VAT, unit: 'pc', stock: 60, low: 15 },
  { sku: 'DR-0007', barcode: '5449000000079', cat: 'drinks', nameAr: 'فانتا 1.5 لتر', nameEn: 'Fanta 1.5L', cost: 6, price: 9, tax: VAT, unit: 'pc', stock: 50, low: 15 },
  { sku: 'DR-0008', barcode: '5449000000086', cat: 'drinks', nameAr: 'عصير برتقال 1 لتر', nameEn: 'Orange Juice 1L', cost: 9, price: 13, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'DR-0009', barcode: '5449000000093', cat: 'drinks', nameAr: 'شاي ليبتون 100 كيس', nameEn: 'Lipton Tea 100 bags', cost: 19, price: 27, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'DR-0010', barcode: '5449000000109', cat: 'drinks', nameAr: 'قهوة عربية 250 غ', nameEn: 'Arabic Coffee 250g', cost: 27, price: 38, tax: VAT, unit: 'pc', stock: 30, low: 8 },
  { sku: 'DR-0011', barcode: '5449000000116', cat: 'drinks', nameAr: 'نسكافيه 200 غ', nameEn: 'Nescafe 200g', cost: 22, price: 32, tax: VAT, unit: 'pc', stock: 35, low: 8 },
  { sku: 'DR-0012', barcode: '5449000000123', cat: 'drinks', nameAr: 'يانسون 100 غ', nameEn: 'Anise 100g', cost: 9, price: 14, tax: VAT, unit: 'pc', stock: 25, low: 6 },
  { sku: 'DR-0013', barcode: '5449000000130', cat: 'drinks', nameAr: 'كركديه 250 غ', nameEn: 'Hibiscus 250g', cost: 11, price: 16, tax: VAT, unit: 'pc', stock: 25, low: 6 },

  // === Cleaning ===
  { sku: 'CL-0001', barcode: '8712561000015', cat: 'cleaning', nameAr: 'كلوركس 1 لتر', nameEn: 'Clorox Bleach 1L', cost: 9, price: 14, tax: VAT, unit: 'pc', stock: 50, low: 12 },
  { sku: 'CL-0002', barcode: '8712561000022', cat: 'cleaning', nameAr: 'منظف أرضيات 1 لتر', nameEn: 'Floor Cleaner 1L', cost: 14, price: 20, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'CL-0003', barcode: '8712561000039', cat: 'cleaning', nameAr: 'مسحوق غسيل أريال 3 كغ', nameEn: 'Ariel Detergent 3kg', cost: 45, price: 62, tax: VAT, unit: 'pc', stock: 30, low: 6 },
  { sku: 'CL-0004', barcode: '8712561000046', cat: 'cleaning', nameAr: 'سائل جلي فيري 500 مل', nameEn: 'Fairy Dish Soap 500ml', cost: 10, price: 15, tax: VAT, unit: 'pc', stock: 45, low: 10 },
  { sku: 'CL-0005', barcode: '8712561000053', cat: 'cleaning', nameAr: 'مناديل ورقية 100 حبة', nameEn: 'Tissues 100pc', cost: 5, price: 9, tax: VAT, unit: 'pc', stock: 60, low: 15 },
  { sku: 'CL-0006', barcode: '8712561000060', cat: 'cleaning', nameAr: 'ورق تواليت 12 لفة', nameEn: 'Toilet Paper 12 rolls', cost: 15, price: 22, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'CL-0007', barcode: '8712561000077', cat: 'cleaning', nameAr: 'مكنسة يدوية', nameEn: 'Broom', cost: 18, price: 28, tax: VAT, unit: 'pc', stock: 15, low: 3 },

  // === Personal care ===
  { sku: 'PC-0001', barcode: '5000100000010', cat: 'personal', nameAr: 'شامبو دوف 400 مل', nameEn: 'Dove Shampoo 400ml', cost: 16, price: 24, tax: VAT, unit: 'pc', stock: 40, low: 10 },
  { sku: 'PC-0002', barcode: '5000100000027', cat: 'personal', nameAr: 'شامبو هيد آند شولدرز', nameEn: 'Head & Shoulders Shampoo', cost: 22, price: 32, tax: VAT, unit: 'pc', stock: 35, low: 8 },
  { sku: 'PC-0003', barcode: '5000100000034', cat: 'personal', nameAr: 'معجون أسنان سيجنال', nameEn: 'Signal Toothpaste', cost: 9, price: 14, tax: VAT, unit: 'pc', stock: 50, low: 12 },
  { sku: 'PC-0004', barcode: '5000100000041', cat: 'personal', nameAr: 'فرشاة أسنان', nameEn: 'Toothbrush', cost: 5, price: 9, tax: VAT, unit: 'pc', stock: 60, low: 15 },
  { sku: 'PC-0005', barcode: '5000100000058', cat: 'personal', nameAr: 'صابون لوكس', nameEn: 'Lux Soap Bar', cost: 2.5, price: 4.5, tax: VAT, unit: 'pc', stock: 80, low: 20 },
  { sku: 'PC-0006', barcode: '5000100000065', cat: 'personal', nameAr: 'صابون نابلسي', nameEn: 'Nabulsi Soap Bar', cost: 7, price: 11, tax: VAT, unit: 'pc', stock: 50, low: 12 },
  { sku: 'PC-0007', barcode: '5000100000072', cat: 'personal', nameAr: 'شفرات حلاقة', nameEn: 'Disposable Razors', cost: 11, price: 17, tax: VAT, unit: 'pc', stock: 30, low: 6 },

  // === Baby ===
  { sku: 'BB-0001', barcode: '4015400000017', cat: 'baby', nameAr: 'حفاضات بامبرز جامبو', nameEn: 'Pampers Jumbo Diapers', cost: 65, price: 88, tax: VAT, unit: 'pc', stock: 30, low: 6 },
  { sku: 'BB-0002', barcode: '4015400000024', cat: 'baby', nameAr: 'حليب أطفال 400 غ', nameEn: 'Infant Formula 400g', cost: 45, price: 62, tax: VAT, unit: 'pc', stock: 25, low: 5 },
  { sku: 'BB-0003', barcode: '4015400000031', cat: 'baby', nameAr: 'بسكويت أطفال', nameEn: 'Baby Biscuits', cost: 9, price: 13, tax: VAT, unit: 'pc', stock: 35, low: 8 },
  { sku: 'BB-0004', barcode: '4015400000048', cat: 'baby', nameAr: 'مناديل مبللة للأطفال', nameEn: 'Baby Wet Wipes', cost: 12, price: 18, tax: VAT, unit: 'pc', stock: 40, low: 10 },

  // === Tobacco (luxury VAT still 17%) ===
  { sku: 'TB-0001', barcode: '7622210000016', cat: 'tobacco', nameAr: 'مارلبورو ريد', nameEn: 'Marlboro Red', cost: 24, price: 32, tax: VAT, unit: 'pc', stock: 60, low: 15 },
  { sku: 'TB-0002', barcode: '7622210000023', cat: 'tobacco', nameAr: 'L&M أحمر', nameEn: 'L&M Red', cost: 20, price: 27, tax: VAT, unit: 'pc', stock: 50, low: 12 },
  { sku: 'TB-0003', barcode: '7622210000030', cat: 'tobacco', nameAr: 'معسل مزاج', nameEn: 'Mazaya Shisha Tobacco 50g', cost: 11, price: 17, tax: VAT, unit: 'pc', stock: 30, low: 8 },

  // === Stationery ===
  { sku: 'ST-0001', barcode: '8900000000013', cat: 'stationery', nameAr: 'قلم جاف أزرق', nameEn: 'Ballpoint Pen Blue', cost: 1, price: 2, tax: VAT, unit: 'pc', stock: 100, low: 25 },
  { sku: 'ST-0002', barcode: '8900000000020', cat: 'stationery', nameAr: 'دفتر 100 ورقة', nameEn: 'Notebook 100 pages', cost: 5, price: 9, tax: VAT, unit: 'pc', stock: 50, low: 10 },
  { sku: 'ST-0003', barcode: '8900000000037', cat: 'stationery', nameAr: 'مقص مكتبي', nameEn: 'Office Scissors', cost: 12, price: 19, tax: VAT, unit: 'pc', stock: 25, low: 5 },
];

const USERS: Array<{ username: string; password: string; fullName: string; role: 'admin' | 'manager' | 'cashier' }> = [
  { username: 'admin', password: 'admin', fullName: 'مدير النظام', role: 'admin' },
  { username: 'manager', password: 'manager', fullName: 'أبو محمد - المشرف', role: 'manager' },
  { username: 'cashier1', password: 'cashier', fullName: 'محمد أبو الحسن', role: 'cashier' },
  { username: 'cashier2', password: 'cashier', fullName: 'أحمد خالد', role: 'cashier' },
  { username: 'cashier3', password: 'cashier', fullName: 'سارة عوده', role: 'cashier' },
];

const SUPPLIERS: Array<{ name: string; phone: string; email?: string | null; taxId?: string | null; address: string }> = [
  { name: 'شركة سنيورة للصناعات الغذائية', phone: '+970-2-298-5555', email: 'orders@siniora.ps', taxId: '500000001', address: 'رام الله - صناعية بيتونيا' },
  { name: 'مطاحن نابلس للزيوت', phone: '+970-9-238-8888', email: 'sales@nablusoil.ps', taxId: '500000002', address: 'نابلس - المنطقة الصناعية' },
  { name: 'شركة الأرز للألبان', phone: '+970-2-240-7777', email: 'orders@alarz-dairy.ps', taxId: '500000003', address: 'رام الله - البيرة' },
  { name: 'تعاونية جنين للخضار والفواكه', phone: '+970-4-250-6666', email: null, taxId: '500000004', address: 'جنين - السوق المركزي' },
  { name: 'شركة التمرة للتوزيع', phone: '+970-8-282-3333', email: 'info@tamra.ps', taxId: '500000005', address: 'الخليل - صناعية الشيوخ' },
  { name: 'الوكالة الفلسطينية للمنظفات', phone: '+970-2-295-1111', email: null, taxId: '500000006', address: 'بيت لحم - شارع القدس' },
];

const CUSTOMERS: Array<{ name: string; phone: string; email?: string | null; taxId?: string | null; address?: string | null; balance?: number }> = [
  { name: 'عميل نقدي', phone: '', address: '' }, // walk-in
  { name: 'أبو يوسف - بقالة الزاوية', phone: '0599111222', email: null, taxId: '400000001', address: 'رام الله - المنارة', balance: 250 },
  { name: 'مطعم القدس', phone: '0598444555', email: 'accounts@quds.ps', taxId: '400000002', address: 'رام الله - الطيرة', balance: 0 },
  { name: 'مدرسة الأمل الابتدائية', phone: '+970-2-296-7070', email: 'office@alamal.edu.ps', taxId: '400000003', address: 'البيرة', balance: 0 },
  { name: 'أم أحمد', phone: '0597888999', email: null, address: 'البيرة - شارع القدس', balance: 80 },
  { name: 'ليلى خليل', phone: '0569333444', email: null, address: 'رام الله - المصيون', balance: 0 },
];

export const PALESTINE_SETTINGS: Record<string, string> = {
  'store.name_ar': 'سوبر ماركت القدس',
  'store.name_en': 'Al-Quds Supermarket',
  'store.address': 'رام الله - شارع الإرسال - مقابل المكتبة الوطنية',
  'store.phone': '+970-2-295-4242',
  'store.tax_id': '500123456',
  'tax.default_rate': String(VAT),
  'tax.included': 'false',
  'currency.code': 'ILS',
  'currency.symbol': '₪',
  'language.default': 'ar',
  'receipt.header': 'شكراً لتسوقكم معنا',
  'receipt.footer': 'Thank you for shopping - شكراً لزيارتكم',
  'receipt.logo_path': '',
  'receipt.preview_default': 'true',
  'printer.enabled': 'false',
  'printer.type': 'usb',
  'printer.host': 'printer:auto',
  'printer.port': '9100',
  'printer.arabic_mode': 'image',
  'invoice.prefix': 'INV',
};

export async function seedPalestineSupermarket(): Promise<void> {
  const d = db();

  // Settings (insert if missing)
  const existingSettings = new Set(d.select().from(schema.settings).all().map((s) => s.key));
  const toInsert = Object.entries(PALESTINE_SETTINGS)
    .filter(([k]) => !existingSettings.has(k))
    .map(([key, value]) => ({ key, value }));
  if (toInsert.length > 0) d.insert(schema.settings).values(toInsert).run();

  // Users — top up any missing username (don't touch existing).
  const existingUsernames = new Set(d.select().from(schema.users).all().map((u) => u.username));
  for (const u of USERS) {
    if (existingUsernames.has(u.username)) continue;
    d.insert(schema.users)
      .values({
        username: u.username,
        passwordHash: await hashPassword(u.password),
        fullName: u.fullName,
        role: u.role,
        active: true,
      })
      .run();
  }

  // Catalog (categories + products + inventory) — seeded only when there are
  // ZERO products yet. This means a DB created by an earlier (less-seeded)
  // version of the app picks up the full Palestinian catalog on next boot.
  const productCount = d.select().from(schema.products).all().length;
  if (productCount === 0) {
    const catIds = new Map<string, number>();
    const byNameAr = new Map(d.select().from(schema.categories).all().map((c) => [c.nameAr, c.id]));
    for (const c of CATEGORIES) {
      const existingId = byNameAr.get(c.nameAr);
      if (existingId !== undefined) {
        catIds.set(c.key, existingId);
      } else {
        const res = d.insert(schema.categories).values({ nameAr: c.nameAr, nameEn: c.nameEn }).run();
        catIds.set(c.key, Number(res.lastInsertRowid));
      }
    }

    for (const p of PRODUCTS) {
      const res = d
        .insert(schema.products)
        .values({
          sku: p.sku,
          barcode: p.barcode,
          nameAr: p.nameAr,
          nameEn: p.nameEn,
          categoryId: catIds.get(p.cat) ?? null,
          cost: p.cost,
          price: p.price,
          taxRate: p.tax,
          unit: p.unit,
          trackStock: true,
          lowStockThreshold: p.low,
          active: true,
        })
        .run();
      const productId = Number(res.lastInsertRowid);
      d.insert(schema.inventory).values({ productId, qtyOnHand: p.stock }).run();
      d.insert(schema.inventoryMovements)
        .values({ productId, delta: p.stock, reason: 'initial' })
        .run();
    }
  }

  // Suppliers — top up missing by name.
  const existingSupplierNames = new Set(d.select().from(schema.suppliers).all().map((s) => s.name));
  for (const s of SUPPLIERS) {
    if (existingSupplierNames.has(s.name)) continue;
    d.insert(schema.suppliers)
      .values({
        name: s.name,
        phone: s.phone,
        email: s.email ?? null,
        taxId: s.taxId ?? null,
        address: s.address,
        balance: 0,
      })
      .run();
  }

  // Customers — top up missing by name.
  const existingCustomerNames = new Set(d.select().from(schema.customers).all().map((c) => c.name));
  for (const c of CUSTOMERS) {
    if (existingCustomerNames.has(c.name)) continue;
    d.insert(schema.customers)
      .values({
        name: c.name,
        phone: c.phone,
        email: c.email ?? null,
        taxId: c.taxId ?? null,
        address: c.address ?? null,
        balance: c.balance ?? 0,
      })
      .run();
  }
}
