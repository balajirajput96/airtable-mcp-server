import {describe, test, expect, vi, beforeEach} from 'vitest';
import {ResumeService} from './resumeService.js';
import {type IAirtableService} from './types.js';

// Mock AirtableService
const mockAirtableService: IAirtableService = {
	listBases: vi.fn(),
	getBaseSchema: vi.fn(),
	listRecords: vi.fn(),
	getRecord: vi.fn(),
	createRecord: vi.fn(),
	updateRecords: vi.fn(),
	deleteRecords: vi.fn(),
	createTable: vi.fn(),
	updateTable: vi.fn(),
	createField: vi.fn(),
	updateField: vi.fn(),
	searchRecords: vi.fn(),
	generateResume: vi.fn(),
};

describe('ResumeService', () => {
	let resumeService: ResumeService;

	beforeEach(() => {
		vi.clearAllMocks();
		resumeService = new ResumeService(mockAirtableService);
	});

	test('should generate basic resume with profile data', async () => {
		const profileRecord = {
			id: 'prof1',
			fields: {
				name: 'John Doe',
				email: 'john@example.com',
				summary: 'Software engineer with 5 years experience',
			},
		};

		const experienceRecords = [
			{
				id: 'exp1',
				fields: {
					company: 'Tech Corp',
					title: 'Senior Developer',
					startDate: '2020-01-01',
					endDate: '2023-12-31',
					description: 'Led development of web applications',
					achievements: ['Improved performance by 50%', 'Led team of 5 developers'],
					technologies: ['React', 'Node.js', 'TypeScript'],
				},
			},
		];

		// Mock service calls
		vi.mocked(mockAirtableService.listRecords)
			.mockResolvedValueOnce([profileRecord]) // Profile table
			.mockResolvedValueOnce(experienceRecords); // Experience table

		const args = {
			baseId: 'base123',
			profileTableId: 'tblProfile',
			experienceTableId: 'tblExperience',
			format: 'markdown' as const,
			style: 'concise' as const,
			language: 'en',
			includeProjects: true,
			includeCertifications: true,
		};

		const result = await resumeService.generateResume(args);

		expect(result.resumeData.profile.name).toBe('John Doe');
		expect(result.resumeData.profile.email).toBe('john@example.com');
		expect(result.resumeData.experience).toHaveLength(1);
		expect(result.resumeData.experience[0].company).toBe('Tech Corp');
		expect(result.markdown).toContain('# John Doe');
		expect(result.markdown).toContain('## Professional Experience');
		expect(result.markdown).toContain('Senior Developer - Tech Corp');
		expect(mockAirtableService.listRecords).toHaveBeenCalledTimes(2);
	});

	test('should handle missing optional tables', async () => {
		const profileRecord = {
			id: 'prof1',
			fields: {
				name: 'Jane Smith',
				email: 'jane@example.com',
			},
		};

		vi.mocked(mockAirtableService.listRecords).mockResolvedValueOnce([profileRecord]);

		const args = {
			baseId: 'base123',
			profileTableId: 'tblProfile',
			format: 'json' as const,
			style: 'concise' as const,
			language: 'en',
			includeProjects: true,
			includeCertifications: true,
		};

		const result = await resumeService.generateResume(args);

		expect(result.resumeData.profile.name).toBe('Jane Smith');
		expect(result.resumeData.experience).toHaveLength(0);
		expect(result.resumeData.projects).toHaveLength(0);
		expect(result.json).toBeDefined();
		expect(JSON.parse(result.json!)).toEqual(result.resumeData);
	});

	test('should throw error when no profile record found', async () => {
		vi.mocked(mockAirtableService.listRecords).mockResolvedValueOnce([]);

		const args = {
			baseId: 'base123',
			profileTableId: 'tblProfile',
			format: 'markdown' as const,
			style: 'concise' as const,
			language: 'en',
			includeProjects: true,
			includeCertifications: true,
		};

		await expect(resumeService.generateResume(args)).rejects.toThrow('No profile record found');
	});

	test('should extract skills data correctly', async () => {
		const profileRecord = {
			id: 'prof1',
			fields: {name: 'Test User'},
		};

		const skillsRecords = [
			{
				id: 'skill1',
				fields: {
					category: 'Programming Languages',
					skills: ['JavaScript', 'TypeScript', 'Python'],
					proficiency: 'advanced',
				},
			},
			{
				id: 'skill2',
				fields: {
					category: 'Frameworks',
					skills: 'React, Node.js, Express', // Test comma-separated string
				},
			},
		];

		vi.mocked(mockAirtableService.listRecords)
			.mockResolvedValueOnce([profileRecord])
			.mockResolvedValueOnce(skillsRecords);

		const args = {
			baseId: 'base123',
			profileTableId: 'tblProfile',
			skillsTableId: 'tblSkills',
			format: 'markdown' as const,
			style: 'concise' as const,
			language: 'en',
			includeProjects: true,
			includeCertifications: true,
		};

		const result = await resumeService.generateResume(args);

		expect(result.resumeData.skills).toHaveLength(2);
		expect(result.resumeData.skills[0].category).toBe('Programming Languages');
		expect(result.resumeData.skills[0].skills).toEqual(['JavaScript', 'TypeScript', 'Python']);
		expect(result.resumeData.skills[0].proficiency).toBe('advanced');
		expect(result.resumeData.skills[1].skills).toEqual(['React', 'Node.js', 'Express']);
	});
});