const BaseModel = require('./BaseModel');

class Organization extends BaseModel {
  static TABLE_NAME = 'organizations';

  static async create(data) {
    const {
      organizationName,
      legalName,
      logoUrl,
      streetAddress,
      city,
      state,
      zipCode,
      country = 'India',
      phone,
      email,
      website,
      gstin,
      pan,
      tan,
      currency = 'INR',
      fiscalYearStart = 'April',
      fiscalYearEnd = 'March',
      timezone = 'Asia/Kolkata',
      createdBy
    } = data;

    const result = await this.query(
      `INSERT INTO ${this.TABLE_NAME} (
        organization_name,
        legal_name,
        logo_url,
        street_address,
        city,
        state,
        zip_code,
        country,
        phone,
        email,
        website,
        gstin,
        pan,
        tan,
        currency,
        fiscal_year_start,
        fiscal_year_end,
        timezone,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *`,
      [
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
        createdBy
      ]
    );

    return new this(result.rows[0]);
  }

  static async findById(id) {
    return super.findById(this.TABLE_NAME, id);
  }

  static async findAllActive() {
    const result = await this.query(
      `SELECT * FROM ${this.TABLE_NAME}
       WHERE is_active = true
       ORDER BY organization_name ASC`
    );
    return result.rows.map((row) => new this(row));
  }

  static async findAllWithPagination(filters = {}, pagination = {}) {
    return super.findAll(this.TABLE_NAME, filters, pagination);
  }

  async update(updateData, updatedBy) {
    const mapped = {};
    if (updateData.organizationName !== undefined) mapped.organization_name = updateData.organizationName;
    if (updateData.legalName !== undefined) mapped.legal_name = updateData.legalName;
    if (updateData.logoUrl !== undefined) mapped.logo_url = updateData.logoUrl;

    if (updateData.streetAddress !== undefined) mapped.street_address = updateData.streetAddress;
    if (updateData.city !== undefined) mapped.city = updateData.city;
    if (updateData.state !== undefined) mapped.state = updateData.state;
    if (updateData.zipCode !== undefined) mapped.zip_code = updateData.zipCode;
    if (updateData.country !== undefined) mapped.country = updateData.country;

    if (updateData.phone !== undefined) mapped.phone = updateData.phone;
    if (updateData.email !== undefined) mapped.email = updateData.email;
    if (updateData.website !== undefined) mapped.website = updateData.website;

    if (updateData.gstin !== undefined) mapped.gstin = updateData.gstin;
    if (updateData.pan !== undefined) mapped.pan = updateData.pan;
    if (updateData.tan !== undefined) mapped.tan = updateData.tan;

    if (updateData.currency !== undefined) mapped.currency = updateData.currency;
    if (updateData.fiscalYearStart !== undefined) mapped.fiscal_year_start = updateData.fiscalYearStart;
    if (updateData.fiscalYearEnd !== undefined) mapped.fiscal_year_end = updateData.fiscalYearEnd;

    if (updateData.timezone !== undefined) mapped.timezone = updateData.timezone;
    if (updateData.isActive !== undefined) mapped.is_active = updateData.isActive;

    return super.update(this.constructor.TABLE_NAME, mapped, updatedBy);
  }

  async softDelete(updatedBy) {
    return this.update({ isActive: false }, updatedBy);
  }
}

module.exports = Organization;


