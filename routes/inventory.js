const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const InventoryController = require('../controllers/inventoryController');

router.use(protect);

router.get('/items', InventoryController.getItems.bind(InventoryController));
router.get('/items/:id', InventoryController.getItemById.bind(InventoryController));
router.post('/items', InventoryController.createItem.bind(InventoryController));
router.put('/items/:id', InventoryController.updateItem.bind(InventoryController));
router.delete('/items/:id', InventoryController.deleteItem.bind(InventoryController));
router.get('/items/:id/history', InventoryController.getItemHistory.bind(InventoryController));

router.get('/categories', InventoryController.getCategories.bind(InventoryController));
router.get('/categories/tree', InventoryController.getCategoryTree.bind(InventoryController));
router.post('/categories', InventoryController.createCategory.bind(InventoryController));
router.put('/categories/:id', InventoryController.updateCategory.bind(InventoryController));
router.delete('/categories/:id', InventoryController.deleteCategory.bind(InventoryController));

router.get('/uom', InventoryController.getUOMs.bind(InventoryController));
router.get('/uom/all', InventoryController.getAllUOMs.bind(InventoryController));
router.post('/uom', InventoryController.createUOM.bind(InventoryController));
router.put('/uom/:id', InventoryController.updateUOM.bind(InventoryController));
router.delete('/uom/:id', InventoryController.deleteUOM.bind(InventoryController));
router.put('/uom/:id/set-default', InventoryController.setDefaultUOM.bind(InventoryController));

router.get('/stores', InventoryController.getStores.bind(InventoryController));
router.get('/stores/all', InventoryController.getAllStores.bind(InventoryController));
router.get('/stores/:id', InventoryController.getStoreById.bind(InventoryController));
router.post('/stores', InventoryController.createStore.bind(InventoryController));
router.put('/stores/:id', InventoryController.updateStore.bind(InventoryController));
router.delete('/stores/:id', InventoryController.deleteStore.bind(InventoryController));

router.put('/stock/:id', InventoryController.updateStock.bind(InventoryController));
router.put('/stock/batch', InventoryController.batchUpdateStock.bind(InventoryController));
router.post('/stock/transfer', InventoryController.transferStock.bind(InventoryController));
router.get('/stock-updates', InventoryController.getStockUpdates.bind(InventoryController));

module.exports = router;

