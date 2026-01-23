const Stock = require('../models/Stock');
const logger = require('../utils/logger');
const tallyService = require('../services/tallyService');

class StockController {
  /**
   * Get all stock records with hierarchical structure
   * GET /api/stock
   */
  async getAllStock(req, res) {
    try {
      const stock = await Stock.getAll();
      
      // Organize stock into hierarchical structure: Groups -> Subgroups -> Items
      const hierarchicalData = this.organizeStockHierarchy(stock);
      
      res.json({
        success: true,
        data: stock, // Keep flat structure for backward compatibility
        hierarchical: hierarchicalData // New hierarchical structure
      });
    } catch (error) {
      logger.error('Error fetching stock:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch stock',
        error: error.message
      });
    }
  }

  /**
   * Organize flat stock array into hierarchical structure
   * @param {Array} stock - Flat array of stock items
   * @returns {Object} Hierarchical structure with groups and subgroups
   */
  organizeStockHierarchy(stock) {
    const hierarchy = {};

    for (const item of stock) {
      const groupName = item.group || 'Other';
      const subgroupName = item.subgroup || 'General';
      
      if (!hierarchy[groupName]) {
        hierarchy[groupName] = {
          name: groupName,
          subgroups: {},
          totalItems: 0,
          totalQuantity: 0,
          totalValue: 0
        };
      }

      if (!hierarchy[groupName].subgroups[subgroupName]) {
        hierarchy[groupName].subgroups[subgroupName] = {
          name: subgroupName,
          items: [],
          totalItems: 0,
          totalQuantity: 0,
          totalValue: 0
        };
      }

      hierarchy[groupName].subgroups[subgroupName].items.push({
        name: item.product_name,
        quantity: item.quantity || 0,
        unit: item.unit || 'meters',
        rate: parseFloat(item.rate) || 0,
        value: parseFloat(item.value) || 0,
        status: item.status || 'out_of_stock'
      });

      // Update totals
      hierarchy[groupName].subgroups[subgroupName].totalItems++;
      hierarchy[groupName].subgroups[subgroupName].totalQuantity += (item.quantity || 0);
      hierarchy[groupName].subgroups[subgroupName].totalValue += (parseFloat(item.value) || 0);

      hierarchy[groupName].totalItems++;
      hierarchy[groupName].totalQuantity += (item.quantity || 0);
      hierarchy[groupName].totalValue += (parseFloat(item.value) || 0);
    }

    // Convert to array format for easier frontend consumption
    return Object.values(hierarchy).map(group => ({
      ...group,
      subgroups: Object.values(group.subgroups)
    }));
  }

  /**
   * Get stock by product name
   * GET /api/stock/:productName
   */
  async getStockByProduct(req, res) {
    try {
      const { productName } = req.params;
      const stock = await Stock.getByProductName(productName);
      
      if (!stock) {
        return res.status(404).json({
          success: false,
          message: 'Stock record not found'
        });
      }
      
      res.json({
        success: true,
        data: stock
      });
    } catch (error) {
      logger.error('Error fetching stock by product:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch stock',
        error: error.message
      });
    }
  }

  /**
   * Update stock for a product
   * PUT /api/stock/:productName
   */
  async updateStock(req, res) {
    try {
      const { productName } = req.params;
      const { quantity, unit, status } = req.body;
      const updatedBy = req.user?.username || req.user?.name || 'unknown';
      
      if (quantity === undefined && status === undefined) {
        return res.status(400).json({
          success: false,
          message: 'quantity or status is required'
        });
      }
      
      const stock = await Stock.updateStock(productName, {
        quantity,
        unit,
        status,
        updated_by: updatedBy
      });
      
      res.json({
        success: true,
        message: 'Stock updated successfully',
        data: stock
      });
    } catch (error) {
      logger.error('Error updating stock:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update stock',
        error: error.message
      });
    }
  }

  /**
   * Batch update multiple stock records
   * PUT /api/stock/batch
   */
  async batchUpdateStock(req, res) {
    try {
      const { updates } = req.body;
      const updatedBy = req.user?.username || req.user?.name || 'unknown';
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'updates array is required and must not be empty'
        });
      }
      
      // Add updated_by to each update
      const stockUpdates = updates.map(update => ({
        ...update,
        updated_by: updatedBy
      }));
      
      const results = await Stock.batchUpdate(stockUpdates);
      
      res.json({
        success: true,
        message: `Successfully updated ${results.length} stock records`,
        data: results
      });
    } catch (error) {
      logger.error('Error batch updating stock:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to batch update stock',
        error: error.message
      });
    }
  }

  /**
   * Check Tally connection status
   * GET /api/stock/tally/status
   */
  async checkTallyConnection(req, res) {
    try {
      const isConnected = await tallyService.checkConnection();
      
      res.json({
        success: true,
        connected: isConnected,
        message: isConnected 
          ? 'Tally is connected and responding' 
          : 'Cannot connect to Tally. Please ensure Tally is running.'
      });
    } catch (error) {
      logger.error('Error checking Tally connection:', error);
      res.status(500).json({
        success: false,
        connected: false,
        message: error.message || 'Failed to check Tally connection',
        error: error.message
      });
    }
  }

  /**
   * Sync stock data from Tally
   * POST /api/stock/tally/sync
   */
  async syncFromTally(req, res) {
    try {
      const updatedBy = req.user?.username || req.user?.name || 'tally-sync';
      
      const result = await tallyService.syncStockFromTally(updatedBy);
      
      res.json(result);
    } catch (error) {
      logger.error('Error syncing stock from Tally:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to sync stock from Tally',
        error: error.message
      });
    }
  }

  /**
   * Fetch stock items from Tally (without syncing to DB)
   * GET /api/stock/tally/items
   */
  async fetchTallyStockItems(req, res) {
    try {
      const stockItems = await tallyService.fetchStockItems();
      
      res.json({
        success: true,
        data: stockItems,
        count: stockItems.length
      });
    } catch (error) {
      logger.error('Error fetching stock items from Tally:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch stock items from Tally',
        error: error.message
      });
    }
  }

  /**
   * LEVEL 1: Get top-level stock groups
   * GET /api/stock/tally/groups
   */
  async getTopLevelGroups(req, res) {
    try {
      const groups = await tallyService.fetchTopLevelGroups();
      
      res.json({
        success: true,
        data: groups,
        count: groups.length
      });
    } catch (error) {
      logger.error('Error fetching top-level groups:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch top-level groups',
        error: error.message
      });
    }
  }

  /**
   * LEVEL 2 & 3: Get subgroups for a parent group
   * GET /api/stock/tally/groups/:groupName
   */
  async getSubGroups(req, res) {
    try {
      const { groupName } = req.params;
      const groups = await tallyService.fetchStockGroupsByParent(groupName);
      
      res.json({
        success: true,
        data: groups,
        count: groups.length,
        parentGroup: groupName
      });
    } catch (error) {
      logger.error(`Error fetching subgroups for ${req.params.groupName}:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch subgroups',
        error: error.message
      });
    }
  }

  /**
   * LEVEL 4: Get stock items for a specific group (with EXPLODEFLAG)
   * GET /api/stock/tally/items/:groupName
   */
  async getStockItemsByGroup(req, res) {
    try {
      const { groupName } = req.params;
      const items = await tallyService.fetchStockItemsByGroup(groupName);
      
      res.json({
        success: true,
        data: items,
        count: items.length,
        group: groupName
      });
    } catch (error) {
      logger.error(`Error fetching stock items for ${req.params.groupName}:`, error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch stock items',
        error: error.message
      });
    }
  }

  /**
   * Get raw Tally response for debugging
   * GET /api/stock/tally/debug?group=GROUP_NAME&explode=true
   */
  async debugTallyResponse(req, res) {
    try {
      const axios = require('axios');
      const tallyUrl = `http://${process.env.TALLY_HOST || '192.168.31.61'}:${process.env.TALLY_PORT || '9000'}`;
      
      const today = new Date();
      const toDateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const fromDateStr = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
        .toISOString().slice(0, 10).replace(/-/g, '');

      const { group, explode } = req.query;
      
      let staticVars = `<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVCHARSET>UTF-8</SVCHARSET>
          <SVFROMDATE>${fromDateStr}</SVFROMDATE>
          <SVTODATE>${toDateStr}</SVTODATE>`;
      
      if (group) {
        staticVars += `\n          <SVSTOCKGROUP>${group}</SVSTOCKGROUP>`;
      }
      
      if (explode === 'true' || explode === 'yes') {
        staticVars += `\n          <EXPLODEFLAG>Yes</EXPLODEFLAG>`;
      }

      const xmlRequest = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Stock Summary</REPORTNAME>
        <STATICVARIABLES>
          ${staticVars}
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

      logger.info(`Debug request to Tally: ${tallyUrl}`);
      logger.info(`XML Request: ${xmlRequest}`);

      const response = await axios.post(tallyUrl, xmlRequest, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        timeout: 30000,
        validateStatus: () => true, // Accept any status code
        responseType: 'text',
        responseEncoding: 'utf8'
      });

      // Check if response is valid XML
      const responseData = response.data || '';
      const isXML = typeof responseData === 'string' && responseData.trim().startsWith('<');

      if (isXML) {
        // Valid XML - send as XML
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.send(responseData);
      } else {
        // Not XML - return as JSON with details
        res.json({
          success: false,
          message: 'Tally response is not valid XML',
          tallyUrl: tallyUrl,
          statusCode: response.status,
          responseType: typeof responseData,
          responseLength: responseData ? responseData.length : 0,
          rawResponse: responseData ? String(responseData).substring(0, 1000) : 'Empty response',
          requestXml: xmlRequest,
          error: 'Response does not start with < (not valid XML)'
        });
      }
    } catch (error) {
      logger.error('Error getting debug response from Tally:', error);
      
      // Return detailed error information
      const errorInfo = {
        success: false,
        message: error.message || 'Failed to get debug response',
        error: error.message,
        code: error.code,
        tallyUrl: `http://${process.env.TALLY_HOST || '192.168.31.61'}:${process.env.TALLY_PORT || '9000'}`,
        requestXml: req.query.group 
          ? `Request with group: ${req.query.group}, explode: ${req.query.explode}`
          : 'Request without group filter'
      };

      if (error.code === 'ECONNREFUSED') {
        errorInfo.message = `Cannot connect to Tally at ${errorInfo.tallyUrl}. Check if Tally is running and Tally.NET is enabled.`;
      } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        errorInfo.message = `Tally request timeout. Ensure Tally is running and responding on ${errorInfo.tallyUrl}`;
      }

      res.status(500).json(errorInfo);
    }
  }
}

module.exports = new StockController();



