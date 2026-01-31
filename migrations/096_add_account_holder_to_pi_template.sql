-- Add A/c Holder (Account Holder Name) to PI templates for bank details section
-- Inserts "A/c Holder: {{bankDetails.accountHolderName}}" before bank name so it displays

UPDATE document_templates
SET
  html_content = regexp_replace(
    COALESCE(html_content, ''),
    '\{\{bankDetails\.bankName\}\}',
    'A/c Holder: {{bankDetails.accountHolderName}}<br>{{bankDetails.bankName}}',
    'g'
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE
  template_type = 'pi'
  AND is_active = true
  AND html_content ~ '\{\{bankDetails\.bankName\}\}'
  AND html_content !~ '\{\{bankDetails\.accountHolderName\}\}'
  AND html_content !~ '\{\{bankDetails\.account_holder_name\}\}';
