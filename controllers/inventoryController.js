const BaseController = require('./BaseController');
const Item = require('../models/Item');
const Category = require('../models/Category');
const UOM = require('../models/UOM');
const Store = require('../models/Store');
const StockUpdate = require('../models/StockUpdate');
const InventoryHelpers = require('../utils/inventoryHelpers');
const logger = require('../utils/logger');
const { query } = require('../config/database');

let categoryCache = null;
let categoryCacheTimestamp = 0;
const CATEGORY_CACHE_TTL = 60000;

const getMemoizedCategories = async () => {
  const now = Date.now();
  if (categoryCache && (now - categoryCacheTimestamp) < CATEGORY_CACHE_TTL) {
    return categoryCache;
  }
  const result = await Category.findWithChildren();
  categoryCache = result;
  categoryCacheTimestamp = now;
  return categoryCache;
};

const clearCategoryCache = () => {
  categoryCache = null;
  categoryCacheTimestamp = 0;
};

let uomCache = null;
let uomCacheTimestamp = 0;
const UOM_CACHE_TTL = 60000;

const getMemoizedUOM = async () => {
  const now = Date.now();
  if (uomCache && (now - uomCacheTimestamp) < UOM_CACHE_TTL) {
    return uomCache;
  }
  const result = await query('SELECT * FROM uom ORDER BY is_default DESC, name ASC');
  uomCache = result.rows;
  uomCacheTimestamp = now;
  return uomCache;
};

const clearUOMCache = () => {
  uomCache = null;
  uomCacheTimestamp = 0;
};

let storeCache = null;
let storeCacheTimestamp = 0;
const STORE_CACHE_TTL = 60000;

const getMemoizedStores = async () => {
  const now = Date.now();
  if (storeCache && (now - storeCacheTimestamp) < STORE_CACHE_TTL) {
    return storeCache;
  }
  const result = await query('SELECT * FROM stores ORDER BY name ASC');
  storeCache = result.rows;
  storeCacheTimestamp = now;
  return storeCache;
};

const clearStoreCache = () => {
  storeCache = null;
  storeCacheTimestamp = 0;
};

class InventoryController extends BaseController {
  async getItems(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        item_type,
        category_id,
        store_id,
        date_from,
        date_to
      } = req.query;

      const filters = {
        search,
        item_type,
        category_id: category_id ? parseInt(category_id) : undefined,
        store_id: store_id ? parseInt(store_id) : undefined,
        date_from,
        date_to
      };

      const result = await Item.findAll(filters, { page: parseInt(page), limit: parseInt(limit) });
      
