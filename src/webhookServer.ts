#!/usr/bin/env node

/**
 * Simple HTTP webhook server that demonstrates the resume generation functionality
 * This can be used as a standalone service for n8n or other automation platforms
 */

import http from 'http';
import {AirtableService} from './airtableService.js';
import {ResumeGenerationArgsSchema, ResumeWebhookArgsSchema} from './types.js';

const PORT = process.env.PORT || 3001;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

if (!AIRTABLE_API_KEY) {
	console.error('Error: AIRTABLE_API_KEY environment variable is required');
	process.exit(1);
}

const airtableService = new AirtableService(AIRTABLE_API_KEY);

const server = http.createServer(async (req, res) => {
	// CORS headers
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

	if (req.method === 'OPTIONS') {
		res.writeHead(200);
		res.end();
		return;
	}

	if (req.method !== 'POST') {
		res.writeHead(405, {'Content-Type': 'application/json'});
		res.end(JSON.stringify({error: 'Method not allowed'}));
		return;
	}

	const url = new URL(req.url!, `http://${req.headers.host}`);

	try {
		let body = '';
		req.on('data', chunk => {
			body += chunk.toString();
		});

		req.on('end', async () => {
			try {
				const payload = JSON.parse(body);

				if (url.pathname === '/webhook/resume-build') {
					await handleResumeWebhook(payload, res);
				} else if (url.pathname === '/mcp/generate-resume') {
					await handleMCPResume(payload, res);
				} else {
					res.writeHead(404, {'Content-Type': 'application/json'});
					res.end(JSON.stringify({error: 'Endpoint not found'}));
				}
			} catch (error) {
				console.error('Error processing request:', error);
				res.writeHead(500, {'Content-Type': 'application/json'});
				res.end(JSON.stringify({
					error: 'Internal server error',
					message: error instanceof Error ? error.message : String(error),
				}));
			}
		});
	} catch (error) {
		console.error('Error handling request:', error);
		res.writeHead(500, {'Content-Type': 'application/json'});
		res.end(JSON.stringify({error: 'Internal server error'}));
	}
});

async function handleResumeWebhook(payload: any, res: http.ServerResponse) {
	const webhookArgs = ResumeWebhookArgsSchema.parse(payload);
	
	// Convert webhook args to resume generation args
	const resumeArgs = {
		baseId: webhookArgs.airtable.baseId,
		profileTableId: webhookArgs.airtable.profileTableId,
		experienceTableId: webhookArgs.airtable.experienceTableId,
		educationTableId: webhookArgs.airtable.educationTableId,
		skillsTableId: webhookArgs.airtable.skillsTableId,
		projectsTableId: webhookArgs.airtable.projectsTableId,
		certificationsTableId: webhookArgs.airtable.certificationsTableId,
		style: webhookArgs.style,
		language: webhookArgs.language,
		format: 'markdown' as const,
		includeProjects: true,
		includeCertifications: true,
	};

	const result = await airtableService.generateResume(resumeArgs);
	const runId = new Date().toISOString().replace(/[:.]/g, '-');

	const response = {
		status: 'success',
		simulate: webhookArgs.simulate,
		role: webhookArgs.role,
		years: webhookArgs.years,
		runId,
		resumeData: result.resumeData,
		markdown: result.markdown,
		stats: {
			experience_count: result.resumeData.experience.length,
			projects_count: result.resumeData.projects.length,
			skills_categories: result.resumeData.skills.length,
			certifications_count: result.resumeData.certifications.length,
		},
		notes: generateNotes(result.resumeData),
	};

	res.writeHead(200, {'Content-Type': 'application/json'});
	res.end(JSON.stringify(response, null, 2));
}

async function handleMCPResume(payload: any, res: http.ServerResponse) {
	const args = ResumeGenerationArgsSchema.parse(payload);
	const result = await airtableService.generateResume(args);

	res.writeHead(200, {'Content-Type': 'application/json'});
	res.end(JSON.stringify(result, null, 2));
}

function generateNotes(resumeData: any): string[] {
	const notes: string[] = [];

	if (resumeData.experience.length === 0) {
		notes.push('Consider adding work experience entries');
	}

	if (resumeData.projects.length === 0) {
		notes.push('Consider adding project entries to showcase your work');
	}

	if (resumeData.skills.length === 0) {
		notes.push('Consider adding skills categories');
	}

	if (!resumeData.profile.summary) {
		notes.push('Consider adding a professional summary to your profile');
	}

	if (resumeData.experience.length > 0) {
		const hasAchievements = resumeData.experience.some((exp: any) => exp.achievements.length > 0);
		if (!hasAchievements) {
			notes.push('Consider adding specific achievements to your experience entries');
		}
	}

	return notes;
}

server.listen(PORT, () => {
	console.log(`Resume generation webhook server running on port ${PORT}`);
	console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/resume-build`);
	console.log(`MCP endpoint: http://localhost:${PORT}/mcp/generate-resume`);
	console.log('\nExample request:');
	console.log(`curl -X POST http://localhost:${PORT}/webhook/resume-build \\`);
	console.log('  -H "Content-Type: application/json" \\');
	console.log('  -d \'{"role": "Software Engineer", "years": 5, "airtable": {"baseId": "your-base-id", "profileTableId": "your-table-id"}}\'');
});

export {server};