-- PostgreSQL initialization script for Campaign Manager
-- This script sets up the database with proper extensions and initial configuration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search extension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom functions for campaign management

-- Function to calculate campaign readiness score
CREATE OR REPLACE FUNCTION calculate_readiness_score(campaign_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_tasks INTEGER;
    completed_tasks INTEGER;
    pending_approvals INTEGER;
    score INTEGER;
BEGIN
    -- Count total tasks
    SELECT COUNT(*) INTO total_tasks
    FROM tasks
    WHERE "campaignId" = campaign_id;

    -- Count completed tasks
    SELECT COUNT(*) INTO completed_tasks
    FROM tasks
    WHERE "campaignId" = campaign_id AND status = 'completed';

    -- Count pending approvals
    SELECT COUNT(*) INTO pending_approvals
    FROM approvals
    WHERE "campaignId" = campaign_id AND status = 'pending';

    -- Calculate score (0-100)
    IF total_tasks = 0 THEN
        score := 0;
    ELSE
        score := ROUND((completed_tasks::FLOAT / total_tasks::FLOAT) * 100);

        -- Reduce score if there are pending approvals
        IF pending_approvals > 0 THEN
            score := GREATEST(0, score - (pending_approvals * 10));
        END IF;
    END IF;

    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to check for scheduling conflicts
CREATE OR REPLACE FUNCTION check_scheduling_conflicts(target_date TIMESTAMPTZ, buffer_hours INTEGER DEFAULT 24)
RETURNS TABLE(conflicting_campaign_id UUID, conflicting_campaign_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.name
    FROM campaigns c
    WHERE c."targetDate" BETWEEN (target_date - INTERVAL '1 hour' * buffer_hours)
                              AND (target_date + INTERVAL '1 hour' * buffer_hours)
      AND c.status NOT IN ('cancelled', 'completed');
END;
$$ LANGUAGE plpgsql;

-- Trigger to update readiness score when tasks change
CREATE OR REPLACE FUNCTION update_campaign_readiness()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE campaigns
    SET "readinessScore" = calculate_readiness_score(NEW."campaignId")
    WHERE id = NEW."campaignId";

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance (these will be added by Prisma migrations too)
-- But having them here ensures they exist from the start

-- Activity log cleanup function (to be called by a scheduled job)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM activity_logs
    WHERE "createdAt" < NOW() - INTERVAL '1 day' * days_to_keep;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO campaign_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO campaign_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO campaign_user;