      BaseController.handleResponse(res, result, 'Items fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch items');
    }
  }

  async getItemById(req, res) {
    try {
      const { id } = req.params;
      const item = await Item.findById(id);
      
      if (!item) {
        return BaseController.handleError(res, null, 'Item not found', 404);
      }
      
      BaseController.handleResponse(res, item, 'Item fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch item');
    }
  }

  async createItem(req, res) {
    try {
      const user = req.user?.username || req.user?.name || 'system';
      const itemData = {
        ...req.body,
        created_by: user
      };

      const existingItem = await Item.findByItemId(itemData.item_id);
      if (existingItem) {
        return BaseController.handleError(res, null, 'Item ID already exists', 400);
      }

      const item = await Item.create(itemData);
      
      await query(
        `INSERT INTO item_history (item_id, action_type, new_data, changed_by)
         VALUES ($1, $2, $3, $4)`,
        [item.id, 'CREATE', JSON.stringify(item), user]
      );

      BaseController.handleResponse(res, item, 'Item created successfully', 201);
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to create item');
    }
  }

  async updateItem(req, res) {
    try {
      const { id } = req.params;
      const user = req.user?.username || req.user?.name || 'system';
      
      const oldItem = await Item.findById(id);
      if (!oldItem) {
        return BaseController.handleError(res, null, 'Item not found', 404);
      }

      const item = await Item.update(id, req.body);
      
      await query(
        `INSERT INTO item_history (item_id, action_type, old_data, new_data, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, 'UPDATE', JSON.stringify(oldItem), JSON.stringify(item), user]
      );

      BaseController.handleResponse(res, item, 'Item updated successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to update item');
    }
  }

  async deleteItem(req, res) {
    try {
      const { id } = req.params;
      const user = req.user?.username || req.user?.name || 'system';
      
      const item = await Item.findById(id);
      if (!item) {
        return BaseController.handleError(res, null, 'Item not found', 404);
      }

      await Item.delete(id);
      
      await query(
        `INSERT INTO item_history (item_id, action_type, old_data, changed_by)
         VALUES ($1, $2, $3, $4)`,
        [id, 'DELETE', JSON.stringify(item), user]
      );

      BaseController.handleResponse(res, null, 'Item deleted successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to delete item');
    }
  }

  async getItemHistory(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;
      
      const result = await Item.getHistory(id, { page: parseInt(page), limit: parseInt(limit) });
      BaseController.handleResponse(res, result, 'Item history fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch item history');
    }
  }

  async getCategories(req, res) {
    try {
      const { page = 1, limit = 100, parent_id } = req.query;
      
      const filters = {};
      if (parent_id !== undefined) {
        filters.parent_id = parent_id === 'null' ? null : parseInt(parent_id);
      }

      const result = await Category.findAll(filters, { page: parseInt(page), limit: parseInt(limit) });
      BaseController.handleResponse(res, result, 'Categories fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch categories');
    }
  }

  async getCategoryTree(req, res) {
    try {
      const categories = await getMemoizedCategories();
      BaseController.handleResponse(res, categories, 'Category tree fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch category tree');
    }
  }

  async createCategory(req, res) {
    try {
      const user = req.user?.username || req.user?.name || 'system';
      const category = await Category.create({ ...req.body, created_by: user });
      clearCategoryCache();
      BaseController.handleResponse(res, category, 'Category created successfully', 201);
    } catch (error) {
      const message = error.message || 'Failed to create category';
      const statusCode = error.message?.includes('already exists') ? 409 : 400;
      BaseController.handleError(res, error, message, statusCode);
    }
  }

  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const category = await Category.update(id, req.body);
      
      if (!category) {
        return BaseController.handleError(res, null, 'Category not found', 404);
      }
      
      clearCategoryCache();
      BaseController.handleResponse(res, category, 'Category updated successfully');
    } catch (error) {
      const message = error.message || 'Failed to update category';
      const statusCode = error.message?.includes('already exists') ? 409 : 400;
      BaseController.handleError(res, error, message, statusCode);
    }
  }

  async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      
      const category = await Category.findById(id);
      if (!category) {
        return BaseController.handleError(res, null, 'Category not found', 404);
      }

      const hasChildren = await query('SELECT COUNT(*) as count FROM categories WHERE parent_id = $1', [id]);
      if (parseInt(hasChildren.rows[0].count) > 0) {
        return BaseController.handleError(res, null, 'Cannot delete category with subcategories. Please delete subcategories first.', 400);
      }

      const hasItems = await query('SELECT COUNT(*) as count FROM items WHERE category_id = $1 OR sub_category_id = $1 OR micro_category_id = $1', [id]);
      if (parseInt(hasItems.rows[0].count) > 0) {
        return BaseController.handleError(res, null, 'Cannot delete category that is being used by items', 400);
      }

      const deleted = await Category.delete(id);
      
      clearCategoryCache();
      BaseController.handleResponse(res, deleted, 'Category deleted successfully');
    } catch (error) {
      const message = error.message || 'Failed to delete category';
      BaseController.handleError(res, error, message);
    }
  }

  async getUOMs(req, res) {
    try {
      const { page = 1, limit = 100 } = req.query;
      const result = await UOM.findAll({}, { page: parseInt(page), limit: parseInt(limit) });
      BaseController.handleResponse(res, result, 'UOMs fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch UOMs');
    }
  }

  async getAllUOMs(req, res) {
    try {
      const uoms = await getMemoizedUOM();
      BaseController.handleResponse(res, uoms, 'UOMs fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch UOMs');
    }
  }

  async createUOM(req, res) {
    try {
      const user = req.user?.username || req.user?.name || 'system';
      const uom = await UOM.create({ ...req.body, created_by: user });
      clearUOMCache();
      BaseController.handleResponse(res, uom, 'UOM created successfully', 201);
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to create UOM');
    }
  }

  async updateUOM(req, res) {
    try {
      const { id } = req.params;
      const uom = await UOM.update(id, req.body);
      
      if (!uom) {
        return BaseController.handleError(res, null, 'UOM not found', 404);
      }
      
      clearUOMCache();
      BaseController.handleResponse(res, uom, 'UOM updated successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to update UOM');
    }
  }

  async deleteUOM(req, res) {
    try {
      const { id } = req.params;
      const uom = await UOM.delete(id);
      
      if (!uom) {
        return BaseController.handleError(res, null, 'UOM not found', 404);
      }
      
      clearUOMCache();
      BaseController.handleResponse(res, null, 'UOM deleted successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to delete UOM');
    }
  }

  async setDefaultUOM(req, res) {
    try {
      const { id } = req.params;
      const uom = await UOM.setDefault(id);
      
      if (!uom) {
        return BaseController.handleError(res, null, 'UOM not found', 404);
      }
      
      clearUOMCache();
      BaseController.handleResponse(res, uom, 'Default UOM set successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to set default UOM');
    }
  }

  async getStores(req, res) {
    try {
      const { page = 1, limit = 100, is_active } = req.query;
      
      const filters = {};
      if (is_active !== undefined) {
        filters.is_active = is_active === 'true';
      }

      const result = await Store.findAll(filters, { page: parseInt(page), limit: parseInt(limit) });
      BaseController.handleResponse(res, result, 'Stores fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch stores');
    }
  }

  async getAllStores(req, res) {
    try {
      const stores = await getMemoizedStores();
      BaseController.handleResponse(res, stores, 'Stores fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch stores');
    }
  }

  async getStoreById(req, res) {
    try {
      const { id } = req.params;
      const [store, stats] = await InventoryHelpers.executeParallelQueries([
        { sql: 'SELECT * FROM stores WHERE id = $1', params: [id] },
        { sql: 'SELECT COUNT(*) as total_items, SUM(current_stock) as total_stock_value, SUM(reject_stock) as total_reject_stock FROM items WHERE store_id = $1 AND is_active = TRUE', params: [id] }
      ]);
      
      if (!store.rows[0]) {
        return BaseController.handleError(res, null, 'Store not found', 404);
      }
      
      BaseController.handleResponse(res, {
        ...store.rows[0],
        stats: stats.rows[0]
      }, 'Store fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch store');
    }
  }

  async createStore(req, res) {
    try {
      const user = req.user?.username || req.user?.name || 'system';
      const store = await Store.create({ ...req.body, created_by: user });
      clearStoreCache();
      BaseController.handleResponse(res, store, 'Store created successfully', 201);
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to create store');
    }
  }

  async updateStore(req, res) {
    try {
      const { id } = req.params;
      const store = await Store.update(id, req.body);
      
      if (!store) {
        return BaseController.handleError(res, null, 'Store not found', 404);
      }
      
      clearStoreCache();
      BaseController.handleResponse(res, store, 'Store updated successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to update store');
    }
  }

  async deleteStore(req, res) {
    try {
      const { id } = req.params;
      const store = await Store.delete(id);
      
      if (!store) {
        return BaseController.handleError(res, null, 'Store not found', 404);
      }
      
      clearStoreCache();
      BaseController.handleResponse(res, null, 'Store deleted successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to delete store');
    }
  }

  async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { quantity, update_type, comment, from_store_id, to_store_id } = req.body;
      const user = req.user?.username || req.user?.name || 'system';
      
      const result = await Item.updateStock(id, quantity, update_type, user, comment, from_store_id, to_store_id);
      BaseController.handleResponse(res, result, 'Stock updated successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to update stock');
    }
  }

  async batchUpdateStock(req, res) {
    try {
      const { updates } = req.body;
      const user = req.user?.username || req.user?.name || 'system';
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return BaseController.handleError(res, null, 'Updates array is required', 400);
      }

      const results = await Promise.all(
        updates.map(update =>
          Item.updateStock(
            update.item_id,
            update.quantity,
            update.update_type,
            user,
            update.comment,
            update.from_store_id,
            update.to_store_id
          )
        )
      );

      BaseController.handleResponse(res, results, 'Stock updated successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to batch update stock');
    }
  }

  async getStockUpdates(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        item_id,
        store_id,
        update_type,
        date_from,
        date_to
      } = req.query;

      const filters = {
        item_id: item_id ? parseInt(item_id) : undefined,
        store_id: store_id ? parseInt(store_id) : undefined,
        update_type,
        date_from,
        date_to
      };

      const result = await StockUpdate.findAll(filters, { page: parseInt(page), limit: parseInt(limit) });
      BaseController.handleResponse(res, result, 'Stock updates fetched successfully');
    } catch (error) {
      BaseController.handleError(res, error, 'Failed to fetch stock updates');
    }
  }

  async transferStock(req, res) {
    try {
      const { item_id, from_store_id, to_store_id, quantity, comment } = req.body;
      const user = req.user?.username || req.user?.name || 'system';
      
      if (!item_id || !from_store_id || !to_store_id || !quantity) {
        return BaseController.handleError(res, null, 'Missing required fields: item_id, from_store_id, to_store_id, and quantity are required', 400);
      }

      if (from_store_id === to_store_id) {
        return BaseController.handleError(res, null, 'From store and to store must be different', 400);
      }

      const result = await Item.updateStock(
        parseInt(item_id),
        parseFloat(quantity),
        'transfer',
        user,
        comment || null,
        parseInt(from_store_id),
        parseInt(to_store_id)
      );
      BaseController.handleResponse(res, result, 'Stock transferred successfully');
    } catch (error) {
      BaseController.handleError(res, error, error.message || 'Failed to transfer stock');
    }
  }
}

module.exports = new InventoryController();

