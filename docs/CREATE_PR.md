# Create Pull Request

## Quick Link to Create PR

Click this link to create the PR on GitHub:

**To Staging**:
```
https://github.com/Digital-Clipboard/campaign_manager/compare/staging...feature/ai-list-quality-assessment?expand=1
```

**To Main** (after staging approval):
```
https://github.com/Digital-Clipboard/campaign_manager/compare/main...feature/ai-list-quality-assessment?expand=1
```

## PR Title
```
feat: AI-powered list quality assessment for post-launch notifications
```

## PR Description
Copy the content from `.github/PR_DESCRIPTION.md` or use this abbreviated version:

---

### Summary
Implements AI agent to analyze email list quality comparing Round 1 vs Round 2, with focus on hard bounce rates. Includes corrected notification timing for 10:00 AM London launch.

### Key Features
- 🤖 **AI List Quality Agent** using Google Gemini 2.0 Flash
- 📊 **Enhanced Post-Launch Notifications** with AI assessment
- ⏰ **Corrected Timing**: 8:45, 9:00, 9:15 AM UTC (15-min intervals)
- 🚀 **New Launch Notification** at campaign start

### Testing
All tests passing:
```bash
npx tsx scripts/test-notifications.ts
```

### Configuration
Requires `GEMINI_API_KEY` environment variable. Falls back gracefully if not set.

### No Breaking Changes
- ✅ Backward compatible
- ✅ AI failures handled gracefully
- ✅ Ready for deployment

**Ready to merge to staging for testing!**

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## After Creating PR

1. **Review** the PR on GitHub
2. **Run staging tests** after merge to staging
3. **Verify** notifications work correctly
4. **Merge** to main when ready
5. **Deploy** to production

## Commands to Merge Locally (if preferred)

```bash
# Switch to staging branch
git checkout staging

# Merge feature branch
git merge feature/ai-list-quality-assessment

# Push to origin
git push origin staging

# Deploy to Heroku staging
git push heroku-staging staging:main
```