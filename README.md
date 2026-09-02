# airtable-mcp-server

A Model Context Protocol server that provides read and write access to Airtable databases. This server enables LLMs to inspect database schemas, then read and write records.

https://github.com/user-attachments/assets/c8285e76-d0ed-4018-94c7-20535db6c944

## ⚠️ Looking for AIP Viewer Apps?

If you're looking for **AIP file viewers** (Adobe Illustrator Plugin, ArcGIS, App Inventor packages, etc.), this repository is **not** what you need. This is an **Airtable** integration tool for LLMs.

For AIP viewers, try these instead:

### ArcGIS AIP (Add-In/Package)
- **Viewer**: ArcGIS Pro
- **Link**: [esri.com/en-us/arcgis/products/arcgis-pro/overview](https://esri.com/en-us/arcgis/products/arcgis-pro/overview)

### Artlantis AIP (Shader/Plugin Package)  
- **Viewer**: Artlantis
- **Link**: [artlantis.com](https://artlantis.com)

### Adobe Illustrator Plugin (.aip)
- **Viewer**: Adobe Illustrator
- **Link**: [adobe.com/products/illustrator.html](https://adobe.com/products/illustrator.html)

### App Inventor Package (.aip)
- **Viewer**: MIT App Inventor
- **Link**: [appinventor.mit.edu](https://appinventor.mit.edu)

### Alternative AI/PDF Viewers
- **Adobe Acrobat Reader (PDF)**: [get.adobe.com/reader](https://get.adobe.com/reader)
- **Photopea (Web-based)**: [photopea.com](https://photopea.com)
- **Inkscape (Open-source)**: [inkscape.org](https://inkscape.org)
- **IrfanView**: [irfanview.com](https://irfanview.com)

---

## Installation

Follow the instructions on [install-mcp](https://adamjones.me/install-mcp/?config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImFpcnRhYmxlLW1jcC1zZXJ2ZXIiXSwibmFtZSI6ImFpcnRhYmxlIiwiZW52Ijp7IkFJUlRBQkxFX0FQSV9LRVkiOiJwYXQxMjMuYWJjMTIzIn19), which generates the right config for your MCP client (Claude Code, Claude Desktop, Cursor, Cline, VS Code, and more).

You'll need an Airtable personal access token — [create one here](https://airtable.com/create/tokens/new) with scopes `schema.bases:read` and `data.records:read` (and optionally `schema.bases:write`, `data.records:write`, `data.recordComments:read`, `data.recordComments:write`), and access to the bases you want to use. It looks something like `pat123.abc123` (but longer). Set it as `AIRTABLE_API_KEY` (replacing the placeholder in the generated config).

## Components

### Tools

- **list_records**
  - Lists records from a specified Airtable table
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table to query
    - `maxRecords` (number, optional): Maximum number of records to return. Defaults to 100.
    - `filterByFormula` (string, optional): Airtable formula to filter records

- **search_records**
  - Search for records containing specific text
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table to query
    - `searchTerm` (string, required): Text to search for in records
    - `fieldIds` (array, optional): Specific field IDs to search in. If not provided, searches all text-based fields.
    - `maxRecords` (number, optional): Maximum number of records to return. Defaults to 100.

- **list_bases**
  - Lists all accessible Airtable bases
  - No input parameters required
  - Returns base ID, name, and permission level

- **list_tables**
  - Lists all tables in a specific base
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `detailLevel` (string, optional): The amount of detail to get about the tables (`tableIdentifiersOnly`, `identifiersOnly`, or `full`)
  - Returns table ID, name, description, fields, and views (to the given `detailLevel`)

- **describe_table**
  - Gets detailed information about a specific table
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table to describe
    - `detailLevel` (string, optional): The amount of detail to get about the table (`tableIdentifiersOnly`, `identifiersOnly`, or `full`)
  - Returns the same format as list_tables but for a single table
  - Useful for getting details about a specific table without fetching information about all tables in the base

- **get_record**
  - Gets a specific record by ID
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table
    - `recordId` (string, required): The ID of the record to retrieve

- **create_record**
  - Creates a new record in a table
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table
    - `fields` (object, required): The fields and values for the new record

- **update_records**
  - Updates one or more records in a table
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table
    - `records` (array, required): Array of objects containing record ID and fields to update

- **delete_records**
  - Deletes one or more records from a table
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table
    - `recordIds` (array, required): Array of record IDs to delete

- **create_table**
  - Creates a new table in a base
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `name` (string, required): Name of the new table
    - `description` (string, optional): Description of the table
    - `fields` (array, required): Array of field definitions (name, type, description, options)

- **update_table**
  - Updates a table's name or description
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table
    - `name` (string, optional): New name for the table
    - `description` (string, optional): New description for the table

- **create_field**
  - Creates a new field in a table
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table
    - `name` (string, required): Name of the new field
    - `type` (string, required): Type of the field
    - `description` (string, optional): Description of the field
    - `options` (object, optional): Field-specific options

- **update_field**
  - Updates a field's name or description
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table
    - `fieldId` (string, required): The ID of the field
    - `name` (string, optional): New name for the field
    - `description` (string, optional): New description for the field

- **generate_resume**
  - Generate a professional resume from Airtable data in markdown or JSON format
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base containing resume data
    - `profileTableId` (string, required): The ID of the table containing profile/personal information
    - `experienceTableId` (string, optional): The ID of the table containing work experience records
    - `educationTableId` (string, optional): The ID of the table containing education records
    - `skillsTableId` (string, optional): The ID of the table containing skills records
    - `projectsTableId` (string, optional): The ID of the table containing projects records
    - `certificationsTableId` (string, optional): The ID of the table containing certifications records
    - `profileRecordId` (string, optional): Specific record ID from profile table
    - `style` (string, optional): Resume style preference (concise, detailed, managerial, academic)
    - `language` (string, optional): Language for the resume (default: 'en')
    - `format` (string, optional): Output format (markdown, json)
    - `includeProjects` (boolean, optional): Whether to include projects section
    - `includeCertifications` (boolean, optional): Whether to include certifications section
    - `maxExperience` (number, optional): Maximum number of experience entries
    - `maxProjects` (number, optional): Maximum number of projects to include

### Resources

- **list_comments**
  - Lists comments on a record
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table
    - `recordId` (string, required): The ID of the record
    - `pageSize` (number, optional): Number of comments to return (max 100, default 100)
    - `offset` (string, optional): Pagination offset for retrieving additional comments
  - Returns comments array with author, text, timestamps, reactions, and mentions
  - Comments are returned from newest to oldest

### HTTP Transport

The server can also run in HTTP mode for use with remote MCP clients:

```bash
MCP_TRANSPORT=http PORT=3000 npx airtable-mcp-server
```

This starts a stateless HTTP server at `http://localhost:3000/mcp`.

> [!WARNING]
> The HTTP transport has no built-in authentication, and binding to
> localhost or a private network is **not** a security boundary against
> browsers: a malicious website can use [DNS rebinding](https://en.wikipedia.org/wiki/DNS_rebinding)
> to make a visitor's browser send requests to `http://localhost:3000/mcp`
> and invoke tools — including reading, writing and deleting records —
> using this server's Airtable token.
>
> Only run HTTP mode where untrusted callers (including browsers on the
> same machine or network) cannot reach `/mcp` without authenticating.
> In practice that means putting it behind a reverse proxy or gateway
> that requires a credential a browser won't attach cross-origin, such
> as an `Authorization` header.
>
> If you just want to use this server with an MCP client on the same
> machine, use the default stdio transport instead — it doesn't open a
> port at all.

## n8n Integration

This server includes specialized resume generation tools that can be integrated with n8n workflows for automated resume creation. The integration supports:

- **Webhook-triggered resume generation** from Android devices or other platforms
- **Automated data extraction** from structured Airtable bases
- **Multiple output formats** (Markdown, JSON)
- **Customizable resume styles** (concise, detailed, managerial, academic)
- **Google Drive integration** for file storage
- **Email delivery** of generated resumes

See [N8N_RESUME_INTEGRATION.md](./N8N_RESUME_INTEGRATION.md) for a complete implementation guide including:
- Airtable database schema setup
- n8n workflow configuration
- Android trigger setup
- Security best practices
- Troubleshooting guide

## Contributing

Pull requests are welcomed on GitHub! To get started:

1. Install Git and Node.js
2. Clone the repository
3. Install dependencies with `npm install`
4. Run `npm run test` to run tests
5. Build with `npm run build`
  - You can use `npm run build:watch` to automatically build after editing [`src/index.ts`](./src/index.ts). This means you can hit save, reload Claude Desktop (with Ctrl/Cmd+R), and the changes apply.

## Releases

Versions follow the [semantic versioning spec](https://semver.org/).

To release:

1. Use `npm version <major | minor | patch>` to bump the version
2. Run `git push --follow-tags` to push with tags
3. Wait for GitHub Actions to publish to the NPM registry.
