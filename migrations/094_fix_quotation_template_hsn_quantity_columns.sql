-- Fix Live Preview: HSN/SAC column was showing quantity, QUANTITY column was blank
-- Templates had {{this.quantity}} in HSN cell and {{this.length}} in QUANTITY cell (legacy).
-- Swap so HSN shows {{this.hsn}} and QUANTITY shows {{this.quantity}}.
-- Uses placeholder to avoid double-replacement.

UPDATE document_templates
SET
  html_content = regexp_replace(
    regexp_replace(
      regexp_replace(
        COALESCE(html_content, ''),
        '\{\{this\.quantity\}\}',
        '{{_HSN_QTY_SWAP_}}',
        'g'
      ),
      '\{\{this\.length\}\}',
      '{{this.quantity}}',
      'g'
    ),
    '\{\{_HSN_QTY_SWAP_\}\}',
    '{{this.hsn}}',
    'g'
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE
  template_type = 'quotation'
  AND is_active = true
  AND (
    html_content ~ '\{\{this\.quantity\}\}'
    OR html_content ~ '\{\{this\.length\}\}'
  );
