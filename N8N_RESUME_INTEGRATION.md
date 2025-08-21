# n8n Resume Generation Flow Integration

This document provides a complete guide for integrating the Airtable MCP Server with n8n to create an automated resume generation workflow.

## Overview

The Airtable MCP Server now includes resume generation capabilities that can be leveraged by n8n workflows to:

- Extract resume data from structured Airtable bases
- Generate professional resumes in Markdown or JSON format
- Support various resume styles and customization options
- Enable webhook-triggered automation from Android devices or other platforms

## Airtable Database Schema

### Required Tables

To use the resume generation functionality, your Airtable base should contain the following tables:

#### Profile Table (Required)
- **name** (Single line text) - Full name
- **email** (Email) - Contact email
- **phone** (Phone number) - Contact phone
- **location** (Single line text) - City, State/Country
- **summary** (Long text) - Professional summary/bio
- **linkedin** (URL) - LinkedIn profile URL
- **github** (URL) - GitHub profile URL
- **portfolio** (URL) - Portfolio website URL

#### Experience Table (Optional)
- **company** (Single line text) - Company name
- **title** (Single line text) - Job title/position
- **startDate** (Date) - Employment start date
- **endDate** (Date) - Employment end date (leave empty for current)
- **current** (Checkbox) - Whether this is current position
- **description** (Long text) - Job description
- **achievements** (Multiple select or Long text) - Key achievements
- **technologies** (Multiple select or Long text) - Technologies used

#### Education Table (Optional)
- **institution** (Single line text) - School/University name
- **degree** (Single line text) - Degree obtained
- **field** (Single line text) - Field of study/Major
- **startDate** (Date) - Start date
- **endDate** (Date) - Graduation date
- **gpa** (Single line text) - GPA/Grade
- **achievements** (Multiple select or Long text) - Academic achievements

#### Projects Table (Optional)
- **name** (Single line text) - Project name
- **description** (Long text) - Project description
- **technologies** (Multiple select or Long text) - Technologies used
- **startDate** (Date) - Project start date
- **endDate** (Date) - Project completion date
- **url** (URL) - Live demo URL
- **github** (URL) - GitHub repository URL
- **highlights** (Multiple select or Long text) - Key features/achievements

#### Skills Table (Optional)
- **category** (Single line text) - Skill category (e.g., "Programming Languages")
- **skills** (Multiple select or Long text) - List of skills
- **proficiency** (Single select) - Proficiency level: beginner, intermediate, advanced, expert

#### Certifications Table (Optional)
- **name** (Single line text) - Certification name
- **issuer** (Single line text) - Issuing organization
- **date** (Date) - Date obtained
- **expiryDate** (Date) - Expiration date (if applicable)
- **credentialId** (Single line text) - Credential ID
- **url** (URL) - Verification URL

## n8n Workflow Implementation

### Basic Workflow Structure

```
1. Webhook Trigger (HTTP Request)
2. Set Variables (Code Node)
3. Generate Resume (HTTP Request to MCP Server)
4. Process Result (Code Node)
5. Save to Google Drive (Google Drive Node)
6. Send Email (Gmail Node)
7. Return Response (Respond to Webhook Node)
```

### 1. Webhook Trigger Configuration

**Node Type:** Webhook
- **HTTP Method:** POST
- **Path:** /resume-build
- **Response Mode:** "Last Node"

**Expected Payload:**
```json
{
  "simulate": false,
  "role": "Senior Automation Engineer",
  "years": 6,
  "style": "concise",
  "language": "en",
  "airtable": {
    "baseId": "your-base-id",
    "profileTableId": "your-profile-table-id",
    "experienceTableId": "your-experience-table-id",
    "educationTableId": "your-education-table-id",
    "skillsTableId": "your-skills-table-id",
    "projectsTableId": "your-projects-table-id",
    "certificationsTableId": "your-certifications-table-id"
  },
  "links": {
    "linkedin": "https://linkedin.com/in/your-handle",
    "github": "https://github.com/your-handle",
    "portfolio": "https://your-portfolio.com"
  },
  "email": {
    "to": "me@example.com"
  }
}
```

