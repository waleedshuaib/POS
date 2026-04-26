import { sqliteTable, integer, text, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const ts = () =>
  integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`);
const uts = () =>
  integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    role: text('role', { enum: ['admin', 'manager', 'cashier'] }).notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
    createdAt: ts(),
    updatedAt: uts(),
  },
  (t) => ({ usernameIdx: uniqueIndex('users_username_idx').on(t.username) }),
);

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  parentId: integer('parent_id'),
  createdAt: ts(),
  updatedAt: uts(),
});

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sku: text('sku').notNull(),
    barcode: text('barcode'),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    categoryId: integer('category_id').references(() => categories.id),
    cost: real('cost').notNull().default(0),
    price: real('price').notNull().default(0),
    taxRate: real('tax_rate').notNull().default(0),
    unit: text('unit', { enum: ['pc', 'kg', 'g', 'l', 'ml', 'm'] }).notNull().default('pc'),
    trackStock: integer('track_stock', { mode: 'boolean' }).notNull().default(true),
    lowStockThreshold: real('low_stock_threshold').notNull().default(0),
    imagePath: text('image_path'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: ts(),
    updatedAt: uts(),
  },
  (t) => ({
    skuIdx: uniqueIndex('products_sku_idx').on(t.sku),
    barcodeIdx: uniqueIndex('products_barcode_idx').on(t.barcode),
    nameArIdx: index('products_name_ar_idx').on(t.nameAr),
  }),
);

export const inventory = sqliteTable(
  'inventory',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    qtyOnHand: real('qty_on_hand').notNull().default(0),
    updatedAt: uts(),
  },
  (t) => ({ productIdx: uniqueIndex('inventory_product_idx').on(t.productId) }),
);

export const inventoryMovements = sqliteTable('inventory_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  delta: real('delta').notNull(),
  reason: text('reason', {
    enum: ['sale', 'return', 'purchase', 'adjustment', 'initial', 'void'],
  }).notNull(),
  refType: text('ref_type'),
  refId: integer('ref_id'),
  note: text('note'),
  userId: integer('user_id').references(() => users.id),
  createdAt: ts(),
});

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  taxId: text('tax_id'),
  address: text('address'),
  balance: real('balance').notNull().default(0),
  createdAt: ts(),
  updatedAt: uts(),
});

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  taxId: text('tax_id'),
  address: text('address'),
  balance: real('balance').notNull().default(0),
  createdAt: ts(),
  updatedAt: uts(),
});

export const purchases = sqliteTable('purchases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  invoiceRef: text('invoice_ref'),
  subtotal: real('subtotal').notNull().default(0),
  taxTotal: real('tax_total').notNull().default(0),
  total: real('total').notNull().default(0),
  paid: real('paid').notNull().default(0),
  status: text('status', { enum: ['completed', 'draft'] }).notNull().default('completed'),
  notes: text('notes'),
  userId: integer('user_id').references(() => users.id),
  createdAt: ts(),
  updatedAt: uts(),
});

export const purchaseItems = sqliteTable('purchase_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  purchaseId: integer('purchase_id')
    .notNull()
    .references(() => purchases.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  qty: real('qty').notNull(),
  unitCost: real('unit_cost').notNull(),
  lineTotal: real('line_total').notNull(),
});

export const sales = sqliteTable(
  'sales',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    invoiceNo: text('invoice_no').notNull(),
    customerId: integer('customer_id').references(() => customers.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    subtotal: real('subtotal').notNull().default(0),
    discountTotal: real('discount_total').notNull().default(0),
    taxTotal: real('tax_total').notNull().default(0),
    grandTotal: real('grand_total').notNull().default(0),
    paidTotal: real('paid_total').notNull().default(0),
    changeDue: real('change_due').notNull().default(0),
    status: text('status', { enum: ['completed', 'held', 'voided', 'returned'] })
      .notNull()
      .default('completed'),
    heldName: text('held_name'),
    notes: text('notes'),
    createdAt: ts(),
    updatedAt: uts(),
  },
  (t) => ({
    invoiceIdx: uniqueIndex('sales_invoice_idx').on(t.invoiceNo),
    statusIdx: index('sales_status_idx').on(t.status),
    createdIdx: index('sales_created_idx').on(t.createdAt),
  }),
);

export const saleItems = sqliteTable('sale_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id')
    .notNull()
    .references(() => sales.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  nameAtSale: text('name_at_sale').notNull(),
  qty: real('qty').notNull(),
  unitPrice: real('unit_price').notNull(),
  lineDiscount: real('line_discount').notNull().default(0),
  taxRate: real('tax_rate').notNull().default(0),
  taxAmount: real('tax_amount').notNull().default(0),
  lineTotal: real('line_total').notNull(),
});

export const salePayments = sqliteTable('sale_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id')
    .notNull()
    .references(() => sales.id, { onDelete: 'cascade' }),
  method: text('method', { enum: ['cash', 'card', 'bank_transfer', 'credit', 'check'] }).notNull(),
  amount: real('amount').notNull(),
  reference: text('reference'),
  receivedAt: integer('received_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const returns = sqliteTable('returns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id')
    .notNull()
    .references(() => sales.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  reason: text('reason'),
  total: real('total').notNull().default(0),
  createdAt: ts(),
});

export const returnItems = sqliteTable('return_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  returnId: integer('return_id')
    .notNull()
    .references(() => returns.id, { onDelete: 'cascade' }),
  saleItemId: integer('sale_item_id')
    .notNull()
    .references(() => saleItems.id),
  qty: real('qty').notNull(),
  amount: real('amount').notNull(),
});

export const cashDrawers = sqliteTable('cash_drawers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  openedAt: integer('opened_at', { mode: 'timestamp_ms' }).notNull(),
  openingAmount: real('opening_amount').notNull().default(0),
  expectedAmount: real('expected_amount').notNull().default(0),
  countedAmount: real('counted_amount'),
  variance: real('variance'),
  closedAt: integer('closed_at', { mode: 'timestamp_ms' }),
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  notes: text('notes'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: uts(),
});

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  payload: text('payload'),
  at: integer('at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type SalePayment = typeof salePayments.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type CashDrawer = typeof cashDrawers.$inferSelect;
