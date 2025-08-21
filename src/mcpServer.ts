import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
	type CallToolResult,
	type ListToolsResult,
	type ReadResourceResult,
	type ListResourcesResult,
} from '@modelcontextprotocol/sdk/types.js';
import {type z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {type Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {
	ListRecordsArgsSchema,
	ListTablesArgsSchema,
	DescribeTableArgsSchema,
	GetRecordArgsSchema,
	CreateRecordArgsSchema,
	UpdateRecordsArgsSchema,
	DeleteRecordsArgsSchema,
	CreateTableArgsSchema,
	UpdateTableArgsSchema,
	CreateFieldArgsSchema,
	UpdateFieldArgsSchema,
	SearchRecordsArgsSchema,
	AnalyzeAutomationWorkflowsArgsSchema,
	ManageResumeDataArgsSchema,
	TriggerAutomationArgsSchema,
	GenerateAutomationSummaryArgsSchema,
	type IAirtableService,
	type IAirtableMCPServer,
} from './types.js';

const getInputSchema = (schema: z.ZodType<object>): ListToolsResult['tools'][0]['inputSchema'] => {
	const jsonSchema = zodToJsonSchema(schema);
	if (!('type' in jsonSchema) || jsonSchema.type !== 'object') {
		throw new Error(`Invalid input schema to convert in airtable-mcp-server: expected an object but got ${'type' in jsonSchema ? String(jsonSchema.type) : 'no type'}`);
	}

	return {...jsonSchema, type: 'object'};
};

const formatToolResponse = (data: unknown, isError = false): CallToolResult => {
	return {
		content: [{
			type: 'text',
			mimeType: 'application/json',
			text: JSON.stringify(data),
		}],
		isError,
	};
};

export class AirtableMCPServer implements IAirtableMCPServer {
	private readonly server: Server;

	constructor(private readonly airtableService: IAirtableService) {
		this.server = new Server(
			{
				name: 'airtable-mcp-server',
				version: '0.1.0',
			},
			{
				capabilities: {
					resources: {},
					tools: {},
				},
			},
		);
		this.initializeHandlers();
	}

	async connect(transport: Transport): Promise<void> {
		await this.server.connect(transport);
	}

	async close(): Promise<void> {
		await this.server.close();
	}

	private initializeHandlers(): void {
		this.server.setRequestHandler(ListResourcesRequestSchema, this.handleListResources.bind(this));
		this.server.setRequestHandler(ReadResourceRequestSchema, this.handleReadResource.bind(this));
		this.server.setRequestHandler(ListToolsRequestSchema, this.handleListTools.bind(this));
		this.server.setRequestHandler(CallToolRequestSchema, this.handleCallTool.bind(this));
	}

	private async handleListResources(): Promise<ListResourcesResult> {
		const {bases} = await this.airtableService.listBases();
		const resources = await Promise.all(bases.map(async (base) => {
			const schema = await this.airtableService.getBaseSchema(base.id);
			return schema.tables.map((table) => ({
				uri: `airtable://${base.id}/${table.id}/schema`,
				mimeType: 'application/json',
				name: `${base.name}: ${table.name} schema`,
			}));
		}));

		return {
			resources: resources.flat(),
		};
	}

	private async handleReadResource(request: z.infer<typeof ReadResourceRequestSchema>): Promise<ReadResourceResult> {
		const {uri} = request.params;
		const match = /^airtable:\/\/([^/]+)\/([^/]+)\/schema$/.exec(uri);

		if (!match?.[1] || !match[2]) {
			throw new Error('Invalid resource URI');
		}

		const [, baseId, tableId] = match;
		const schema = await this.airtableService.getBaseSchema(baseId);
		const table = schema.tables.find((t) => t.id === tableId);

		if (!table) {
			throw new Error(`Table ${tableId} not found in base ${baseId}`);
		}

		return {
			contents: [
				{
					uri: request.params.uri,
					mimeType: 'application/json',
					text: JSON.stringify({
						baseId,
						tableId: table.id,
						name: table.name,
						description: table.description,
						primaryFieldId: table.primaryFieldId,
						fields: table.fields,
						views: table.views,
					}),
				},
			],
		};
	}

	private async handleListTools(): Promise<ListToolsResult> {
		return {
			tools: [
				{
					name: 'list_records',
					description: 'List records from a table',
					inputSchema: getInputSchema(ListRecordsArgsSchema),
				},
				{
					name: 'search_records',
					description: 'Search for records containing specific text',
					inputSchema: getInputSchema(SearchRecordsArgsSchema),
				},
				{
					name: 'list_bases',
					description: 'List all accessible Airtable bases',
					inputSchema: {
						type: 'object',
						properties: {},
						required: [],
					},
				},
				{
					name: 'list_tables',
					description: 'List all tables in a specific base',
					inputSchema: getInputSchema(ListTablesArgsSchema),
				},
				{
					name: 'describe_table',
					description: 'Get detailed information about a specific table',
					inputSchema: getInputSchema(DescribeTableArgsSchema),
				},
				{
					name: 'get_record',
					description: 'Get a specific record by ID',
					inputSchema: getInputSchema(GetRecordArgsSchema),
				},
				{
					name: 'create_record',
					description: 'Create a new record in a table',
					inputSchema: getInputSchema(CreateRecordArgsSchema),
				},
				{
					name: 'update_records',
					description: 'Update up to 10 records in a table',
					inputSchema: getInputSchema(UpdateRecordsArgsSchema),
				},
				{
					name: 'delete_records',
					description: 'Delete records from a table',
					inputSchema: getInputSchema(DeleteRecordsArgsSchema),
				},
				{
					name: 'create_table',
					description: 'Create a new table in a base',
					inputSchema: getInputSchema(CreateTableArgsSchema),
				},
				{
					name: 'update_table',
					description: 'Update a table\'s name or description',
					inputSchema: getInputSchema(UpdateTableArgsSchema),
				},
				{
					name: 'create_field',
					description: 'Create a new field in a table',
					inputSchema: getInputSchema(CreateFieldArgsSchema),
				},
				{
					name: 'update_field',
					description: 'Update a field\'s name or description',
					inputSchema: getInputSchema(UpdateFieldArgsSchema),
				},
				{
					name: 'analyze_automation_workflows',
					description: 'Analyze automation workflows stored in Airtable for Balaji\'s automation system',
					inputSchema: getInputSchema(AnalyzeAutomationWorkflowsArgsSchema),
				},
				{
					name: 'manage_resume_data',
					description: 'Manage resume and portfolio data stored in Airtable for automated generation',
					inputSchema: getInputSchema(ManageResumeDataArgsSchema),
				},
				{
					name: 'trigger_automation',
					description: 'Trigger or simulate automation workflows with specified parameters',
					inputSchema: getInputSchema(TriggerAutomationArgsSchema),
				},
				{
					name: 'generate_automation_summary',
					description: 'Generate comprehensive summary of automation workflow executions and results',
					inputSchema: getInputSchema(GenerateAutomationSummaryArgsSchema),
				},
			],
		};
	}

	private async handleCallTool(request: z.infer<typeof CallToolRequestSchema>): Promise<CallToolResult> {
		try {
			switch (request.params.name) {
				case 'list_records': {
					const args = ListRecordsArgsSchema.parse(request.params.arguments);
					const records = await this.airtableService.listRecords(
						args.baseId,
						args.tableId,
						{
							view: args.view,
							maxRecords: args.maxRecords,
							filterByFormula: args.filterByFormula,
							sort: args.sort,
						},
					);
					return formatToolResponse(records);
				}

				case 'search_records': {
					const args = SearchRecordsArgsSchema.parse(request.params.arguments);
					const records = await this.airtableService.searchRecords(
						args.baseId,
						args.tableId,
						args.searchTerm,
						args.fieldIds,
						args.maxRecords,
						args.view,
					);
					return formatToolResponse(records);
				}

				case 'list_bases': {
					const {bases} = await this.airtableService.listBases();
					return formatToolResponse(bases.map((base) => ({
						id: base.id,
						name: base.name,
						permissionLevel: base.permissionLevel,
					})));
				}

				case 'list_tables': {
					const args = ListTablesArgsSchema.parse(request.params.arguments);
					const schema = await this.airtableService.getBaseSchema(args.baseId);
					return formatToolResponse(schema.tables.map((table) => {
						switch (args.detailLevel) {
							case 'tableIdentifiersOnly':
								return {
									id: table.id,
									name: table.name,
								};
							case 'identifiersOnly':
								return {
									id: table.id,
									name: table.name,
									fields: table.fields.map((field) => ({
										id: field.id,
										name: field.name,
									})),
									views: table.views.map((view) => ({
										id: view.id,
										name: view.name,
									})),
								};
							case 'full':
							// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check, no-fallthrough
							default:
								return {
									id: table.id,
									name: table.name,
									description: table.description,
									fields: table.fields,
									views: table.views,
								};
						}
					}));
				}

				case 'describe_table': {
					const args = DescribeTableArgsSchema.parse(request.params.arguments);
					const schema = await this.airtableService.getBaseSchema(args.baseId);
					const table = schema.tables.find((t) => t.id === args.tableId);

					if (!table) {
						return formatToolResponse(`Table ${args.tableId} not found in base ${args.baseId}`, true);
					}

					switch (args.detailLevel) {
						case 'tableIdentifiersOnly':
							return formatToolResponse({
								id: table.id,
								name: table.name,
							});
						case 'identifiersOnly':
							return formatToolResponse({
								id: table.id,
								name: table.name,
								fields: table.fields.map((field) => ({
									id: field.id,
									name: field.name,
								})),
								views: table.views.map((view) => ({
									id: view.id,
									name: view.name,
								})),
							});
						case 'full':
						// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check, no-fallthrough
						default:
							return formatToolResponse({
								id: table.id,
								name: table.name,
								description: table.description,
								fields: table.fields,
								views: table.views,
							});
					}
				}

				case 'get_record': {
					const args = GetRecordArgsSchema.parse(request.params.arguments);
					const record = await this.airtableService.getRecord(args.baseId, args.tableId, args.recordId);
					return formatToolResponse({
						id: record.id,
						fields: record.fields,
					});
				}

				case 'create_record': {
					const args = CreateRecordArgsSchema.parse(request.params.arguments);
					const record = await this.airtableService.createRecord(args.baseId, args.tableId, args.fields);
					return formatToolResponse({
						id: record.id,
						fields: record.fields,
					});
				}

				case 'update_records': {
					const args = UpdateRecordsArgsSchema.parse(request.params.arguments);
					const records = await this.airtableService.updateRecords(args.baseId, args.tableId, args.records);
					return formatToolResponse(records.map((record) => ({
						id: record.id,
						fields: record.fields,
					})));
				}

				case 'delete_records': {
					const args = DeleteRecordsArgsSchema.parse(request.params.arguments);
					const records = await this.airtableService.deleteRecords(args.baseId, args.tableId, args.recordIds);
					return formatToolResponse(records.map((record) => ({
						id: record.id,
					})));
				}

				case 'create_table': {
					const args = CreateTableArgsSchema.parse(request.params.arguments);
					const table = await this.airtableService.createTable(
						args.baseId,
						args.name,
						args.fields,
						args.description,
					);
					return formatToolResponse(table);
				}

				case 'update_table': {
					const args = UpdateTableArgsSchema.parse(request.params.arguments);
					const table = await this.airtableService.updateTable(
						args.baseId,
						args.tableId,
						{name: args.name, description: args.description},
					);
					return formatToolResponse(table);
				}

				case 'create_field': {
					const args = CreateFieldArgsSchema.parse(request.params.arguments);
					const field = await this.airtableService.createField(
						args.baseId,
						args.tableId,
						args.nested.field,
					);
					return formatToolResponse(field);
				}

				case 'update_field': {
					const args = UpdateFieldArgsSchema.parse(request.params.arguments);
					const field = await this.airtableService.updateField(
						args.baseId,
						args.tableId,
						args.fieldId,
						{
							name: args.name,
							description: args.description,
						},
					);
					return formatToolResponse(field);
				}

				case 'analyze_automation_workflows': {
					const args = AnalyzeAutomationWorkflowsArgsSchema.parse(request.params.arguments);

					// Build filter formula for workflow analysis
					let filterFormula = '';
					const filters = [];

					if (args.workflowType) {
						filters.push(`{type} = "${args.workflowType}"`);
					}

					if (args.status) {
						filters.push(`{status} = "${args.status}"`);
					}

					if (filters.length > 0) {
						filterFormula = filters.length === 1 ? filters[0]! : `AND(${filters.join(', ')})`;
					}

					// Get workflow records
					const workflows = await this.airtableService.listRecords(
						args.baseId,
						args.tableId || 'tblWorkflows', // Default table name
						{
							filterByFormula: filterFormula || undefined,
							maxRecords: 100,
						},
					);

					// Analyze and categorize workflows
					const analysis = {
						totalWorkflows: workflows.length,
						byType: workflows.reduce<Record<string, number>>((acc, w) => {
							const type = w.fields.type as string;
							acc[type] = (acc[type] || 0) + 1;
							return acc;
						}, {}),
						byStatus: workflows.reduce<Record<string, number>>((acc, w) => {
							const status = w.fields.status as string;
							acc[status] = (acc[status] || 0) + 1;
							return acc;
						}, {}),
						recentExecutions: workflows.filter((w) => w.fields.lastRun).length,
						recommendations: this.generateWorkflowRecommendations(workflows),
					};

					return formatToolResponse({
						analysis,
						workflows: workflows.map((w) => ({
							id: w.id,
							name: w.fields.name,
							type: w.fields.type,
							status: w.fields.status,
							lastRun: w.fields.lastRun,
							config: w.fields.config,
						})),
					});
				}

				case 'manage_resume_data': {
					const args = ManageResumeDataArgsSchema.parse(request.params.arguments);

					const records = await this.airtableService.listRecords(args.baseId, args.tableId);

					let result;
					switch (args.action) {
						case 'analyze':
							result = this.analyzeResumeData(records, args.targetRole);
							break;
						case 'generate_draft':
							result = this.generateResumeDraft(records, args);
							break;
						case 'update_skills':
							result = this.updateSkillsForRole(records, args.targetRole);
							break;
						case 'format_experience':
							result = this.formatExperienceSection(records, args.style);
							break;
					}

					return formatToolResponse(result);
				}

				case 'trigger_automation': {
					const args = TriggerAutomationArgsSchema.parse(request.params.arguments);

					// Get the workflow record
					const workflow = await this.airtableService.getRecord(args.baseId, 'tblWorkflows', args.workflowId);

					if (args.mode === 'simulate') {
						// Simulate the workflow execution
						const simulation = this.simulateWorkflowExecution(workflow, args.parameters);
						return formatToolResponse({
							mode: 'simulation',
							workflow: {
								id: workflow.id,
								name: workflow.fields.name,
								type: workflow.fields.type,
							},
							parameters: args.parameters,
							simulation,
						});
					}

					// Execute the workflow (placeholder for actual execution)
					const execution = await this.executeWorkflow(workflow, args.parameters);

					// Update the workflow record with execution results
					await this.airtableService.updateRecords(args.baseId, 'tblWorkflows', [{
						id: args.workflowId,
						fields: {
							lastRun: new Date().toISOString(),
							results: execution.results,
						},
					}]);

					return formatToolResponse({
						mode: 'execution',
						workflow: {
							id: workflow.id,
							name: workflow.fields.name,
							type: workflow.fields.type,
						},
						execution,
					});
				}

				case 'generate_automation_summary': {
					const args = GenerateAutomationSummaryArgsSchema.parse(request.params.arguments);

					// Build time filter
					let timeFilter = '';
					const now = new Date();
					let startDate: Date;

					switch (args.timeRange) {
						case 'today':
							startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
							break;
						case 'week':
							startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
							break;
						case 'month':
							startDate = new Date(now.getFullYear(), now.getMonth(), 1);
							break;
						case 'all':
							startDate = new Date(0); // All time
							break;
					}

					if (args.timeRange !== 'all') {
						timeFilter = `IS_AFTER({lastRun}, "${startDate.toISOString()}")`;
					}

					// Add workflow type filter if specified
					let filterFormula = timeFilter;
					if (args.workflowType && timeFilter) {
						filterFormula = `AND(${timeFilter}, {type} = "${args.workflowType}")`;
					} else if (args.workflowType) {
						filterFormula = `{type} = "${args.workflowType}"`;
					}

					const workflows = await this.airtableService.listRecords(
						args.baseId,
						'tblWorkflows',
						{
							filterByFormula: filterFormula || undefined,
							maxRecords: 200,
						},
					);

					const summary = this.generateExecutionSummary(workflows, args);
					return formatToolResponse(summary);
				}

				default: {
					throw new Error(`Unknown tool: ${request.params.name}`);
				}
			}
		} catch (error) {
			return formatToolResponse(
				`Error in tool ${request.params.name}: ${error instanceof Error ? error.message : String(error)}`,
				true,
			);
		}
	}

	private generateWorkflowRecommendations(workflows: any[]): string[] {
		const recommendations = [];

		const inactiveWorkflows = workflows.filter((w) => w.fields.status === 'inactive');
		if (inactiveWorkflows.length > 0) {
			recommendations.push(`${inactiveWorkflows.length} inactive workflows could be reviewed or archived`);
		}

		const oldExecutions = workflows.filter((w) => {
			if (!w.fields.lastRun) {
				return true;
			}

			const lastRun = new Date(w.fields.lastRun);
			const weekAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
			return lastRun < weekAgo;
		});
		if (oldExecutions.length > 0) {
			recommendations.push(`${oldExecutions.length} workflows haven't run in over a week`);
		}

		return recommendations;
	}

	private analyzeResumeData(records: any[], targetRole?: string): any {
		const skills = records.filter((r) => r.fields.type === 'skill');
		const experience = records.filter((r) => r.fields.type === 'experience');
		const projects = records.filter((r) => r.fields.type === 'project');

		return {
			summary: {
				totalSkills: skills.length,
				totalExperience: experience.length,
				totalProjects: projects.length,
			},
			recommendations: targetRole
				? [
					`Optimize skills for ${targetRole} role`,
					'Highlight relevant experience',
					'Update project descriptions for impact',
				]
				: [
					'Add target role for specific recommendations',
				],
			skillGaps: targetRole ? this.identifySkillGaps(skills, targetRole) : [],
		};
	}

	private generateResumeDraft(records: any[], args: any): any {
		const style = args.style || 'concise';
		const targetRole = args.targetRole || 'Software Engineer';
		const yearsExp = args.yearsExperience || 5;

		return {
			draft: {
				header: {
					name: 'Balaji Rajput',
					title: `${targetRole} - ${yearsExp} Years Experience`,
					summary: style === 'concise'
						? 'Full-stack automation specialist building one-command Android→cloud systems.'
						: 'Experienced full-stack automation engineer with expertise in building comprehensive automation systems that integrate Android devices with cloud workflows, specializing in n8n, webhooks, and AI-driven content generation.',
				},
				sections: this.buildResumeSections(records, style, targetRole),
			},
			metadata: {
				style,
				targetRole,
				yearsExperience: yearsExp,
				generatedAt: new Date().toISOString(),
			},
		};
	}

	private updateSkillsForRole(records: any[], targetRole?: string): any {
		if (!targetRole) {
			return {message: 'Target role required for skill optimization'};
		}

		const skillSuggestions = this.getSkillSuggestionsForRole(targetRole);
		const currentSkills = records.filter((r) => r.fields.type === 'skill').map((r) => r.fields.name);

		return {
			targetRole,
			currentSkills,
			suggestedSkills: skillSuggestions,
			skillsToAdd: skillSuggestions.filter((s) => !currentSkills.includes(s)),
			skillsToEmphasize: currentSkills.filter((s) => skillSuggestions.includes(s)),
		};
	}

	private formatExperienceSection(records: any[], style?: string): any {
		const experience = records.filter((r) => r.fields.type === 'experience');
		const format = style || 'concise';

		return {
			formattedExperience: experience.map((exp) => ({
				company: exp.fields.company,
				role: exp.fields.role,
				duration: exp.fields.duration,
				description: format === 'concise'
					? this.createConciseDescription(exp.fields.description)
					: this.createDetailedDescription(exp.fields.description),
				achievements: exp.fields.achievements || [],
			})),
			style: format,
		};
	}

	private simulateWorkflowExecution(workflow: any, _parameters?: any): any {
		const workflowType = workflow.fields.type;

		const baseSimulation = {
			workflowType,
			estimatedDuration: '2-5 minutes',
			resourcesNeeded: ['Airtable API', 'AI processing'],
			steps: [],
		};

		switch (workflowType) {
			case 'resume_builder':
				return {
					...baseSimulation,
					steps: [
						'Fetch resume data from Airtable',
						'Apply target role optimization',
						'Generate formatted output',
						'Save to specified location',
					],
					estimatedOutputs: ['Resume.md', 'Resume.pdf'],
				};

			case 'linkedin_post':
				return {
					...baseSimulation,
					steps: [
						'Draft content based on parameters',
						'Apply formatting and hashtags',
						'Validate post length and content',
						'Prepare for publishing',
					],
					estimatedOutputs: ['LinkedIn post draft', 'Scheduling confirmation'],
				};

			default:
				return {
					...baseSimulation,
					steps: ['Execute workflow steps', 'Process results', 'Update status'],
				};
		}
	}

	private async executeWorkflow(workflow: any, parameters?: any): Promise<any> {
		// This is a placeholder for actual workflow execution
		// In a real implementation, this would trigger n8n workflows or other automation systems

		const workflowType = workflow.fields.type;
		const startTime = new Date();

		// Simulate some processing time
		await new Promise<void>((resolve) => {
			setTimeout(() => resolve(), 1000);
		});

		const execution = {
			executionId: `exec_${Date.now()}`,
			startTime: startTime.toISOString(),
			endTime: new Date().toISOString(),
			status: 'completed',
			results: {
				message: `Successfully executed ${workflowType} workflow`,
				outputs: this.generateMockOutputs(workflowType, parameters),
			},
		};

		return execution;
	}

	private generateExecutionSummary(workflows: any[], args: any): any {
		const executions = workflows.filter((w) => w.fields.lastRun);

		const summary = {
			timeRange: args.timeRange,
			totalWorkflows: workflows.length,
			executedWorkflows: executions.length,
			byType: workflows.reduce<Record<string, number>>((acc, w) => {
				const type = String(w.fields.type);
				acc[type] = (acc[type] || 0) + 1;
				return acc;
			}, {}),
			recentActivity: executions.map((w) => ({
				name: w.fields.name,
				type: w.fields.type,
				lastRun: w.fields.lastRun,
				status: w.fields.status,
				results: args.includeResults ? w.fields.results : undefined,
			})),
			insights: this.generateInsights(workflows, executions),
		};

		return summary;
	}

	// Helper methods for automation logic
	private identifySkillGaps(skills: any[], targetRole: string): string[] {
		const roleSkillMap: Record<string, string[]> = {
			'Senior Automation Engineer': ['n8n', 'Docker', 'APIs', 'Webhooks', 'CI/CD'],
			'Full-Stack Developer': ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'REST APIs'],
			'DevOps Engineer': ['Kubernetes', 'Terraform', 'AWS', 'Jenkins', 'Monitoring'],
		};

		const requiredSkills = roleSkillMap[targetRole] || [];
		const currentSkills = skills.map((s) => s.fields.name);

		return requiredSkills.filter((skill) => !currentSkills.includes(skill));
	}

	private buildResumeSections(records: any[], style: string, _targetRole: string): any {
		const experience = records.filter((r) => r.fields.type === 'experience');
		const skills = records.filter((r) => r.fields.type === 'skill');
		const projects = records.filter((r) => r.fields.type === 'project');

		return {
			experience: experience.slice(0, style === 'concise' ? 3 : 5),
			skills: skills.map((s) => s.fields.name).slice(0, 12),
			projects: projects.slice(0, style === 'concise' ? 2 : 4),
		};
	}

	private getSkillSuggestionsForRole(targetRole: string): string[] {
		const roleSkillMap: Record<string, string[]> = {
			'Senior Automation Engineer': ['n8n', 'Zapier', 'Docker', 'Kubernetes', 'APIs', 'Webhooks', 'Python', 'Node.js'],
			'Full-Stack Developer': ['React', 'Vue.js', 'Node.js', 'TypeScript', 'PostgreSQL', 'MongoDB', 'REST APIs', 'GraphQL'],
			'DevOps Engineer': ['AWS', 'GCP', 'Terraform', 'Ansible', 'Kubernetes', 'Docker', 'Jenkins', 'GitLab CI'],
		};

		return roleSkillMap[targetRole] || ['Communication', 'Problem Solving', 'Team Collaboration'];
	}

	private createConciseDescription(description: string): string {
		if (!description) {
			return '';
		}

		const sentences = description.split('.').filter((s) => s.trim());
		return sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '');
	}

	private createDetailedDescription(description: string): string {
		return description || '';
	}

	private generateMockOutputs(workflowType: string, parameters?: any): any {
		switch (workflowType) {
			case 'resume_builder':
				return {
					resumeUrl: '/drive/resumes/latest_resume.pdf',
					format: parameters?.style || 'concise',
					sections: ['Summary', 'Experience', 'Skills', 'Projects'],
				};

			case 'linkedin_post':
				return {
					postContent: 'Excited to share my latest automation project...',
					hashtags: ['#automation', '#n8n', '#ai'],
					estimatedReach: '500-1000 connections',
				};

			default:
				return {
					status: 'completed',
					timestamp: new Date().toISOString(),
				};
		}
	}

	private generateInsights(workflows: any[], executions: any[]): string[] {
		const insights = [];

		if (executions.length === 0) {
			insights.push('No recent workflow executions detected');
		} else {
			const executionRate = (executions.length / workflows.length) * 100;
			insights.push(`${executionRate.toFixed(1)}% of workflows have recent activity`);
		}

		const mostActiveType = this.getMostActiveWorkflowType(executions);
		if (mostActiveType) {
			insights.push(`Most active workflow type: ${mostActiveType}`);
		}

		return insights;
	}

	private getMostActiveWorkflowType(executions: any[]): string | null {
		if (executions.length === 0) {
			return null;
		}

		const typeCounts = executions.reduce<Record<string, number>>((acc, e) => {
			const type = String(e.fields.type);
			acc[type] = (acc[type] || 0) + 1;
			return acc;
		}, {});

		return Object.entries(typeCounts).reduce((a, b) => typeCounts[a[0]] > typeCounts[b[0]] ? a : b)[0];
	}
}