### 2. Set Variables Node

**Node Type:** Code
```javascript
// Set default values and prepare data
const payload = $input.item(0).json;

const defaults = {
  style: 'concise',
  language: 'en',
  simulate: false,
  includeProjects: true,
  includeCertifications: true
};

const config = {
  ...defaults,
  ...payload,
  runId: new Date().toISOString().replace(/[:.]/g, '-'),
  timestamp: new Date().toISOString()
};

return { config };
```

### 3. Generate Resume Node

**Node Type:** HTTP Request
- **Method:** POST
- **URL:** `http://your-mcp-server-host/tools/call`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer your-mcp-token` (if authentication is required)

**Body:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "generate_resume",
    "arguments": {
      "baseId": "{{ $node['Set Variables'].json.config.airtable.baseId }}",
      "profileTableId": "{{ $node['Set Variables'].json.config.airtable.profileTableId }}",
      "experienceTableId": "{{ $node['Set Variables'].json.config.airtable.experienceTableId }}",
      "educationTableId": "{{ $node['Set Variables'].json.config.airtable.educationTableId }}",
      "skillsTableId": "{{ $node['Set Variables'].json.config.airtable.skillsTableId }}",
      "projectsTableId": "{{ $node['Set Variables'].json.config.airtable.projectsTableId }}",
      "certificationsTableId": "{{ $node['Set Variables'].json.config.airtable.certificationsTableId }}",
      "style": "{{ $node['Set Variables'].json.config.style }}",
      "language": "{{ $node['Set Variables'].json.config.language }}",
      "format": "markdown",
      "includeProjects": "{{ $node['Set Variables'].json.config.includeProjects }}",
      "includeCertifications": "{{ $node['Set Variables'].json.config.includeCertifications }}"
    }
  }
}
```

### 4. Process Result Node

**Node Type:** Code
```javascript
const response = $input.item(0).json;
const config = $node['Set Variables'].json.config;

// Extract resume data from MCP response
const resumeResult = JSON.parse(response.result.content[0].text);
const markdown = resumeResult.markdown;
const resumeData = resumeResult.resumeData;

// Generate filename
const fileName = `resume-${config.runId}`;

// Prepare for next steps
return {
  markdown,
  resumeData,
  fileName,
  config,
  driveFolder: config.simulate ? 'Resume/Staging' : 'Resume/Exports'
};
```

### 5. Save to Google Drive Node

**Node Type:** Google Drive
- **Operation:** Upload a file
- **File Name:** `{{ $node['Process Result'].json.fileName }}.md`
- **File Content:** `{{ $node['Process Result'].json.markdown }}`
- **Parent Folder:** `{{ $node['Process Result'].json.driveFolder }}`

### 6. Convert to PDF (Optional)

**Node Type:** HTTP Request (to markdown-to-pdf service)
- **Method:** POST
- **URL:** `https://your-pdf-service.com/convert`
- **Body:**
```json
{
  "markdown": "{{ $node['Process Result'].json.markdown }}",
  "options": {
    "format": "A4",
    "margin": "1in"
  }
}
```

### 7. Send Email Node

**Node Type:** Gmail
- **Operation:** Send Email
- **To:** `{{ $node['Set Variables'].json.config.email.to }}`
- **Subject:** `Your Updated Resume - {{ $node['Set Variables'].json.config.role }} ({{ $node['Set Variables'].json.config.runId }})`
- **Email Type:** HTML
- **Message:**
```html
<h2>Your resume has been generated successfully!</h2>
<p><strong>Role:</strong> {{ $node['Set Variables'].json.config.role }}</p>
<p><strong>Style:</strong> {{ $node['Set Variables'].json.config.style }}</p>
<p><strong>Generated:</strong> {{ $node['Set Variables'].json.config.timestamp }}</p>

<h3>Resume Summary:</h3>
<ul>
  <li>Experience entries: {{ $node['Process Result'].json.resumeData.experience.length }}</li>
  <li>Projects: {{ $node['Process Result'].json.resumeData.projects.length }}</li>
  <li>Skills categories: {{ $node['Process Result'].json.resumeData.skills.length }}</li>
  <li>Certifications: {{ $node['Process Result'].json.resumeData.certifications.length }}</li>
</ul>

<p>Your resume files are available in Google Drive.</p>
```
- **Attachments:** Link to the saved files in Google Drive

