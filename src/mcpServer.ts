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
					name: 'analyze_automation_tools',
					description: 'Get comprehensive analysis of AI automation tools including speed, ease of use, and pricing',
					inputSchema: {
						type: 'object',
						properties: {
							category: {
								type: 'string',
								enum: ['all', 'fastest', 'easiest', 'free', 'ai-agents'],
								description: 'Filter tools by category - all tools, fastest, easiest to use, free options, or AI agents',
							},
						},
						required: [],
					},
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

				case 'analyze_automation_tools': {
					const args = request.params.arguments as {category?: string};
					const category = args?.category || 'all';

					const automationToolsData = this.getAutomationToolsAnalysis(category);
					return formatToolResponse(automationToolsData);
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

	private getAutomationToolsAnalysis(category: string): any {
		const tools = {
			'Make.com': {
				speed: 'बहुत तेज़',
				easeOfUse: 'बहुत आसान',
				pricing: '$9/माह या 1,000 मुफ्त ऑपरेशन/माह',
				features: ['विज़ुअल इंटरफ़ेस', 'बिना कोड के ऑटोमेशन', 'Zapier से सस्ता'],
				bestFor: 'शुरुआती और छोटे व्यवसाय',
				offer: 'मुफ्त टियर: 1,000 ऑपरेशन/माह',
				category: ['fastest', 'easiest'],
			},
			Zapier: {
				speed: 'मध्यम',
				easeOfUse: 'बहुत आसान',
				pricing: 'केवल 100 मुफ्त टास्क/माह, फिर महंगे प्लान',
				features: ['7,000+ ऐप्स इंटीग्रेशन', 'सबसे अधिक कनेक्टिविटी', 'सरल इंटरफ़ेस'],
				bestFor: 'गैर-तकनीकी उपयोगकर्ता',
				offer: 'मुफ्त टियर: 100 टास्क/माह',
				category: ['easiest'],
			},
			n8n: {
				speed: 'बहुत तेज़',
				easeOfUse: 'मध्यम (सीखने की आवश्यकता)',
				pricing: 'पूर्णतः मुफ्त (Self-Hosted)',
				features: ['ओपन-सोर्स', 'असीमित ऑटोमेशन', 'कोड जोड़ने की सुविधा'],
				bestFor: 'तकनीकी उपयोगकर्ता और डेवलपर्स',
				offer: 'Community Edition पूर्णतः मुफ्त',
				category: ['fastest', 'free'],
			},
			'Google Apps Script': {
				speed: 'तेज़',
				easeOfUse: 'मध्यम से कठिन',
				pricing: 'पूर्णतः मुफ्त और असीमित',
				features: ['Google Workspace एकीकरण', 'जावास्क्रिप्ट आधारित', 'कोई मासिक सीमा नहीं'],
				bestFor: 'Google Workspace उपयोगकर्ता',
				offer: 'Google खाते के साथ पूर्णतः मुफ्त',
				category: ['free'],
			},
			'Google Gemini 2.0': {
				speed: 'अत्यंत तेज़',
				easeOfUse: 'कठिन (डेवलपर के लिए)',
				pricing: 'मुफ्त टियर उपलब्ध',
				features: ['सबसे उन्नत AI', 'टेक्स्ट/इमेज/ऑडियो समझता है', 'API एक्सेस'],
				bestFor: 'AI-संचालित एप्लिकेशन',
				offer: 'मुफ्त टियर + पेड ऑप्शन',
				category: ['fastest', 'ai-agents'],
			},
			'AutoGen (Microsoft)': {
				speed: 'तेज़',
				easeOfUse: 'कठिन (डेवलपर के लिए)',
				pricing: 'पूर्णतः मुफ्त (ओपन-सोर्स)',
				features: ['मल्टी-एजेंट सिस्टम', 'एजेंट कोलैबोरेशन', 'ओपन-सोर्स'],
				bestFor: 'उन्नत AI एजेंट डेवलपमेंट',
				offer: 'GitHub से मुफ्त डाउनलोड',
				category: ['free', 'ai-agents'],
			},
			CrewAI: {
				speed: 'तेज़',
				easeOfUse: 'मध्यम से कठिन',
				pricing: 'पूर्णतः मुफ्त (ओपन-सोर्स)',
				features: ['AI एजेंट टीम', 'रोल-बेस्ड एजेंट्स', 'Python फ्रेमवर्क'],
				bestFor: 'AI एजेंट टीम बनाना',
				offer: 'ओपन-सोर्स लाइसेंस',
				category: ['free', 'ai-agents'],
			},
		};

		const recommendations = {
			fastest: {
				title: 'सबसे तेज़ टूल्स',
				tools: ['Make.com', 'n8n', 'Google Gemini 2.0'],
				description: 'ये टूल्स सबसे तेज़ प्रदर्शन प्रदान करते हैं',
			},
			easiest: {
				title: 'सबसे आसान टूल्स',
				tools: ['Make.com', 'Zapier'],
				description: 'शुरुआती लोगों के लिए सबसे अच्छे विकल्प',
			},
			free: {
				title: 'मुफ्त विकल्प',
				tools: ['n8n', 'Google Apps Script', 'AutoGen (Microsoft)', 'CrewAI'],
				description: 'कोई लागत के बिना शक्तिशाली ऑटोमेशन',
			},
			'ai-agents': {
				title: 'AI एजेंट टूल्स',
				tools: ['Google Gemini 2.0', 'AutoGen (Microsoft)', 'CrewAI'],
				description: 'उन्नत AI एजेंट डेवलपमेंट के लिए',
			},
		};

		if (category === 'all') {
			return {
				summary: 'सभी AI ऑटोमेशन टूल्स का विश्लेषण',
				tools,
				recommendations,
				conclusion: {
					beginners: 'Make.com - सबसे अच्छा बैलेंस',
					technical: 'n8n - मुफ्त और शक्तिशाली',
					google_users: 'Google Apps Script - मुफ्त Google इंटीग्रेशन',
					ai_development: 'Google Gemini 2.0 - सबसे उन्नत',
				},
			};
		}

		if (category in recommendations) {
			const rec = recommendations[category as keyof typeof recommendations];
			const filteredTools: Record<string, any> = {};

			for (const toolName of rec.tools) {
				if (toolName in tools) {
					filteredTools[toolName] = tools[toolName as keyof typeof tools];
				}
			}

			return {
				category: rec.title,
				description: rec.description,
				tools: filteredTools,
			};
		}

		return {
			error: 'अज्ञात श्रेणी',
			availableCategories: ['all', 'fastest', 'easiest', 'free', 'ai-agents'],
		};
	}
}
