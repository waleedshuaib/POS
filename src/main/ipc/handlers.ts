// Centralized side-effect imports for all IPC handler files.
// Import this module once during app startup AFTER router is loaded
// so each handler's `registerRoutes(...)` call finds the router state ready.
import './handlers/auth';
import './handlers/users';
import './handlers/categories';
import './handlers/products';
import './handlers/inventory';
import './handlers/customers';
import './handlers/suppliers';
import './handlers/purchases';
import './handlers/sales';
import './handlers/returns';
import './handlers/drawer';
import './handlers/reports';
import './handlers/settings';
import './handlers/backup';
import './handlers/printer';
import './handlers/images';
