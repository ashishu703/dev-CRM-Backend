-- Remove gap in product details: when remark is empty, no extra line/space should show.
-- Also remove empty table rows that create gaps between product entries.
-- 1) productName + <br> + remark: only show <br> and remark when remark exists (no gap when empty)
-- 2) All {{this.remark}}: wrap in conditional so empty remark renders nothing
-- 3) Remove empty <tr> rows (spacer rows between products)

UPDATE document_templates
SET html_content = regexp_replace(
  regexp_replace(
    regexp_replace(
      COALESCE(html_content, ''),
      E'\\{\\{this\\.productName\\}\\}(<br\\s*/?>)\\s*\\{\\{this\\.remark\\}\\}',
      E'{{this.productName}}{{#if this.remark}}\\1{{this.remark}}{{/if}}',
      'gi'
    ),
    E'\\{\\{this\\.remark\\}\\}',
    E'{{#if this.remark}}{{this.remark}}{{/if}}',
    'g'
  ),
  '</tr>\s*<tr[^>]*>(\s|<td[^>]*>\s*</td>\s*)*</tr>',
  '</tr>',
  'g'
),
updated_at = CURRENT_TIMESTAMP
WHERE template_type = 'quotation' AND is_active = true;

-- Second pass: remove any remaining empty tr rows
UPDATE document_templates
SET html_content = regexp_replace(
  html_content,
  '</tr>\s*<tr[^>]*>(\s|<td[^>]*>\s*</td>\s*)*</tr>',
  '</tr>',
  'g'
),
updated_at = CURRENT_TIMESTAMP
WHERE template_type = 'quotation' AND is_active = true;
