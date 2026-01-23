const Enquiry = require('../models/Enquiry');
const DepartmentUser = require('../models/DepartmentUser');
const BaseController = require('./BaseController');

class EnquiryController extends BaseController {
  /**
   * Get enquiries for department head
   * Filters by department salespersons automatically
   */
  static async getForDepartmentHead(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { page = 1, limit = 50, startDate, endDate, enquiryDate } = req.query;
      const departmentHead = req.user;

      // Get all salespersons in this department
      const departmentSalespersons = await DepartmentUser.getWithHeadDetails(
        {
          companyName: departmentHead.companyName,
          departmentType: departmentHead.departmentType,
          headUserId: departmentHead.id,
          isActive: true
        },
        { page: 1, limit: 1000 }
      );

      const salespersonUsernames = (departmentSalespersons.data || departmentSalespersons.users || [])
        .map(user => user.username || user.email)
        .filter(Boolean);
      
      // Ensure department head can see enquiries they created/own
      const headIdentifiers = [departmentHead.username, departmentHead.email].filter(Boolean);
      const departmentIdentifiers = Array.from(new Set([...salespersonUsernames, ...headIdentifiers]));

      const filters = {
        departmentSalespersons: departmentIdentifiers,
        startDate: startDate || null,
        endDate: endDate || null,
        enquiryDate: enquiryDate || null
      };

      const pagination = { page: parseInt(page), limit: parseInt(limit) };

      // Get grouped by date for better organization
      const grouped = await Enquiry.getGroupedByDate(filters);

      // Also get paginated data
      const paginated = await Enquiry.getForDepartmentHead(filters, pagination);

      return {
        enquiries: paginated.data,
        groupedByDate: grouped,
        pagination: paginated.pagination
      };
    }, 'Enquiries retrieved successfully', 'Failed to get enquiries');
  }

  /**
   * Update an enquiry
   */
  static async update(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;
      const updateData = req.body;

      const enquiry = await Enquiry.getById(id);
      if (!enquiry) {
        throw new Error('Enquiry not found');
      }

      const updated = await Enquiry.updateById(id, updateData);
      if (!updated) {
        throw new Error('Failed to update enquiry');
      }

      return { enquiry: updated };
    }, 'Enquiry updated successfully', 'Failed to update enquiry');
  }

  /**
   * Delete an enquiry
   */
  static async delete(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { id } = req.params;

      const enquiry = await Enquiry.getById(id);
      if (!enquiry) {
        throw new Error('Enquiry not found');
      }

      const deleted = await Enquiry.deleteById(id);
      if (!deleted) {
        throw new Error('Failed to delete enquiry');
      }

      return { message: 'Enquiry deleted successfully' };
    }, 'Enquiry deleted successfully', 'Failed to delete enquiry');
  }

  /**
   * Get all enquiries for SuperAdmin (all companies)
   */
  static async getAllForSuperAdmin(req, res) {
    await BaseController.handleAsyncOperation(res, async () => {
      const { page = 1, limit = 50, startDate, endDate, enquiryDate } = req.query;

      const filters = {
        startDate: startDate || null,
        endDate: endDate || null,
        enquiryDate: enquiryDate || null
      };

      const pagination = { page: parseInt(page), limit: parseInt(limit) };

      // Get grouped by date for better organization
      const grouped = await Enquiry.getGroupedByDateForSuperAdmin(filters);

      // Also get paginated data
      const paginated = await Enquiry.getAllForSuperAdmin(filters, pagination);

      return {
        enquiries: paginated.data,
        groupedByDate: grouped,
        pagination: paginated.pagination
      };
    }, 'Enquiries retrieved successfully', 'Failed to get enquiries');
  }
}

module.exports = EnquiryController;

