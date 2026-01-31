-- Add RFP ID to PI templates so it displays (Lead -> RFP -> Quotation -> PI)
-- Inserts "RFP ID: {{rfpId}}" after invoice/PI number when template doesn't already have rfpId

UPDATE document_templates
SET
  html_content = regexp_replace(
    COALESCE(html_content, ''),
    '(\{\{invoiceNumber\}\}|\{\{piNumber\}\}|\{\{invoice_number\}\}|\{\{pi_number\}\})',
    E'\\1<br>RFP ID: {{rfpId}}'
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE
  template_type = 'pi'
  AND is_active = true
  AND (html_content ~ '\{\{invoiceNumber\}\}' OR html_content ~ '\{\{piNumber\}\}' OR html_content ~ '\{\{invoice_number\}\}' OR html_content ~ '\{\{pi_number\}\}')
  AND html_content !~ '\{\{rfpId\}\}'
  AND html_content !~ '\{\{masterRfpId\}\}'
  AND html_content !~ 'rfp_requests\.(id|rfp_id)';