### 8. Response Node

**Node Type:** Respond to Webhook
```json
{
  "status": "success",
  "simulate": "{{ $node['Set Variables'].json.config.simulate }}",
  "role": "{{ $node['Set Variables'].json.config.role }}",
  "runId": "{{ $node['Set Variables'].json.config.runId }}",
  "files": {
    "markdown": "{{ $node['Google Drive'].json.webViewLink }}",
    "driveFolder": "{{ $node['Process Result'].json.driveFolder }}"
  },
  "stats": {
    "experience_count": "{{ $node['Process Result'].json.resumeData.experience.length }}",
    "projects_count": "{{ $node['Process Result'].json.resumeData.projects.length }}",
    "skills_categories": "{{ $node['Process Result'].json.resumeData.skills.length }}"
  }
}
```

## Android Integration

### HTTP Shortcuts Configuration

Create a new shortcut with the following configuration:

**Basic Settings:**
- **Name:** Generate Resume
- **Method:** POST
- **URL:** `https://your-n8n-instance.com/webhook/resume-build`

**Request Body:**
```json
{
  "simulate": false,
  "role": "Senior Automation Engineer",
  "years": 6,
  "style": "concise",
  "airtable": {
    "baseId": "your-base-id",
    "profileTableId": "tbl1234567890",
    "experienceTableId": "tbl2345678901",
    "skillsTableId": "tbl3456789012"
  },
  "email": {
    "to": "your-email@example.com"
  }
}
```

**Headers:**
- `Content-Type: application/json`

### Tasker Integration

1. Create a new Task: "Generate Resume"
2. Add Action: HTTP Request
   - **Method:** POST
   - **URL:** n8n webhook URL
   - **Body:** JSON payload (as above)
   - **Content Type:** application/json
3. Add Action: Show notification with response

## Security Considerations

1. **API Key Protection:** Store Airtable API keys securely in n8n credentials
2. **Webhook Authentication:** Use HMAC signatures or API keys to secure webhook endpoints
3. **Data Privacy:** Ensure resume data is handled according to privacy regulations
4. **Access Control:** Limit Airtable base access to minimum required permissions

## Troubleshooting

### Common Issues

1. **"No profile record found"**
   - Ensure the profile table contains at least one record
   - Verify the profile table ID is correct

2. **"Table not found"**
   - Check that all table IDs in the request are valid
   - Ensure the Airtable API key has access to the base

3. **Empty resume sections**
   - Verify data exists in the optional tables
   - Check field name mappings in your Airtable schema

4. **MCP Server connection errors**
   - Ensure the MCP server is running and accessible
   - Check network connectivity and firewall settings

### Debug Mode

Set `simulate: true` in your webhook payload to test the workflow without sending emails or saving to production folders.

## Example Airtable Base Template

You can create a sample Airtable base with the following structure:

1. **Profile Table:**
   - John Doe | john@example.com | +1-555-0123 | San Francisco, CA | "Experienced software engineer..." | linkedin.com/in/johndoe | github.com/johndoe | johndoe.dev

2. **Experience Table:**
   - Tech Corp | Senior Developer | 2020-01-01 | 2023-12-31 | false | "Led development of web applications" | ["Improved performance by 50%", "Mentored junior developers"] | ["React", "Node.js", "TypeScript"]

3. **Skills Table:**
   - Programming Languages | ["JavaScript", "TypeScript", "Python"] | advanced
   - Frameworks | ["React", "Node.js", "Express"] | advanced

This setup will generate a complete, professional resume that can be customized further based on your specific needs.