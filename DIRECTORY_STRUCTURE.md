# Campaign Manager - Directory Structure

**Last Updated**: October 1, 2025

This document provides an overview of the campaign_manager directory organization.

---

## 📁 Root Directory

Clean root with only essential project files:

```
campaign_manager/
├── README.md                      # Main project documentation
├── CAMPAIGN_CHANGELOG.md          # High-level operation timeline
├── package.json                   # NPM dependencies
├── tsconfig.json                  # TypeScript configuration
├── docker-compose.yml             # Docker setup
├── .env.example                   # Environment template
└── [other config files]           # .eslintrc, .prettierrc, etc.
```

**Principle**: Root contains only configuration and top-level documentation.

---

## 📚 Documentation Structure

### Core Documentation (`docs/`)
Numbered technical documentation in order:

```
docs/
├── README.md                              # Documentation index
├── 00_brainstorm.md                       # Initial planning
├── 01_workflow.md                         # Campaign processes
├── 02_architecture.md                     # System architecture
├── 03_api_specification.md                # API documentation
├── 04_tdd_specification.md                # Testing guide
├── 05_milestone_implementation.md         # Development roadmap
├── 06_repository_setup.md                 # Setup instructions
├── 07_heroku_scheduler.md                 # Deployment
├── 08_multi_agent_implementation.md       # AI agents
├── 09_user_segmentation_strategy.md       # Email segmentation
├── 10_bounce_management_guide.md          # Bounce cleanup
├── MCP_API_DOCUMENTATION.md               # MCP protocol
├── MCP_INTEGRATION_REQUIREMENTS.md        # Integration specs
├── IMPLEMENTATION_STATUS.md               # Current status
└── CREATE_PR.md                           # PR process
```

### Quick Start Guides (`docs/guides/`)
Practical how-to guides:

```
docs/guides/
├── BOUNCE_CLEANUP_QUICKSTART.md    # 15-min bounce cleanup guide
├── SIMPLE_BOUNCE_CLEANUP.md        # 5-min simple cleanup
└── LOGGING_STRUCTURE.md            # Logging system explained
```

### Archive (`docs/archive/`)
Historical documentation:

```
docs/archive/
├── ROUND2_LAUNCH_READY.md          # Round 2 setup (Sept 2025)
└── ROUND3_SETUP_GUIDE.md           # Round 3 setup (Oct 2025)
```

---

## 📊 Operations & Logs

### Campaign Records (`records/`)
Human-readable campaign history:

```
records/
├── README.md                       # Logging system guide
└── campaigns/
    ├── campaign-7758947928.md      # Round 1 record
    └── campaign-7758985090.md      # Round 2 record
```

### Automated Logs (`logs/`)
Machine-readable operation logs:

```
logs/
└── bounce-cleanup/
    ├── 2025-10-01-campaign-7758947928.json
    └── 2025-10-01-campaign-7758985090.json
```

---

## 🔧 Source Code

### Application Code (`src/`)

```
src/
├── api/                    # API routes and controllers
├── services/              # Business logic
├── jobs/                  # Background job processors
├── workers/               # Queue workers
├── integrations/          # External service clients
├── utils/                 # Utility functions
├── types/                 # TypeScript type definitions
└── index.ts               # Application entry point
```

### Scripts (`scripts/`)
Operational automation scripts:

```
scripts/
├── simple-bounce-cleanup.js        # Bounce cleanup (main)
├── list-recent-campaigns.js        # List campaigns
├── find-campaign-ids.js            # Find campaign IDs
├── create-batch-list.js            # Create batch with suppression
├── create-round2-list.js           # Legacy batch creation
├── create-round3-list.js           # Legacy batch creation
└── [other scripts...]              # Various utilities
```

---

## 🧪 Testing

```
tests/
├── unit/                  # Unit tests
├── integration/          # Integration tests
├── mocks/                # Mock data and services
└── setup.ts              # Test configuration
```

---

## 🗄️ Database

```
prisma/
├── schema.prisma         # Database schema
├── migrations/           # Database migrations
└── seed.ts               # Seed data
```

