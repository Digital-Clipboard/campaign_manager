# Campaign Manager MCP API Documentation

## Overview

The Campaign Manager provides a Model Context Protocol (MCP) interface for managing marketing campaigns, tasks, and team coordination. This API enables Claude and other MCP-compatible clients to interact with the campaign management system.

## Base URLs

- **Production:** `https://campaign-manager-prod-4ff79a873f5e.herokuapp.com`
- **Staging:** `https://campaign-manager-staging-087b1925d6ef.herokuapp.com`

## Authentication

Currently, the API operates without authentication for MCP endpoints. All operations are performed as the `mcp-user`.

## Available Endpoints

### Health Check
- **GET** `/health` - Basic health check
- **GET** `/metrics` - Detailed application metrics and database statistics

### MCP Interface
- **POST** `/mcp` - Main MCP endpoint for all tool operations

## MCP Tools

### Campaign Management

#### `listCampaigns`
Lists campaigns with pagination and filtering support.

**Parameters:**
- `limit` (optional, number): Maximum number of campaigns to return (default: 10)
- `offset` (optional, number): Number of campaigns to skip (default: 0)

**Example Request:**
```json
{
  "tool": "listCampaigns",
  "params": {
    "limit": 5,
    "offset": 0
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "14895af0-9c44-4743-baa2-7850f4a124b2",
        "name": "Q4 Product Launch",
        "type": "product_launch",
        "status": "planning",
        "targetDate": "2025-12-15T00:00:00.000Z",
        "objectives": ["Increase brand awareness", "Drive sales"],
        "priority": "high",
        "description": "Launch our new product line for Q4",
        "budget": null,
        "stakeholders": [],
        "readinessScore": 0,
        "createdBy": "mcp-user",
        "createdAt": "2025-09-27T15:51:02.708Z",
        "tasks": []
      }
    ],
    "total": 1,
    "message": "Found 1 campaigns"
  }
}
```

#### `createCampaign`
Creates a new marketing campaign.

**Required Parameters:**
- `name` (string): Campaign name
- `type` (string): Campaign type (email_blast, product_launch, webinar, newsletter, custom)
- `targetDate` (string): Target completion date in ISO format

**Optional Parameters:**
- `objectives` (array): List of campaign objectives
- `priority` (string): Priority level (low, medium, high, critical) - default: medium
- `description` (string): Campaign description
- `stakeholders` (array): List of stakeholder names/emails

**Example Request:**
```json
{
  "tool": "createCampaign",
  "params": {
    "name": "Q4 Product Launch",
    "type": "product_launch",
    "targetDate": "2025-12-15",
    "objectives": ["Increase brand awareness", "Drive sales"],
    "priority": "high",
    "description": "Launch our new product line for Q4"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": "14895af0-9c44-4743-baa2-7850f4a124b2",
      "name": "Q4 Product Launch",
      "type": "product_launch",
      "status": "planning",
      "targetDate": "2025-12-15T00:00:00.000Z",
      "objectives": ["Increase brand awareness", "Drive sales"],
      "priority": "high",
      "description": "Launch our new product line for Q4",
      "readinessScore": 0,
      "createdAt": "2025-09-27T15:51:02.708Z"
    },
    "message": "Campaign 'Q4 Product Launch' created successfully"
  }
}
```

#### `getCampaign`
Retrieves detailed information about a specific campaign.

**Required Parameters:**
- `campaignId` (string): Unique campaign identifier

**Example Request:**
```json
{
  "tool": "getCampaign",
  "params": {
    "campaignId": "14895af0-9c44-4743-baa2-7850f4a124b2"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": "14895af0-9c44-4743-baa2-7850f4a124b2",
      "name": "Q4 Product Launch",
      "type": "product_launch",
      "status": "planning",
      "targetDate": "2025-12-15T00:00:00.000Z",
      "objectives": ["Increase brand awareness", "Drive sales"],
      "priority": "high",
      "description": "Launch our new product line for Q4",
      "tasks": [],
      "timeline": null,
      "approvals": []
    }
  }
}
```

### Team Management

#### `createTeamMember`
Creates a new team member.

