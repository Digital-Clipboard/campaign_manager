-- Add suppressed_contacts table for bounce management
-- Purpose: Track all bounced/suppressed email contacts with audit trail
-- Created: 2025-10-01

CREATE TABLE suppressed_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact identifiers
  contact_id BIGINT NOT NULL UNIQUE, -- Mailjet Contact ID
  email VARCHAR(255) NOT NULL UNIQUE,

  -- Suppression details
  suppression_type VARCHAR(50) NOT NULL, -- 'hard_bounce', 'soft_bounce', 'spam_complaint', 'unsubscribe', 'manual'
  reason TEXT NOT NULL, -- Detailed reason for suppression
  bounce_count INT DEFAULT 1, -- Number of times this contact has bounced
  first_bounce_date TIMESTAMPTZ, -- When first bounce occurred
  last_bounce_date TIMESTAMPTZ, -- When most recent bounce occurred

  -- Source tracking
  source_campaign_id VARCHAR(255), -- Campaign ID where bounce occurred (from Mailjet)
  source_batch VARCHAR(100), -- Which batch list (e.g., 'campaign_batch_001')
  source_round INT, -- Which round (1, 2, 3, etc.)

  -- Mailjet integration
  mailjet_list_id BIGINT, -- ID of suppression list in Mailjet
  mailjet_blocked BOOLEAN DEFAULT false, -- Whether Mailjet has blocked this contact
  mailjet_error_code VARCHAR(50), -- Error code from Mailjet

  -- Status and lifecycle
  status VARCHAR(50) DEFAULT 'active' NOT NULL, -- 'active', 'revalidated', 'removed'
  is_permanent BOOLEAN DEFAULT true, -- Whether suppression is permanent
  revalidation_eligible_at TIMESTAMPTZ, -- When contact can be reconsidered (180 days)
  revalidated_at TIMESTAMPTZ, -- If contact was revalidated

  -- Audit trail
  suppressed_by VARCHAR(255) DEFAULT 'system', -- Who/what suppressed this contact
  notes TEXT, -- Additional notes
  metadata JSONB, -- Flexible storage for additional data

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_suppressed_contacts_email ON suppressed_contacts(email);
CREATE INDEX idx_suppressed_contacts_contact_id ON suppressed_contacts(contact_id);
CREATE INDEX idx_suppressed_contacts_type ON suppressed_contacts(suppression_type);
CREATE INDEX idx_suppressed_contacts_status ON suppressed_contacts(status);
CREATE INDEX idx_suppressed_contacts_source_batch ON suppressed_contacts(source_batch);
CREATE INDEX idx_suppressed_contacts_created_at ON suppressed_contacts(created_at DESC);
CREATE INDEX idx_suppressed_contacts_revalidation ON suppressed_contacts(revalidation_eligible_at) WHERE is_permanent = false;

-- Composite indexes for common queries
CREATE INDEX idx_suppressed_contacts_type_status ON suppressed_contacts(suppression_type, status);
CREATE INDEX idx_suppressed_contacts_batch_round ON suppressed_contacts(source_batch, source_round);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_suppressed_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_suppressed_contacts_updated_at
  BEFORE UPDATE ON suppressed_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_suppressed_contacts_updated_at();

-- Comments for documentation
COMMENT ON TABLE suppressed_contacts IS 'Tracks all suppressed email contacts from bounces, spam complaints, and unsubscribes';
COMMENT ON COLUMN suppressed_contacts.contact_id IS 'Mailjet Contact ID - unique identifier';
COMMENT ON COLUMN suppressed_contacts.suppression_type IS 'Type of suppression: hard_bounce, soft_bounce, spam_complaint, unsubscribe, manual';
COMMENT ON COLUMN suppressed_contacts.bounce_count IS 'Number of consecutive bounces before suppression';
COMMENT ON COLUMN suppressed_contacts.is_permanent IS 'If false, contact may be eligible for revalidation after 180 days';
COMMENT ON COLUMN suppressed_contacts.revalidation_eligible_at IS 'Date when contact becomes eligible for revalidation (180 days from suppression)';
