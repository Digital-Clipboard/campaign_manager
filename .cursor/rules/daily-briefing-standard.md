---
description: Standardized structure and methodology for daily briefings to maintain focus on strategic priorities and daily tasks.
globs:
  - 'docs/daily_briefings/*.md'
alwaysApply: true
---

# Daily Briefing Standard

This rule defines the standardized structure and methodology for creating and maintaining daily briefings.

## Purpose
The daily briefing is a structured personal organizational tool designed to:
1. Maintain focus on top strategic priorities
2. Organize specific daily action items
3. Track ongoing follow-up items
4. Prepare for scheduled meetings
5. Structure the day for maximum productivity

## Standard Structure

### 1. Strategic Focus (Always First Section)
* Limited to 3-5 highest-level strategic priorities
* Each item represents a major work stream requiring ongoing attention
* Format: Brief title followed by 1-2 bullet points on current status/next actions
* Items remain consistent day-to-day unless strategic priorities genuinely shift
* Example format:
  ```
  ## Strategic Focus
  *   **Product Release Cycle:**
      *   Current focus on Immersion 574 deployment and stabilization.
  *   **Revenue Operations:**
      *   Stripe account optimization and meeting billing integration.
  *   **Compliance & Governance:**
      *   SOC 2 certification preparation with 75 outstanding items.
  ```

### 2. Today's Top Priorities
* 3-7 specific, actionable items requiring attention TODAY
* Format: Clear title, current status indicator, specific action steps
* Status indicators: 🟢 ON TRACK, 🟠 NEEDS ATTENTION, 🔴 BLOCKED, ✅ COMPLETED
* Example format:
  ```
  ## Today's Top Priorities
  *   **Immersion 574 Release:**
      *   **Status:** 🟠 NEEDS ATTENTION - [specific reason]
      *   **Actions:**
          * [Specific action step 1]
          * [Specific action step 2]
  ```

### 3. Previous Day's Priorities
* Only show items from previous day
* Clearly mark completion status
* Only include completed or explicitly carried-over items
* Remove completed items from active tracking sections

### 4. Open Follow-Up Items
* Items requiring follow-up from previous days that are NOT completed
* Only include actively tracked items (not completed ones)
* Include expected follow-up date if known
* Format: Clear title, specific next action, and status

### 5. Today's Meetings & Preparation
* List all scheduled meetings for the day
* Include preparation items for each meeting
* Note any required materials or pre-reading

### 6. Projects in Development
* Organized by category/department
* Include specific next actions for each project
* Use numbered lists for easy reference
* Mark status clearly (✅ COMPLETED, 🔴 BLOCKED, etc.)
* Only include active projects requiring attention

### 7. Important Upcoming Dates
* Focus on the next 7-14 days
* Highlight TODAY items first
* Include preparation deadlines for future meetings/deliverables

### 8. Notes Section
* Brief contextual notes about key priorities
* Insights or considerations for the day
* Limited to 5-7 bullet points maximum
* Focus on actionable insights

### 9. Communication Templates (Optional)
* Pre-written communication drafts for expected team updates
* Clear titles for each template
* Only include if specific communications are planned for the day

## Status Indicators
* ✅ COMPLETED - Task finished
* 🟢 ON TRACK - Proceeding as planned
* 🟠 NEEDS ATTENTION - Requires specific focus but not blocked
* 🔴 BLOCKED - Cannot proceed without resolving specific blocker
* ⏳ WAITING - Dependent on external input/approval
* 🆕 NEW - Recently added item

## Item Management Rules
* **Completed Items:**
  * Mark with ✅ COMPLETED in the current day's briefing
  * Move to "Previous Day's Priorities" in next day's briefing
  * Remove from active tracking sections
* **Blocked Items:**
  * Mark with 🔴 BLOCKED and specific blocker
  * Keep in active tracking until resolved
* **Delegated Items:**
  * Note who item is delegated to and expected completion
  * Track in follow-up section until confirmed complete

## Final Notes
* Keep briefings concise and actionable
* Focus on tracking and accountability
* Use consistent formatting to enable rapid scanning
* Daily briefings should be named: `YYYY-MM-DD-daily-briefing.md`
* Weekly review should clean up stale items and reassess strategic priorities