**Required Parameters:**
- `email` (string): Team member's email address (unique)
- `name` (string): Team member's full name
- `role` (string): Team member's role (e.g., developer, designer, manager)

**Optional Parameters:**
- `skills` (array): List of skill names
- `timezone` (string): Timezone (default: UTC)

**Example Request:**
```json
{
  "tool": "createTeamMember",
  "params": {
    "email": "john.doe@example.com",
    "name": "John Doe",
    "role": "developer",
    "skills": ["TypeScript", "React", "Node.js"],
    "timezone": "America/New_York"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "teamMember": {
      "id": "fc0a10a5-c25c-45f2-9ecc-5acd60607fe5",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "role": "developer",
      "skills": ["TypeScript", "React", "Node.js"],
      "timezone": "America/New_York",
      "slackUserId": null,
      "availability": {},
      "maxConcurrent": 5,
      "isActive": true,
      "createdAt": "2025-09-27T16:05:16.646Z",
      "updatedAt": "2025-09-27T16:05:16.646Z"
    },
    "message": "Team member 'John Doe' created successfully"
  }
}
```

#### `listTeamMembers`
Lists team members with filtering and pagination support.

**Optional Parameters:**
- `role` (string): Filter by role
- `isActive` (boolean): Filter by active status
- `limit` (number): Maximum number of team members to return (default: 10)
- `offset` (number): Number of team members to skip (default: 0)

**Example Request:**
```json
{
  "tool": "listTeamMembers",
  "params": {
    "role": "developer",
    "isActive": true,
    "limit": 5
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "teamMembers": [
      {
        "id": "fc0a10a5-c25c-45f2-9ecc-5acd60607fe5",
        "email": "john.doe@example.com",
        "name": "John Doe",
        "role": "developer",
        "skills": ["TypeScript", "React", "Node.js"],
        "timezone": "America/New_York",
        "tasks": [],
        "campaigns": []
      }
    ],
    "total": 1,
    "message": "Found 1 team members"
  }
}
```

#### `getTeamMember`
Retrieves detailed information about a specific team member.

**Required Parameters:**
- `memberId` (string): Unique team member identifier

**Example Request:**
```json
{
  "tool": "getTeamMember",
  "params": {
    "memberId": "fc0a10a5-c25c-45f2-9ecc-5acd60607fe5"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "teamMember": {
      "id": "fc0a10a5-c25c-45f2-9ecc-5acd60607fe5",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "role": "developer",
      "tasks": [
        {
          "id": "a2b751b1-d380-47cc-848a-bb370c1b844b",
          "title": "Design product mockups",
          "status": "assigned",
          "dueDate": "2025-11-15T00:00:00.000Z",
          "campaign": {
            "id": "14895af0-9c44-4743-baa2-7850f4a124b2",
            "name": "Q4 Product Launch",
            "status": "planning"
          }
        }
      ],
      "campaigns": [
        {
          "role": "contributor",
          "joinedAt": "2025-09-27T16:07:48.218Z",
          "campaign": {
            "id": "14895af0-9c44-4743-baa2-7850f4a124b2",
            "name": "Q4 Product Launch",
            "status": "planning",
            "priority": "high"
          }
        }
      ]
    }
  }
}
```

#### `assignTaskToMember`
Assigns a task to a team member.

**Required Parameters:**
- `taskId` (string): Unique task identifier
- `memberId` (string): Unique team member identifier

**Example Request:**
```json
{
  "tool": "assignTaskToMember",
  "params": {
    "taskId": "a2b751b1-d380-47cc-848a-bb370c1b844b",
    "memberId": "fc0a10a5-c25c-45f2-9ecc-5acd60607fe5"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "task": {
      "id": "a2b751b1-d380-47cc-848a-bb370c1b844b",
      "title": "Design product mockups",
      "status": "assigned",
      "assignee": {
        "id": "fc0a10a5-c25c-45f2-9ecc-5acd60607fe5",
        "name": "John Doe",
        "email": "john.doe@example.com"
      },
      "campaign": {
        "id": "14895af0-9c44-4743-baa2-7850f4a124b2",
        "name": "Q4 Product Launch"
      }
    },
    "message": "Task 'Design product mockups' assigned to John Doe"
  }
}
```