---

## 🐳 Deployment

```
├── Dockerfile            # Docker container definition
├── docker-compose.yml    # Local development setup
├── Procfile              # Heroku process definition
├── prod_config.env       # Production environment
└── staging_config.env    # Staging environment
```

---

## 📋 Directory Organization Principles

### 1. **Separation of Concerns**
- **Code** → `src/`
- **Docs** → `docs/`
- **Operations** → `records/`, `logs/`
- **Scripts** → `scripts/`
- **Tests** → `tests/`

### 2. **Documentation Hierarchy**
- **Root**: High-level overview (`README.md`, `CAMPAIGN_CHANGELOG.md`)
- **docs/**: Technical documentation (numbered)
- **docs/guides/**: Quick start guides (practical)
- **docs/archive/**: Historical reference

### 3. **Logging Structure**
- **Automated logs**: `logs/` (JSON, machine-readable)
- **Campaign records**: `records/` (Markdown, human-readable)
- **Timeline**: Root `CAMPAIGN_CHANGELOG.md` (summary)

### 4. **Clean Root**
- Only config files and top-level docs
- No operational scripts or temp files
- Everything has a proper home

---

## 🔍 Finding Files

### Documentation
```bash
# Core docs
ls docs/*.md

# Guides
ls docs/guides/

# Archive
ls docs/archive/
```

### Operations
```bash
# Campaign records
ls records/campaigns/

# Bounce cleanup logs
ls logs/bounce-cleanup/

# Operation timeline
cat CAMPAIGN_CHANGELOG.md
```

### Code
```bash
# Services
ls src/services/

# Scripts
ls scripts/

# Tests
ls tests/unit/
```

---

## 🎯 Quick Navigation

| I want to... | Go to... |
|--------------|----------|
| Understand the project | `README.md` |
| See what happened | `CAMPAIGN_CHANGELOG.md` |
| Learn how it works | `docs/02_architecture.md` |
| Set up environment | `docs/06_repository_setup.md` |
| Run bounce cleanup | `docs/guides/BOUNCE_CLEANUP_QUICKSTART.md` |
| View campaign history | `records/campaigns/` |
| Check bounce logs | `logs/bounce-cleanup/` |
| Find a script | `scripts/` |
| Read API docs | `docs/03_api_specification.md` |

---

## ✅ Recent Reorganization (Oct 1, 2025)

### What Was Moved

**From Root → docs/**:
- `MCP_API_DOCUMENTATION.md`
- `MCP_INTEGRATION_REQUIREMENTS.md`
- `IMPLEMENTATION_STATUS.md`
- `CREATE_PR.md`

**From Root → docs/guides/**:
- `BOUNCE_CLEANUP_QUICKSTART.md`
- `SIMPLE_BOUNCE_CLEANUP.md`
- `LOGGING_STRUCTURE.md`

**From Root → docs/archive/**:
- `ROUND2_LAUNCH_READY.md`
- `ROUND3_SETUP_GUIDE.md`

### What Was Deleted
- `jest.config 2.js` (duplicate)
- `test-slack-blocks.json` (temp file)

### What Stayed in Root
- `README.md` (main docs)
- `CAMPAIGN_CHANGELOG.md` (operation timeline)
- All config files (package.json, tsconfig.json, etc.)

---

## 📝 Maintenance

### Adding New Files

**Documentation**:
- Core technical docs → `docs/[number]_name.md`
- Quick guides → `docs/guides/name.md`
- Historical → `docs/archive/name.md`

**Operations**:
- Campaign records → `records/campaigns/campaign-{id}.md`
- Automated logs → `logs/bounce-cleanup/{date}-campaign-{id}.json`

**Code**:
- Services → `src/services/`
- Scripts → `scripts/`
- Tests → `tests/`

### Cleanup Checklist

Before committing:
- [ ] No temp files in root
- [ ] Documentation properly categorized
- [ ] Logs in appropriate directories
- [ ] No duplicate files
- [ ] README and indexes updated

---

**Last Updated**: October 1, 2025
**Maintained By**: Campaign Manager Team
