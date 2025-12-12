const BaseController = require('./BaseController');
const Organization = require('../models/Organization');

class OrganizationController extends BaseController {
  static async create(req, res) {
    await BaseController.handleAsyncOperation(
      res,
      async () => {
        const {
          organizationName,
          legalName,
          logoUrl,
          streetAddress,
          city,
          state,
          zipCode,
          country,
          phone,
          email,
          website,
          gstin,
          pan,
          tan,
          currency,
          fiscalYearStart,
          fiscalYearEnd,
          timezone
        } = req.body;

        BaseController.validateRequiredFields(
          ['organizationName', 'legalName', 'streetAddress', 'city', 'state', 'zipCode'],
          req.body
        );

        const organization = await Organization.create({
          organizationName,
          legalName,
          logoUrl,
          streetAddress,
          city,
          state,
          zipCode,
          country,
          phone,
          email,
          website,
          gstin,
          pan,
          tan,
          currency,
          fiscalYearStart,
          fiscalYearEnd,
          timezone,
          createdBy: req.user?.email || req.user?.username || 'system'
        });

        return { organization: organization.toJSON() };
      },
      'Organization created successfully',
      'Failed to create organization'
    );
  }

  static async getAll(req, res) {
    await BaseController.handleAsyncOperation(
      res,
      async () => {
        const { page = 1, limit = 50, isActive } = req.query;
        const filters = {};
        if (isActive !== undefined) {
          const active =
            typeof isActive === 'boolean'
              ? isActive
              : String(isActive).toLowerCase() === 'true';
          filters.is_active = active;
        }

        const result = await Organization.findAllWithPagination(filters, {
          page: parseInt(page),
          limit: parseInt(limit)
        });

        return {
          organizations: result.data.map((org) => org.toJSON()),
          pagination: result.pagination
        };
      },
      'Organizations retrieved successfully',
      'Failed to get organizations'
    );
  }

  static async getActiveList(req, res) {
    await BaseController.handleAsyncOperation(
      res,
      async () => {
        const organizations = await Organization.findAllActive();
        // Return minimal data for dropdowns
        const items = organizations.map((org) => ({
          id: org.id,
          name: org.organization_name,
          legalName: org.legal_name,
          logoUrl: org.logo_url
        }));
        return { organizations: items };
      },
      'Active organizations retrieved successfully',
      'Failed to get active organizations'
    );
  }

  static async update(req, res) {
    await BaseController.handleAsyncOperation(
      res,
      async () => {
        const { id } = req.params;
        const updateData = req.body;

        const organization = await Organization.findById(id);
        if (!organization) {
          throw new Error('Organization not found');
        }

        const updated = await organization.update(updateData, req.user?.email || req.user?.username || 'system');
        return { organization: updated.toJSON() };
      },
      'Organization updated successfully',
      'Failed to update organization'
    );
  }

  static async softDelete(req, res) {
    await BaseController.handleAsyncOperation(
      res,
      async () => {
        const { id } = req.params;
        const organization = await Organization.findById(id);
        if (!organization) {
          throw new Error('Organization not found');
        }

        await organization.softDelete(req.user?.email || req.user?.username || 'system');
        return { message: 'Organization deleted successfully' };
      },
      'Organization deleted successfully',
      'Failed to delete organization'
    );
  }
}

module.exports = OrganizationController;