#### `addTeamMemberToCampaign`
Adds a team member to a campaign team.

**Required Parameters:**
- `campaignId` (string): Unique campaign identifier
- `memberId` (string): Unique team member identifier
- `role` (string): Campaign role (owner, contributor, reviewer, approver)

**Example Request:**
```json
{
  "tool": "addTeamMemberToCampaign",
  "params": {
    "campaignId": "14895af0-9c44-4743-baa2-7850f4a124b2",
    "memberId": "fc0a10a5-c25c-45f2-9ecc-5acd60607fe5",
    "role": "contributor"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "campaignTeamMember": {
      "id": "1be59c08-2d0a-4906-9c5f-a06a9e2a35bd",
      "role": "contributor",
      "joinedAt": "2025-09-27T16:07:48.218Z",
      "member": {
        "id": "fc0a10a5-c25c-45f2-9ecc-5acd60607fe5",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "role": "developer"
      },
      "campaign": {
        "id": "14895af0-9c44-4743-baa2-7850f4a124b2",
        "name": "Q4 Product Launch"
      }
    },
    "message": "John Doe added to campaign 'Q4 Product Launch' as contributor"
  }
}
```

### Task Management

#### `createTask`
Creates a new task associated with a campaign.

**Required Parameters:**
- `campaignId` (string): ID of the associated campaign
- `title` (string): Task title
- `dueDate` (string): Due date in ISO format

**Optional Parameters:**
- `description` (string): Task description
- `priority` (string): Priority level (low, medium, high, critical) - default: medium
- `assigneeId` (string): ID of the assigned team member

**Example Request:**
```json
{
  "tool": "createTask",
  "params": {
    "campaignId": "14895af0-9c44-4743-baa2-7850f4a124b2",
    "title": "Design product mockups",
    "description": "Create visual mockups for the new product",
    "dueDate": "2025-11-15",
    "priority": "high"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "task": {
      "id": "a2b751b1-d380-47cc-848a-bb370c1b844b",
      "campaignId": "14895af0-9c44-4743-baa2-7850f4a124b2",
      "title": "Design product mockups",
      "description": "Create visual mockups for the new product",
      "dueDate": "2025-11-15T00:00:00.000Z",
      "priority": "high",
      "status": "pending",
      "estimatedHours": 1,
      "actualHours": 0,
      "createdAt": "2025-09-27T15:56:28.753Z"
    },
    "message": "Task 'Design product mockups' created successfully"
  }
}
```

#### `listTasks`
Lists tasks with filtering and pagination support.

**Optional Parameters:**
- `campaignId` (string): Filter by campaign ID
- `status` (string): Filter by task status (pending, assigned, in_progress, blocked, completed)
- `assigneeId` (string): Filter by assignee ID
- `limit` (number): Maximum number of tasks to return (default: 10)
- `offset` (number): Number of tasks to skip (default: 0)

**Example Request:**
```json
{
  "tool": "listTasks",
  "params": {
    "campaignId": "14895af0-9c44-4743-baa2-7850f4a124b2",
    "status": "pending",
    "limit": 5
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "a2b751b1-d380-47cc-848a-bb370c1b844b",
        "campaignId": "14895af0-9c44-4743-baa2-7850f4a124b2",
        "title": "Design product mockups",
        "description": "Create visual mockups for the new product",
        "dueDate": "2025-11-15T00:00:00.000Z",
        "priority": "high",
        "status": "pending",
        "campaign": {
          "id": "14895af0-9c44-4743-baa2-7850f4a124b2",
          "name": "Q4 Product Launch"
        }
      }
    ],
    "total": 1,
    "message": "Found 1 tasks"
  }
}
```

## Data Types

### Campaign Types
- `email_blast`: Email marketing campaigns
- `product_launch`: Product launch campaigns
- `webinar`: Webinar campaigns
- `newsletter`: Newsletter campaigns
- `custom`: Custom campaign types

### Campaign Statuses
- `planning`: Initial planning phase
- `preparation`: Campaign preparation
- `review`: Under review
- `scheduled`: Scheduled for execution
- `live`: Currently running
- `completed`: Successfully completed
- `cancelled`: Cancelled campaign

