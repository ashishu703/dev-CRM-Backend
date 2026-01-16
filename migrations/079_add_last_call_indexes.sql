-- Add indexes for last call leads optimization
-- These indexes improve query performance for filtering last call leads

-- Indexes for salesperson_leads follow-up fields
DO $$
BEGIN
    -- Index for follow_up_date (used in date filtering)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_salesperson_leads_follow_up_date') THEN
        CREATE INDEX idx_salesperson_leads_follow_up_date ON salesperson_leads(follow_up_date) WHERE follow_up_date IS NOT NULL;
    END IF;

    -- Composite index for follow_up_status and follow_up_remark (used together in filtering)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_salesperson_leads_follow_up_composite') THEN
        CREATE INDEX idx_salesperson_leads_follow_up_composite ON salesperson_leads(follow_up_status, follow_up_remark) 
        WHERE (follow_up_status IS NOT NULL AND follow_up_status != '' AND follow_up_status != 'N/A')
           OR (follow_up_remark IS NOT NULL AND follow_up_remark != '' AND follow_up_remark != 'N/A');
    END IF;

    -- Index for sales_status with next_meeting filter
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_salesperson_leads_next_meeting') THEN
        CREATE INDEX idx_salesperson_leads_next_meeting ON salesperson_leads(sales_status, sales_status_remark) 
        WHERE sales_status = 'next_meeting' AND sales_status_remark IS NOT NULL;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creating salesperson_leads indexes: %', SQLERRM;
END $$;

-- Indexes for marketing_meetings date fields
DO $$
BEGIN
    -- Index for meeting_date (used as next_meeting_date)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_marketing_meetings_meeting_date_last_call') THEN
        CREATE INDEX idx_marketing_meetings_meeting_date_last_call ON marketing_meetings(meeting_date) 
        WHERE meeting_date IS NOT NULL;
    END IF;

    -- Index for scheduled_date
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_marketing_meetings_scheduled_date_last_call') THEN
        CREATE INDEX idx_marketing_meetings_scheduled_date_last_call ON marketing_meetings(scheduled_date) 
        WHERE scheduled_date IS NOT NULL;
    END IF;

    -- Composite index for lead_id and customer_id lookups
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_marketing_meetings_lead_customer') THEN
        CREATE INDEX idx_marketing_meetings_lead_customer ON marketing_meetings(lead_id, customer_id) 
        WHERE lead_id IS NOT NULL OR customer_id IS NOT NULL;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creating marketing_meetings indexes: %', SQLERRM;
END $$;

-- Index for department_head_leads updated_at (used in ordering)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_department_head_leads_updated_at') THEN
        CREATE INDEX idx_department_head_leads_updated_at ON department_head_leads(updated_at DESC) 
        WHERE COALESCE(is_deleted, FALSE) = FALSE;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creating department_head_leads updated_at index: %', SQLERRM;
END $$;

-- Composite index for department_head_leads joins with salesperson_leads
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_dhl_sl_join') THEN
        CREATE INDEX idx_dhl_sl_join ON department_head_leads(id) 
        WHERE COALESCE(is_deleted, FALSE) = FALSE;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creating join index: %', SQLERRM;
END $$;
