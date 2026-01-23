const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const logger = require('../utils/logger');
const Stock = require('../models/Stock');

class TallyService {
  constructor() {
    // Tally connection configuration from environment variables
    this.tallyHost = process.env.TALLY_HOST || '192.168.31.61';
    this.tallyPort = process.env.TALLY_PORT || '9000';
    this.tallyUrl = `http://${this.tallyHost}:${this.tallyPort}`;
    
    logger.info(`Tally Service initialized - Connecting to: ${this.tallyUrl}`);
    
    // XML Parser configuration
    // IMPORTANT: isArray handles how arrays are created from XML
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      trimValues: true,
      parseTrueNumberOnly: false,
      isArray: (name, jPath, isLeafNode, isAttribute) => {
        // Force arrays for elements that can appear multiple times
        const arrayElements = ['DSPACCNAME', 'DSPSTKINFO', 'SSBATCHNAME', 'ENVELOPE', 'STOCKITEM', 'STOCKGROUP'];
        return arrayElements.includes(name);
      }
    });
  }

  /**
   * Parse numbers that may contain commas/currency/extra text.
   * Examples: "1,000.00", "₹5.39", "477,230", "-12.5"
   * @param {string|number|null|undefined} input
   * @returns {number}
   */
  parseLooseNumber(input) {
    if (input === null || input === undefined) return 0;
    if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
    const s = String(input)
      .replace(/\u00A0/g, ' ') // non-breaking spaces
      .replace(/,/g, '') // thousands separators
      .trim();
    if (!s) return 0;
    // Keep digits, dot and minus only
    const cleaned = s.replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Count indentation level (leading whitespace) from a display name.
   * Tally often uses spaces to denote nesting.
   * @param {string} s
   * @returns {number} count of leading spaces (tabs treated as 2 spaces)
   */
  countLeadingIndent(s) {
    const str = String(s || '').replace(/\u00A0/g, ' ');
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === ' ') count += 1;
      else if (ch === '\t') count += 2;
      else break;
    }
    return count;
  }

  /**
   * Check if Tally is connected and responding
   * @returns {Promise<boolean>}
   */
  async checkConnection() {
    try {
      const xmlRequest = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>LicenseInfo</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCHARSET>UTF-8</SVCHARSET>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

      const response = await axios.post(this.tallyUrl, xmlRequest, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        timeout: 5000,
        responseType: 'text',
        responseEncoding: 'utf8'
      });

      // Check if response is valid XML
      const responseData = response.data || '';
      const cleaned = responseData.trim();
      const xmlStart = cleaned.indexOf('<');
      
      if (xmlStart >= 0) {
        return response.status === 200;
      }
      
      return false;
    } catch (error) {
      logger.error('Tally connection check failed:', error.message);
      return false;
    }
  }

  /**
   * Send XML request to Tally and get response
   * @param {string} xmlRequest - XML request string
   * @param {number} timeout - Request timeout in ms (default: 30000)
   * @returns {Promise<Object>} Parsed XML response
   */
  async sendTallyRequest(xmlRequest, timeout = 30000) {
    try {
      const response = await axios.post(this.tallyUrl, xmlRequest, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        timeout: timeout,
        responseType: 'text', // Force text response, not binary
        responseEncoding: 'utf8' // Explicit UTF-8 encoding
      });

      // Clean response - remove BOM and garbage characters
      let responseData = response.data || '';
      
      // Remove BOM (Byte Order Mark) if present
      if (responseData.charCodeAt(0) === 0xFEFF) {
        responseData = responseData.slice(1);
      }
      
      // Remove any non-XML characters before first <
      const xmlStart = responseData.indexOf('<');
      if (xmlStart > 0) {
        responseData = responseData.substring(xmlStart);
      }
      
      // Validate it's XML
      if (!responseData.trim().startsWith('<')) {
        logger.error('Invalid XML response from Tally. First 200 chars:', responseData.substring(0, 200));
        throw new Error('Tally returned non-XML response. Check encoding settings.');
      }

      // Check for error response
      if (responseData.includes('<LINEERROR>')) {
        const errorMatch = responseData.match(/<LINEERROR>(.*?)<\/LINEERROR>/);
        const errorMsg = errorMatch ? errorMatch[1] : 'Unknown Tally error';
        throw new Error(`Tally Error: ${errorMsg}`);
      }

      const parsedData = this.xmlParser.parse(responseData);
      return parsedData;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Tally request timeout. Ensure Tally is running on ${this.tallyUrl}`);
      }
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to Tally at ${this.tallyUrl}. Check if Tally is running and Tally.NET is enabled.`);
      }
      throw error;
    }
  }

  /**
   * LEVEL 1: Fetch top-level stock groups (Finished Goods, Raw Material, etc.)
   * Uses: REPORTNAME = "Stock Summary" (no filters)
   * @returns {Promise<Array>} Array of stock groups
   */
  async fetchTopLevelGroups() {
    try {
      const today = new Date();
      const toDateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const fromDateStr = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
        .toISOString().slice(0, 10).replace(/-/g, '');

      const xmlRequest = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Stock Summary</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVCHARSET>UTF-8</SVCHARSET>
          <SVFROMDATE>${fromDateStr}</SVFROMDATE>
          <SVTODATE>${toDateStr}</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

      logger.info('Fetching top-level stock groups from Tally');
      const parsedData = await this.sendTallyRequest(xmlRequest);

      // Extract stock groups from response
      const groups = this.extractStockGroups(parsedData);
      logger.info(`Found ${groups.length} top-level stock groups`);
      return groups;
    } catch (error) {
      logger.error('Error fetching top-level groups:', error.message);
      throw error;
    }
  }

  /**
   * LEVEL 2 & 3: Fetch stock groups/subgroups for a given parent group
   * Uses: REPORTNAME = "Stock Summary" with SVSTOCKGROUP filter
   * @param {string} stockGroup - Parent stock group name
   * @returns {Promise<Array>} Array of subgroups
   */
  async fetchStockGroupsByParent(stockGroup) {
    try {
      const today = new Date();
      const toDateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const fromDateStr = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
        .toISOString().slice(0, 10).replace(/-/g, '');

      const xmlRequest = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Stock Summary</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVCHARSET>UTF-8</SVCHARSET>
          <SVSTOCKGROUP>${stockGroup}</SVSTOCKGROUP>
          <SVFROMDATE>${fromDateStr}</SVFROMDATE>
          <SVTODATE>${toDateStr}</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

      logger.info(`Fetching subgroups for stock group: ${stockGroup}`);
      const parsedData = await this.sendTallyRequest(xmlRequest);

      // Extract stock groups from response
      const groups = this.extractStockGroups(parsedData);
      logger.info(`Found ${groups.length} subgroups for ${stockGroup}`);
      return groups;
    } catch (error) {
      logger.error(`Error fetching subgroups for ${stockGroup}:`, error.message);
      throw error;
    }
  }

  /**
   * LEVEL 4: Fetch individual stock items with quantity, rate, value
   * Uses: REPORTNAME = "Stock Summary" with SVSTOCKGROUP + EXPLODEFLAG=Yes
   * 
   * IMPORTANT: EXPLODEFLAG=Yes is REQUIRED to get individual items instead of group totals.
   * Without it, Tally returns only group-level summary data.
   * 
   * @param {string} stockGroup - Stock group name (e.g., "ANOCAB AL SINGLE CORE")
   * @returns {Promise<Array>} Array of stock items with details
   */
  async fetchStockItemsByGroup(stockGroup) {
    try {
      const today = new Date();
      const toDateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const fromDateStr = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
        .toISOString().slice(0, 10).replace(/-/g, '');

      const xmlRequest = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Stock Summary</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVCHARSET>UTF-8</SVCHARSET>
          <SVSTOCKGROUP>${stockGroup}</SVSTOCKGROUP>
          <SVFROMDATE>${fromDateStr}</SVFROMDATE>
          <SVTODATE>${toDateStr}</SVTODATE>
          <EXPLODEFLAG>Yes</EXPLODEFLAG>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

      logger.info(`Fetching stock items for group: ${stockGroup} (with EXPLODEFLAG=Yes)`);
      const parsedData = await this.sendTallyRequest(xmlRequest);

      // Extract stock items from response
      const items = this.extractStockItems(parsedData);
      logger.info(`Found ${items.length} stock items for ${stockGroup}`);
      return items;
    } catch (error) {
      logger.error(`Error fetching stock items for ${stockGroup}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract stock groups from Tally XML response
   * Handles both STOCKGROUP format and DSP* format (Display format)
   * @param {Object} parsedData - Parsed XML data
   * @returns {Array} Array of stock group objects
   */
  extractStockGroups(parsedData) {
    try {
      const groups = [];
      
      const envelope = parsedData.ENVELOPE;
      if (!envelope) {
        return groups;
      }

      // Check for DSP* format (Display format - what Tally actually returns)
      if (envelope.DSPACCNAME) {
        return this.extractDSPFormatGroups(envelope);
      }

      // Check for standard EXPORTDATA format
      if (envelope.BODY && envelope.BODY.EXPORTDATA) {
        const exportData = envelope.BODY.EXPORTDATA;
        const tallyMessage = exportData.TALLYMESSAGE;
        
        if (!tallyMessage) {
          return groups;
        }

        // Get stock groups - handle both single and array
        let stockGroups = tallyMessage.STOCKGROUP || [];
        if (!Array.isArray(stockGroups)) {
          stockGroups = stockGroups ? [stockGroups] : [];
        }

        for (const group of stockGroups) {
          if (!group) continue;

          const name = group.NAME || group['@NAME'] || '';
          if (name) {
            groups.push({
              name: name.trim(),
              alias: group.ALIAS || '',
              parent: group.PARENT || ''
            });
          }
        }
      }

      return groups;
    } catch (error) {
      logger.error('Error extracting stock groups:', error.message);
      return [];
    }
  }

  /**
   * Extract groups from DSP* format (Display format)
   * Groups are items that have DSPSTKINFO but empty DSPCLQTY (only have DSPCLAMTA)
   * @param {Object} envelope - Parsed ENVELOPE object
   * @returns {Array} Array of stock group objects
   */
  extractDSPFormatGroups(envelope) {
    const groups = [];
    
    try {
      let dspNames = envelope.DSPACCNAME || [];
      if (!Array.isArray(dspNames)) {
        dspNames = dspNames ? [dspNames] : [];
      }

      let stkInfoArray = envelope.DSPSTKINFO || [];
      if (!Array.isArray(stkInfoArray)) {
        stkInfoArray = stkInfoArray ? [stkInfoArray] : [];
      }

      // Process items - groups are those with empty DSPCLQTY but have DSPCLAMTA
      for (let i = 0; i < dspNames.length; i++) {
        const dspName = dspNames[i];
        const name = dspName?.DSPDISPNAME || dspName || '';
        
        if (!name || typeof name !== 'string' || name.trim() === '') continue;

        const stkInfo = stkInfoArray[i];
        if (!stkInfo) continue;

        const stkCl = stkInfo.DSPSTKCL || stkInfo;
        if (!stkCl) continue;

        // Check if this is a group (has empty or no quantity, but has amount)
        const qtyStr = stkCl.DSPCLQTY || '';
        const hasAmount = stkCl.DSPCLAMTA && String(stkCl.DSPCLAMTA).trim() !== '';
        
        // If quantity is empty but has amount, it's a group
        if ((!qtyStr || qtyStr.trim() === '') && hasAmount) {
          groups.push({
            name: String(name).trim(),
            alias: '',
            parent: ''
          });
        }
      }

      logger.info(`Extracted ${groups.length} groups from DSP format`);
    } catch (error) {
      logger.error('Error extracting DSP format groups:', error.message);
    }

    return groups;
  }

  /**
   * Extract stock items from Tally XML response
   * Handles both STOCKITEM format and DSP* format (Display format)
   * Only works when EXPLODEFLAG=Yes is used in request
   * @param {Object} parsedData - Parsed XML data
   * @returns {Array} Array of stock item objects
   */
  extractStockItems(parsedData) {
    try {
      const stockItems = [];
      
      let envelope = parsedData.ENVELOPE;
      if (!envelope) {
        logger.warn('No ENVELOPE found in parsed data');
        return stockItems;
      }

      // Handle case where ENVELOPE is an array (multiple envelopes in response)
      // XML parser sometimes returns arrays when there are multiple elements
      if (Array.isArray(envelope)) {
        logger.info(`ENVELOPE is an array with ${envelope.length} elements, merging...`);
        // Merge all envelopes into one
        const mergedEnvelope = {
          DSPACCNAME: [],
          DSPSTKINFO: [],
          SSBATCHNAME: []
        };
        
        for (const env of envelope) {
          if (env && typeof env === 'object') {
            if (env.DSPACCNAME) {
              const names = Array.isArray(env.DSPACCNAME) ? env.DSPACCNAME : [env.DSPACCNAME];
              mergedEnvelope.DSPACCNAME.push(...names.filter(n => n));
            }
            if (env.DSPSTKINFO) {
              const infos = Array.isArray(env.DSPSTKINFO) ? env.DSPSTKINFO : [env.DSPSTKINFO];
              mergedEnvelope.DSPSTKINFO.push(...infos.filter(i => i));
            }
            if (env.SSBATCHNAME) {
              const batches = Array.isArray(env.SSBATCHNAME) ? env.SSBATCHNAME : [env.SSBATCHNAME];
              mergedEnvelope.SSBATCHNAME.push(...batches.filter(b => b));
            }
          }
        }
        
        envelope = mergedEnvelope;
        logger.info(`Merged envelope: ${mergedEnvelope.DSPACCNAME.length} names, ${mergedEnvelope.DSPSTKINFO.length} stock info`);
      } else if (envelope && typeof envelope === 'object') {
        // Check if envelope has numeric keys (array-like object from XML parser)
        // This happens when XML parser treats multiple elements as array with numeric indices
        const keys = Object.keys(envelope);
        const hasNumericKeys = keys.length > 0 && keys.every(k => !isNaN(parseInt(k)));
        
        if (hasNumericKeys) {
          logger.info(`ENVELOPE has numeric keys (${keys.length} keys), treating as flat array of elements...`);
          // The XML parser has flattened the structure - elements are at root level with numeric keys
          // Keys like "0", "1", "2" contain DSPACCNAME, DSPSTKINFO, SSBATCHNAME elements
          const mergedEnvelope = {
            DSPACCNAME: [],
            DSPSTKINFO: [],
            SSBATCHNAME: []
          };
          
          // Sort keys numerically and process in order
          const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
          
          for (const key of sortedKeys) {
            const element = envelope[key];
            if (!element || typeof element !== 'object') continue;
            
            // Check what type of element this is based on its structure
            if (element.DSPDISPNAME !== undefined) {
              // This is a DSPACCNAME element
              mergedEnvelope.DSPACCNAME.push(element);
            } else if (element.DSPSTKCL !== undefined || element.DSPCLQTY !== undefined || element.DSPCLRATE !== undefined || element.DSPCLAMTA !== undefined) {
              // This is a DSPSTKINFO element
              mergedEnvelope.DSPSTKINFO.push(element);
            } else if (element.SSBATCH !== undefined || element.SSGODOWN !== undefined) {
              // This is a SSBATCHNAME element - skip it
              mergedEnvelope.SSBATCHNAME.push(element);
            } else {
              // Might be a wrapper - check for nested structures
              const elementKeys = Object.keys(element);
              if (elementKeys.includes('DSPDISPNAME')) {
                mergedEnvelope.DSPACCNAME.push(element);
              } else if (elementKeys.some(k => k.includes('DSPCL') || k.includes('DSPSTK'))) {
                mergedEnvelope.DSPSTKINFO.push(element);
              }
            }
          }
          
          envelope = mergedEnvelope;
          logger.info(`Converted envelope: ${mergedEnvelope.DSPACCNAME.length} names, ${mergedEnvelope.DSPSTKINFO.length} stock info`);
        } else {
          // Normal object structure - check if it has the expected keys
          if (!envelope.DSPACCNAME && !envelope.DSPSTKINFO) {
            // Might be a different structure - log for debugging
            logger.warn('ENVELOPE structure unexpected, keys:', Object.keys(envelope));
            logger.warn('Sample envelope:', JSON.stringify(envelope).substring(0, 500));
          }
        }
      }

      // Check for DSP* format (Display format - what Tally actually returns)
      if (envelope && envelope.DSPACCNAME) {
        return this.extractDSPFormatItems(envelope);
      }

      // Check for standard EXPORTDATA format
      if (envelope.BODY && envelope.BODY.EXPORTDATA) {
        const exportData = envelope.BODY.EXPORTDATA;
        const tallyMessage = exportData.TALLYMESSAGE;
        
        if (!tallyMessage) {
          return stockItems;
        }

        // Get stock items - handle both single and array
        let items = tallyMessage.STOCKITEM || [];
        if (!Array.isArray(items)) {
          items = items ? [items] : [];
        }

        for (const item of items) {
          const extracted = this.extractItemFromStandardFormat(item);
          if (extracted) {
            stockItems.push(extracted);
          }
        }
      }

      return stockItems;
    } catch (error) {
      logger.error('Error extracting stock items:', error.message);
      logger.error('Stack trace:', error.stack);
      return [];
    }
  }

  /**
   * Extract items from DSP* format (Display format) with hierarchical structure
   * Tally returns: DSPACCNAME, DSPSTKINFO, DSPCLQTY, DSPCLRATE, DSPCLAMTA
   * Structure: ENVELOPE contains alternating DSPACCNAME and DSPSTKINFO
   * Builds hierarchical structure: Groups -> Subgroups -> Items
   * @param {Object} envelope - Parsed ENVELOPE object
   * @param {string} parentGroup - Parent group name (e.g., "Finished Goods")
   * @returns {Array} Array of stock items with group/subgroup info
   */
  extractDSPFormatItems(envelope, parentGroup = '') {
    const stockItems = [];
    
    try {
      // Handle case where envelope might be an array (from XML parser)
      if (Array.isArray(envelope)) {
        logger.warn('Envelope is an array, merging...');
        // This shouldn't happen if we handled it in extractStockItems, but just in case
        const merged = { DSPACCNAME: [], DSPSTKINFO: [] };
        for (const env of envelope) {
          if (env.DSPACCNAME) {
            const names = Array.isArray(env.DSPACCNAME) ? env.DSPACCNAME : [env.DSPACCNAME];
            merged.DSPACCNAME.push(...names);
          }
          if (env.DSPSTKINFO) {
            const infos = Array.isArray(env.DSPSTKINFO) ? env.DSPSTKINFO : [env.DSPSTKINFO];
            merged.DSPSTKINFO.push(...infos);
          }
        }
        envelope = merged;
      }

      // Handle both single item and array of items
      let dspNames = envelope.DSPACCNAME || [];
      if (!Array.isArray(dspNames)) {
        dspNames = dspNames ? [dspNames] : [];
      }

      let stkInfoArray = envelope.DSPSTKINFO || [];
      if (!Array.isArray(stkInfoArray)) {
        stkInfoArray = stkInfoArray ? [stkInfoArray] : [];
      }

      // Filter out SSBATCHNAME entries and invalid entries from stkInfoArray
      stkInfoArray = stkInfoArray.filter(item => {
        if (!item || typeof item !== 'object') return false;
        // Keep items that have stock-related fields
        return (
          item.DSPSTKCL || 
          item.DSPCLQTY !== undefined || 
          item.DSPCLRATE !== undefined || 
          item.DSPCLAMTA !== undefined ||
          Object.keys(item).some(k => k && k.includes && k.includes('DSPCL'))
        );
      });

      // Log for debugging
      logger.info(`Extracting DSP format: ${dspNames.length} names, ${stkInfoArray.length} stock info entries (after filtering)`);
      
      // Debug: Log first few names to see structure
      if (dspNames.length > 0) {
        logger.info('First DSPACCNAME sample:', JSON.stringify(dspNames[0]).substring(0, 200));
      }
      if (stkInfoArray.length > 0) {
        logger.info('First DSPSTKINFO sample:', JSON.stringify(stkInfoArray[0]).substring(0, 200));
      }

      // Track hierarchy using indentation-based stack.
      // stack[0] = top-level group (Finished Goods, Raw Material, etc.)
      // stack[1..] = nested stock groups/subgroups (Conductors > Solar Cables > ...)
      const topLevelGroups = ['finished goods', 'raw material', 'packing material', 'asset', 'scrap'];
      const headerStack = [];
      const ensureTopGroup = (fallback) => {
        if (headerStack.length === 0) {
          const g = (fallback || 'Finished Goods').trim();
          headerStack.push({ name: g, indent: -1 });
        }
      };
      if (parentGroup && String(parentGroup).trim() !== '') {
        headerStack.push({ name: String(parentGroup).trim(), indent: -1 });
      }

      // Process items - match DSPACCNAME with corresponding DSPSTKINFO
      // IMPORTANT: Handle SSBATCHNAME elements that might be in between
      let stkInfoIndex = 0; // Track stock info index separately
      
      for (let i = 0; i < dspNames.length; i++) {
        const dspName = dspNames[i];
        
        // Extract name - handle different structures
        let rawName = '';
        if (typeof dspName === 'string') {
          rawName = dspName;
        } else if (dspName && typeof dspName === 'object') {
          rawName = dspName.DSPDISPNAME || dspName.name || dspName['@DSPDISPNAME'] || '';
        }
        
        if (!rawName || typeof rawName !== 'string' || rawName.trim() === '') {
          continue;
        }
        
        const indent = this.countLeadingIndent(rawName);
        const name = rawName.trim();

        // Get corresponding stock info - use separate index to handle SSBATCHNAME
        // Skip SSBATCHNAME entries in stkInfoArray
        let stkInfo = null;
        let foundStkInfo = false;
        
        while (stkInfoIndex < stkInfoArray.length) {
          const candidate = stkInfoArray[stkInfoIndex];
          
          // Check if this is a valid DSPSTKINFO (has DSPSTKCL or stock-related fields)
          if (candidate && typeof candidate === 'object') {
            // Check for DSPSTKCL wrapper or direct fields
            if (candidate.DSPSTKCL || 
                candidate.DSPCLQTY !== undefined || 
                candidate.DSPCLRATE !== undefined || 
                candidate.DSPCLAMTA !== undefined ||
                (Object.keys(candidate).some(k => k && typeof k === 'string' && k.includes('DSPCL')))) {
              stkInfo = candidate;
              stkInfoIndex++;
              foundStkInfo = true;
              break;
            }
          }
          // Skip SSBATCHNAME or other non-stock-info entries
          stkInfoIndex++;
        }
        
        if (!foundStkInfo || !stkInfo) {
          // No matching stock info found - might be a group header
          // Check if it's a top-level group
          const lower = name.toLowerCase();
          if (topLevelGroups.includes(lower)) {
            // Reset hierarchy for a new top-level group
            headerStack.length = 0;
            headerStack.push({ name, indent: -1 });
          }
          continue;
        }

        // Extract DSPSTKCL from stkInfo - handle different structures
        let stkCl = null;
        if (stkInfo.DSPSTKCL) {
          stkCl = stkInfo.DSPSTKCL;
        } else if (stkInfo.DSPCLQTY !== undefined || stkInfo.DSPCLRATE !== undefined || stkInfo.DSPCLAMTA !== undefined) {
          // Stock info is directly in stkInfo (flat structure)
          stkCl = stkInfo;
        } else {
          // Try stkInfo itself
          stkCl = stkInfo;
        }
        
        if (!stkCl || typeof stkCl !== 'object') {
          continue;
        }
        
        // Extract quantity from DSPCLQTY (format: "100.0000 MTR" or "43254.00 KG")
        let quantity = 0;
        let unit = 'meters';
        
        // Get quantity string - handle different structures
        let qtyStr = '';
        if (stkCl.DSPCLQTY !== undefined) {
          qtyStr = String(stkCl.DSPCLQTY || '').trim();
        } else if (stkCl['DSPCLQTY'] !== undefined) {
          qtyStr = String(stkCl['DSPCLQTY'] || '').trim();
        }
        
        // Extract rate/value strings early (used for group header detection too)
        let rateStr = '';
        if (stkCl.DSPCLRATE !== undefined) {
          rateStr = String(stkCl.DSPCLRATE || '').trim();
        }

        let valueStr = '';
        if (stkCl.DSPCLAMTA !== undefined) {
          valueStr = String(stkCl.DSPCLAMTA || '').trim();
        }

        // Detect group headers:
        // - Often: qty empty but amount present
        // - Sometimes: qty empty AND rate empty AND amount empty (still a header line)
        const hasAmount = valueStr && valueStr !== '';
        const isGroupHeader = (!qtyStr || qtyStr === '') && (!rateStr || rateStr === '') && (hasAmount || (!valueStr || valueStr === ''));
        
        if (isGroupHeader) {
          const lower = name.toLowerCase();
          if (topLevelGroups.includes(lower)) {
            headerStack.length = 0;
            headerStack.push({ name, indent: -1 });
          } else {
            ensureTopGroup(parentGroup);
            // Maintain stack based on indentation (nesting)
            while (headerStack.length > 1 && indent <= headerStack[headerStack.length - 1].indent) {
              headerStack.pop();
            }
            headerStack.push({ name, indent });
          }
          continue; // Skip headers, only process leaf items
        }

        // This is an item - extract data
        // IMPORTANT: Include items even with 0 quantity (they might have value/rate)
        // Only skip if both quantity AND value are empty
        const hasValue = valueStr && valueStr !== '';
        if ((!qtyStr || qtyStr === '') && !hasValue) {
          continue; // Skip items without quantity AND value
        }

        // Parse "100.0000 MTR" or "43254.00 KG" -> quantity: 100, unit: "MTR"
        const qtyMatch = String(qtyStr).trim().match(/([\d.-]+)\s*(\w+)/);
        if (qtyMatch) {
          const qtyValue = this.parseLooseNumber(qtyMatch[1]);
          quantity = Math.abs(qtyValue); // Use absolute value for quantity
          const rawUnit = qtyMatch[2].trim().toUpperCase();
          // Normalize units: MTR -> meters, keep others as is
          if (rawUnit === 'MTR' || rawUnit === 'METERS' || rawUnit === 'M') {
            unit = 'meters';
          } else if (rawUnit === 'KM' || rawUnit === 'KILOMETERS') {
            unit = 'km';
          } else if (rawUnit === 'KG' || rawUnit === 'KGS' || rawUnit === 'KILOGRAMS') {
            unit = 'kg';
          } else if (rawUnit === 'PCS' || rawUnit === 'PIECES' || rawUnit === 'NOS' || rawUnit === 'NUMBERS') {
            unit = 'pcs';
          } else {
            unit = rawUnit.toLowerCase();
          }
        } else {
          quantity = Math.abs(this.parseLooseNumber(qtyStr));
          unit = 'meters'; // Default unit
        }

        // Extract rate from DSPCLRATE (sanitize commas/currency)
        let rate = 0;
        if (rateStr && rateStr !== '') {
          rate = Math.abs(this.parseLooseNumber(rateStr));
        }

        // Extract value from DSPCLAMTA (amount) (sanitize commas/currency)
        let value = 0;
        if (valueStr && valueStr !== '') {
          value = Math.abs(this.parseLooseNumber(valueStr));
        } else if (quantity > 0 && rate > 0) {
          // Calculate value if not provided
          value = quantity * rate;
        }

        // Determine stock status based on quantity
        // Convert units for comparison (normalize to a common unit)
        let quantityForStatus = quantity;
        if (unit === 'km') {
          quantityForStatus = quantity * 1000; // Convert KM to meters
        } else if (unit === 'meters' || unit === 'mtr') {
          quantityForStatus = quantity; // Meters
        } else if (unit === 'kg' || unit === 'kgs') {
          quantityForStatus = quantity; // Keep KG as is (different unit type)
        } else if (unit === 'pcs' || unit === 'nos') {
          quantityForStatus = quantity; // Keep pieces as is
        }

        let status = 'OUT_OF_STOCK';
        // For meters/km: > 500 = available, > 0 = limited
        // For kg/pcs: > 100 = available, > 0 = limited (adjust thresholds as needed)
        if (unit === 'kg' || unit === 'pcs' || unit === 'nos') {
          if (quantityForStatus > 100) {
            status = 'AVAILABLE';
          } else if (quantityForStatus > 0) {
            status = 'LIMITED';
          }
        } else {
          // For meters/km
          if (quantityForStatus > 500) {
            status = 'AVAILABLE';
          } else if (quantityForStatus > 0) {
            status = 'LIMITED';
          }
        }

        ensureTopGroup(parentGroup);
        const groupName = headerStack[0]?.name || parentGroup || 'Finished Goods';
        const subgroupPath = headerStack.length > 1
          ? headerStack.slice(1).map(h => h.name).join(' > ')
          : '';

        stockItems.push({
          group: groupName,
          subgroup: subgroupPath,
          itemName: String(name).trim(),
          quantity: quantity,
          unit: unit,
          rate: rate,
          value: value,
          status: status
        });
      }

      logger.info(`Extracted ${stockItems.length} items from DSP format (Group: ${parentGroup})`);
      if (stockItems.length === 0 && dspNames.length > 0) {
        logger.warn(`No items extracted despite ${dspNames.length} names found.`);
        logger.warn(`First few names:`, dspNames.slice(0, 3).map((n, idx) => {
          try {
            if (typeof n === 'string') return n;
            if (n && typeof n === 'object') {
              return n.DSPDISPNAME || JSON.stringify(n).substring(0, 100);
            }
            return String(n).substring(0, 50);
          } catch (e) {
            return `[Error parsing name ${idx}]`;
          }
        }));
        logger.warn(`Stock info array length: ${stkInfoArray.length}, Processed index: ${stkInfoIndex}`);
        if (stkInfoArray.length > 0) {
          logger.warn(`First stock info sample:`, JSON.stringify(stkInfoArray[0]).substring(0, 200));
        }
      }
    } catch (error) {
      const errorMsg = error?.message || String(error) || 'Unknown error';
      const errorStack = error?.stack || 'No stack trace';
      logger.error('Error extracting DSP format items:', errorMsg);
      logger.error('Error stack:', errorStack);
      logger.error('Error name:', error?.name || 'Unknown');
      logger.error('Error toString:', String(error));
      
      // Log envelope structure for debugging
      if (envelope) {
        try {
          const envKeys = Object.keys(envelope);
          logger.error('Envelope keys:', envKeys);
          logger.error('Envelope is array?', Array.isArray(envelope));
          logger.error('DSPACCNAME type:', Array.isArray(envelope.DSPACCNAME) ? 'array' : typeof envelope.DSPACCNAME);
          logger.error('DSPACCNAME length:', Array.isArray(envelope.DSPACCNAME) ? envelope.DSPACCNAME.length : 'N/A');
          logger.error('DSPSTKINFO type:', Array.isArray(envelope.DSPSTKINFO) ? 'array' : typeof envelope.DSPSTKINFO);
          logger.error('DSPSTKINFO length:', Array.isArray(envelope.DSPSTKINFO) ? envelope.DSPSTKINFO.length : 'N/A');
          
          // Try to log a sample of the actual data
          if (envelope.DSPACCNAME && envelope.DSPACCNAME.length > 0) {
            logger.error('Sample DSPACCNAME[0]:', JSON.stringify(envelope.DSPACCNAME[0]).substring(0, 300));
          }
        } catch (logError) {
          logger.error('Error logging envelope details:', logError?.message || String(logError));
        }
      }
    }

    return stockItems;
  }

  /**
   * Extract item from standard STOCKITEM format
   * @param {Object} item - Stock item object
   * @returns {Object|null} Extracted item or null
   */
  extractItemFromStandardFormat(item) {
    if (!item) return null;

    const name = item.NAME || item['@NAME'] || '';
    if (!name) return null;

    // Extract quantity - try multiple field names
    let quantity = 0;
    if (item.CLOSINGBALANCE) {
      const balance = item.CLOSINGBALANCE;
      if (typeof balance === 'object' && balance.NUMBER) {
        quantity = parseFloat(balance.NUMBER) || 0;
      } else {
        quantity = parseFloat(balance) || 0;
      }
    } else if (item['CLOSINGBALANCE.NUMBER']) {
      quantity = parseFloat(item['CLOSINGBALANCE.NUMBER']) || 0;
    }

    // Extract unit
    let unit = 'meters';
    if (item.BASEUNITS) {
      unit = String(item.BASEUNITS).trim();
    } else if (item.UOM) {
      unit = String(item.UOM).trim();
    } else if (item.UNIT) {
      unit = String(item.UNIT).trim();
    }

    // Extract rate
    let rate = 0;
    if (item.RATE) {
      rate = parseFloat(item.RATE) || 0;
    } else if (item['RATE.NUMBER']) {
      rate = parseFloat(item['RATE.NUMBER']) || 0;
    }

    // Extract value
    let value = 0;
    if (item.CLOSINGVALUE) {
      const closingValue = item.CLOSINGVALUE;
      if (typeof closingValue === 'object' && closingValue.NUMBER) {
        value = parseFloat(closingValue.NUMBER) || 0;
      } else {
        value = parseFloat(closingValue) || 0;
      }
    } else if (item['CLOSINGVALUE.NUMBER']) {
      value = parseFloat(item['CLOSINGVALUE.NUMBER']) || 0;
    } else if (quantity > 0 && rate > 0) {
      value = quantity * rate;
    }

    // Determine stock status
    let status = 'OUT_OF_STOCK';
    if (quantity > 500) {
      status = 'AVAILABLE';
    } else if (quantity > 0) {
      status = 'LIMITED';
    }

    return {
      group: item.STOCKGROUP || item.PARENT || '',
      itemName: name.trim(),
      quantity: quantity,
      unit: unit,
      rate: rate,
      value: value,
      status: status
    };
  }

  /**
   * Fetch ALL stock items from all groups (for initial sync)
   * Fetches from ALL top-level groups and their subgroups
   * @returns {Promise<Array>} Array of all stock items
   */
  async fetchAllStockItems() {
    try {
      logger.info('Starting full stock sync - fetching all items from all groups');
      
      const allItems = [];
      
      // Step 1: Get top-level groups
      const topGroups = await this.fetchTopLevelGroups();
      logger.info(`Found ${topGroups.length} top-level groups: ${topGroups.map(g => g.name).join(', ')}`);
      
      if (topGroups.length === 0) {
        // If no groups found via standard method, try direct fetch from "Finished Goods"
        logger.info('No groups found, trying direct fetch from Finished Goods');
        try {
          const items = await this.fetchStockItemsByGroup('Finished Goods');
          allItems.push(...items);
          logger.info(`Fetched ${items.length} items directly from Finished Goods`);
        } catch (error) {
          logger.warn('Direct fetch from Finished Goods failed:', error.message);
        }
      } else {
        // Step 2: Fetch items from each top-level group
        for (const group of topGroups) {
          try {
            logger.info(`Fetching items from group: ${group.name}`);
            const items = await this.fetchStockItemsByGroup(group.name);
            allItems.push(...items);
            logger.info(`Fetched ${items.length} items from ${group.name}`);
            
            // Step 3: Also try to get subgroups and fetch their items
            try {
              const subgroups = await this.fetchStockGroupsByParent(group.name);
              logger.info(`Found ${subgroups.length} subgroups under ${group.name}`);
              
              for (const subgroup of subgroups) {
                try {
                  const subgroupItems = await this.fetchStockItemsByGroup(subgroup.name);
                  allItems.push(...subgroupItems);
                  logger.info(`Fetched ${subgroupItems.length} items from subgroup ${subgroup.name}`);
                } catch (error) {
                  logger.warn(`Failed to fetch items for subgroup ${subgroup.name}:`, error.message);
                }
              }
            } catch (error) {
              logger.warn(`Failed to fetch subgroups for ${group.name}:`, error.message);
            }
          } catch (error) {
            logger.warn(`Failed to fetch items for group ${group.name}:`, error.message);
          }
        }
      }

      // Remove duplicates (same item name, group, subgroup)
      const uniqueItems = [];
      const seen = new Set();
      
      for (const item of allItems) {
        const key = `${item.itemName}|${item.group}|${item.subgroup}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueItems.push(item);
        }
      }

      logger.info(`Fetched total ${uniqueItems.length} unique stock items from all groups (${allItems.length} before deduplication)`);
      return uniqueItems;
    } catch (error) {
      logger.error('Error fetching all stock items:', error.message);
      logger.error('Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   * Uses new fetchAllStockItems internally
   * @returns {Promise<Array>}
   */
  async fetchStockItems() {
    return this.fetchAllStockItems();
  }

  /**
   * Sync stock data from Tally to database
   * Fetches all items and saves to database
   * IMPORTANT: Saves ALL items from Tally with their actual names (no name matching)
   * @param {string} updatedBy - Username of the person triggering sync
   * @returns {Promise<Object>}
   */
  async syncStockFromTally(updatedBy = 'tally-sync') {
    try {
      // Check Tally connection
      const isConnected = await this.checkConnection();
      if (!isConnected) {
        throw new Error('Cannot connect to Tally. Please ensure Tally is running and configured correctly.');
      }

      logger.info('Fetching all stock items from Tally...');
      
      // Fetch all stock items from Tally - get from ALL groups
      const stockItems = await this.fetchAllStockItems();
      
      logger.info(`Fetched ${stockItems.length} items from Tally`);
      
      if (stockItems.length === 0) {
        logger.warn('No stock items found in Tally response');
        return {
          success: true,
          message: 'No stock items found in Tally',
          synced: 0,
          failed: 0
        };
      }

      // Log first few items for debugging
      if (stockItems.length > 0) {
        logger.info('Sample items from Tally:', stockItems.slice(0, 5).map(item => ({
          name: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          group: item.group,
          subgroup: item.subgroup
        })));
      }

      // Sync each item to database
      let syncedCount = 0;
      let failedCount = 0;
      const errors = [];

      for (const item of stockItems) {
        try {
          if (!item.itemName || item.itemName.trim() === '') {
            logger.warn('Skipping item with empty name');
            continue;
          }

          // Convert status to database format (lowercase)
          const dbStatus = item.status.toLowerCase();
          
          // Save item with its actual Tally name (no matching required)
          await Stock.upsertStock({
            product_name: item.itemName.trim(),
            quantity: item.quantity || 0,
            unit: item.unit || 'meters',
            rate: item.rate || 0,
            value: item.value || 0,
            group: item.group || '',
            subgroup: item.subgroup || '',
            status: dbStatus,
            updated_by: updatedBy
          });
          syncedCount++;
        } catch (error) {
          failedCount++;
          errors.push({
            product: item.itemName,
            error: error.message
          });
          logger.error(`Failed to sync stock for ${item.itemName}:`, error.message);
        }
      }

      logger.info(`Stock sync completed: ${syncedCount} synced, ${failedCount} failed`);

      return {
        success: true,
        message: `Stock sync completed: ${syncedCount} items synced, ${failedCount} failed`,
        synced: syncedCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Limit errors in response
      };
    } catch (error) {
      logger.error('Stock sync from Tally failed:', error.message);
      logger.error('Stack:', error.stack);
      throw error;
    }
  }
}

module.exports = new TallyService();