### Task Statuses
- `pending`: Not yet assigned or started
- `assigned`: Assigned to team member
- `in_progress`: Currently being worked on
- `blocked`: Blocked by dependencies
- `completed`: Successfully completed

### Priority Levels
- `low`: Low priority
- `medium`: Medium priority (default)
- `high`: High priority
- `critical`: Critical priority

## Error Handling

All responses include a `success` boolean field. When `success` is `false`, an `error` field provides details about what went wrong.

**Common Error Response:**
```json
{
  "success": false,
  "error": "Missing required fields: name, type, targetDate"
}
```

**Database Error Response:**
```json
{
  "success": false,
  "error": "Database error: Campaign with ID 'invalid-id' not found"
}
```

**Tool Not Found Response:**
```json
{
  "success": false,
  "error": "Tool 'invalidTool' not implemented",
  "availableTools": [
    "listCampaigns", "createCampaign", "getCampaign",
    "createTask", "listTasks"
  ]
}
```

## Monitoring Endpoints

### Health Check
**GET** `/health`

Returns basic service health information.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-27T15:56:16.691Z",
  "service": "campaign-manager",
  "version": "1.0.0"
}
```

### Detailed Health Check
**GET** `/health/detailed`

Returns comprehensive health status with individual system checks.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-27T16:28:44.453Z",
  "service": "campaign-manager",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 152
    },
    "memory": {
      "status": "healthy",
      "usage": 44
    },
    "uptime": {
      "status": "healthy",
      "seconds": 14.468455875
    }
  }
}
```

**Status Codes:**
- `200`: All systems healthy
- `503`: System unhealthy (database errors, high memory usage)

### Metrics
**GET** `/metrics`

Returns detailed application metrics, system performance, and error tracking.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-27T16:28:40.143Z",
  "uptime": {
    "seconds": 10,
    "formatted": "0h 0m 10s"
  },
  "memory": {
    "used": 13,
    "total": 30,
    "unit": "MB"
  },
  "metrics": {
    "campaigns": {
      "total": 1
    },
    "tasks": {
      "total": 1
    },
    "teamMembers": {
      "total": 1
    },
    "database": {
      "connected": true,
      "lastQuery": "2025-09-27T16:28:40.143Z"
    }
  },
  "recentActivity": [
    {
      "id": "14895af0-9c44-4743-baa2-7850f4a124b2",
      "name": "Q4 Product Launch",
      "status": "planning",
      "createdAt": "2025-09-27T15:51:02.708Z"
    }
  ],
  "recentErrors": []
}
```

### Error Reporting
**POST** `/errors/report`

Allows clients to report errors for centralized tracking and monitoring.

**Request Body:**
```json
{
  "error": "Error message or object",
  "context": "Additional context about the error",
  "severity": "warning"
}
```

**Parameters:**
- `error` (required): Error message or error object
- `context` (optional): Additional context information
- `severity` (optional): Error severity level (low, warning, error, critical)

**Response:**
```json
{
  "success": true,
  "message": "Error reported successfully",
  "timestamp": "2025-09-27T16:29:00.654Z"
}
```

**Example Request:**
```bash
curl -X POST /errors/report \
  -H "Content-Type: application/json" \
  -d '{
    "error": "Failed to validate campaign data",
    "context": "Campaign creation form validation",
    "severity": "warning"
  }'
```

## Rate Limiting

The Campaign Manager implements rate limiting to prevent abuse and ensure fair usage:

- **Limit**: 100 requests per minute per IP address
- **Window**: 1 minute rolling window
- **Response**: When rate limit is exceeded, the API returns a 429 status code with retry information

**Rate Limit Error Response:**
```json
{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "errorType": "rate_limit",
  "retryAfter": 45,
  "timestamp": "2025-09-27T16:30:00.000Z"
}
```

**Rate Limit Headers:**
The API includes standard rate limiting headers in responses:
- `x-ratelimit-limit`: The rate limit ceiling for your IP
- `x-ratelimit-remaining`: The number of requests left for the time window
- `x-ratelimit-reset`: The time when the rate limit window resets

## Support

For technical support or questions about the Campaign Manager MCP API, please refer to the project documentation or contact the development team.

---

*Last updated: September 27, 2025*
*API Version: 1.0.0*