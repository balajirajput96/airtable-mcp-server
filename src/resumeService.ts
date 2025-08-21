import {type z} from 'zod';
import {
	type IAirtableService,
	type AirtableRecord,
	type ResumeData,
	type ResumeProfile,
	type ResumeExperience,
	type ResumeEducation,
	type ResumeProject,
	type ResumeSkill,
	type ResumeCertification,
	ResumeGenerationArgsSchema,
} from './types.js';

export class ResumeService {
	constructor(private airtableService: IAirtableService) {}

	async generateResume(args: z.infer<typeof ResumeGenerationArgsSchema>): Promise<{
		resumeData: ResumeData;
		markdown?: string;
		json?: string;
	}> {
		// Extract resume data from Airtable
		const resumeData = await this.extractResumeData(args);

		// Generate formatted output based on requested format
		const result: {resumeData: ResumeData; markdown?: string; json?: string} = {
			resumeData,
		};

		if (args.format === 'markdown' || args.format === 'json') {
			if (args.format === 'markdown') {
				result.markdown = this.generateMarkdown(resumeData, args);
			}
			if (args.format === 'json') {
				result.json = JSON.stringify(resumeData, null, 2);
			}
		}

		return result;
	}

	private async extractResumeData(args: z.infer<typeof ResumeGenerationArgsSchema>): Promise<ResumeData> {
		// Extract profile information
		const profile = await this.extractProfile(args.baseId, args.profileTableId, args.profileRecordId);

		// Extract experience data
		const experience = args.experienceTableId
			? await this.extractExperience(args.baseId, args.experienceTableId, args.maxExperience)
			: [];

		// Extract education data
		const education = args.educationTableId
			? await this.extractEducation(args.baseId, args.educationTableId)
			: [];

		// Extract projects data
		const projects = args.projectsTableId && args.includeProjects
			? await this.extractProjects(args.baseId, args.projectsTableId, args.maxProjects)
			: [];

		// Extract skills data
		const skills = args.skillsTableId
			? await this.extractSkills(args.baseId, args.skillsTableId)
			: [];

		// Extract certifications data
		const certifications = args.certificationsTableId && args.includeCertifications
			? await this.extractCertifications(args.baseId, args.certificationsTableId)
			: [];

		return {
			profile,
			experience,
			education,
			projects,
			skills,
			certifications,
		};
	}

	private async extractProfile(baseId: string, tableId: string, recordId?: string): Promise<ResumeProfile> {
		let profileRecord: AirtableRecord;

		if (recordId) {
			profileRecord = await this.airtableService.getRecord(baseId, tableId, recordId);
		} else {
			const records = await this.airtableService.listRecords(baseId, tableId, {maxRecords: 1});
			if (records.length === 0) {
				throw new Error('No profile record found');
			}
			profileRecord = records[0]!;
		}

		return {
			name: this.getFieldValue(profileRecord, ['name', 'fullName', 'full_name']) || '',
			email: this.getFieldValue(profileRecord, ['email', 'emailAddress', 'email_address']),
			phone: this.getFieldValue(profileRecord, ['phone', 'phoneNumber', 'phone_number']),
			location: this.getFieldValue(profileRecord, ['location', 'address', 'city']),
			summary: this.getFieldValue(profileRecord, ['summary', 'bio', 'description']),
			linkedin: this.getFieldValue(profileRecord, ['linkedin', 'linkedinUrl', 'linkedin_url']),
			github: this.getFieldValue(profileRecord, ['github', 'githubUrl', 'github_url']),
			portfolio: this.getFieldValue(profileRecord, ['portfolio', 'website', 'portfolioUrl']),
		};
	}

	private async extractExperience(baseId: string, tableId: string, maxRecords?: number): Promise<ResumeExperience[]> {
		const records = await this.airtableService.listRecords(baseId, tableId, {
			maxRecords: maxRecords || 10,
			sort: [{field: 'startDate', direction: 'desc'}],
		});

		return records.map((record): ResumeExperience => ({
			company: this.getFieldValue(record, ['company', 'employer', 'organization']) || '',
			title: this.getFieldValue(record, ['title', 'position', 'role']) || '',
			startDate: this.getFieldValue(record, ['startDate', 'start_date', 'start']) || '',
			endDate: this.getFieldValue(record, ['endDate', 'end_date', 'end']),
			current: this.getFieldValue(record, ['current', 'isCurrent']) || false,
			description: this.getFieldValue(record, ['description', 'summary', 'responsibilities']),
			achievements: this.parseArrayField(record, ['achievements', 'accomplishments', 'highlights']),
			technologies: this.parseArrayField(record, ['technologies', 'skills', 'tech_stack']),
		}));
	}

	private async extractEducation(baseId: string, tableId: string): Promise<ResumeEducation[]> {
		const records = await this.airtableService.listRecords(baseId, tableId, {
			sort: [{field: 'endDate', direction: 'desc'}],
		});

		return records.map((record): ResumeEducation => ({
			institution: this.getFieldValue(record, ['institution', 'school', 'university']) || '',
			degree: this.getFieldValue(record, ['degree', 'qualification']) || '',
			field: this.getFieldValue(record, ['field', 'major', 'subject']),
			startDate: this.getFieldValue(record, ['startDate', 'start_date', 'start']),
			endDate: this.getFieldValue(record, ['endDate', 'end_date', 'end']),
			gpa: this.getFieldValue(record, ['gpa', 'grade', 'score']),
			achievements: this.parseArrayField(record, ['achievements', 'honors', 'awards']),
		}));
	}

	private async extractProjects(baseId: string, tableId: string, maxRecords?: number): Promise<ResumeProject[]> {
		const records = await this.airtableService.listRecords(baseId, tableId, {
			maxRecords: maxRecords || 5,
			sort: [{field: 'endDate', direction: 'desc'}],
		});

		return records.map((record): ResumeProject => ({
			name: this.getFieldValue(record, ['name', 'title', 'project_name']) || '',
			description: this.getFieldValue(record, ['description', 'summary']) || '',
			technologies: this.parseArrayField(record, ['technologies', 'tech_stack', 'tools']),
			startDate: this.getFieldValue(record, ['startDate', 'start_date', 'start']),
			endDate: this.getFieldValue(record, ['endDate', 'end_date', 'end']),
			url: this.getFieldValue(record, ['url', 'website', 'demo_url']),
			github: this.getFieldValue(record, ['github', 'github_url', 'repository']),
			highlights: this.parseArrayField(record, ['highlights', 'achievements', 'features']),
		}));
	}

	private async extractSkills(baseId: string, tableId: string): Promise<ResumeSkill[]> {
		const records = await this.airtableService.listRecords(baseId, tableId);

		return records.map((record): ResumeSkill => ({
			category: this.getFieldValue(record, ['category', 'type', 'skill_type']) || '',
			skills: this.parseArrayField(record, ['skills', 'skill_list', 'technologies']),
			proficiency: this.getFieldValue(record, ['proficiency', 'level']) as 'beginner' | 'intermediate' | 'advanced' | 'expert' | undefined,
		}));
	}

	private async extractCertifications(baseId: string, tableId: string): Promise<ResumeCertification[]> {
		const records = await this.airtableService.listRecords(baseId, tableId, {
			sort: [{field: 'date', direction: 'desc'}],
		});

		return records.map((record): ResumeCertification => ({
			name: this.getFieldValue(record, ['name', 'title', 'certification']) || '',
			issuer: this.getFieldValue(record, ['issuer', 'organization', 'provider']) || '',
			date: this.getFieldValue(record, ['date', 'issue_date', 'obtained']),
			expiryDate: this.getFieldValue(record, ['expiryDate', 'expiry_date', 'expires']),
			credentialId: this.getFieldValue(record, ['credentialId', 'credential_id', 'id']),
			url: this.getFieldValue(record, ['url', 'link', 'verification_url']),
		}));
	}

	private getFieldValue(record: AirtableRecord, fieldNames: string[]): any {
		for (const fieldName of fieldNames) {
			if (record.fields[fieldName] !== undefined && record.fields[fieldName] !== null) {
				return record.fields[fieldName];
			}
		}
		return undefined;
	}

	private parseArrayField(record: AirtableRecord, fieldNames: string[]): string[] {
		const value = this.getFieldValue(record, fieldNames);
		if (!value) return [];
		
		if (Array.isArray(value)) {
			return value.map(item => typeof item === 'string' ? item : String(item));
		}
		
		if (typeof value === 'string') {
			// Try to parse as comma-separated or newline-separated
			return value.split(/[,\n]/).map(item => item.trim()).filter(item => item.length > 0);
		}
		
		return [String(value)];
	}

	private generateMarkdown(resumeData: ResumeData, args: z.infer<typeof ResumeGenerationArgsSchema>): string {
		const sections: string[] = [];

		// Header
		sections.push(`# ${resumeData.profile.name}`);
		
		const contactInfo: string[] = [];
		if (resumeData.profile.email) contactInfo.push(`Email: ${resumeData.profile.email}`);
		if (resumeData.profile.phone) contactInfo.push(`Phone: ${resumeData.profile.phone}`);
		if (resumeData.profile.location) contactInfo.push(`Location: ${resumeData.profile.location}`);
		if (resumeData.profile.linkedin) contactInfo.push(`LinkedIn: ${resumeData.profile.linkedin}`);
		if (resumeData.profile.github) contactInfo.push(`GitHub: ${resumeData.profile.github}`);
		if (resumeData.profile.portfolio) contactInfo.push(`Portfolio: ${resumeData.profile.portfolio}`);
		
		if (contactInfo.length > 0) {
			sections.push(contactInfo.join(' | '));
		}

		// Summary
		if (resumeData.profile.summary) {
			sections.push('## Summary');
			sections.push(resumeData.profile.summary);
		}

		// Experience
		if (resumeData.experience.length > 0) {
			sections.push('## Professional Experience');
			for (const exp of resumeData.experience) {
				const dateRange = exp.current ? `${exp.startDate} - Present` : `${exp.startDate} - ${exp.endDate || 'Present'}`;
				sections.push(`### ${exp.title} - ${exp.company}`);
				sections.push(`*${dateRange}*`);
				
				if (exp.description) {
					sections.push(exp.description);
				}
				
				if (exp.achievements.length > 0) {
					sections.push('**Key Achievements:**');
					for (const achievement of exp.achievements) {
						sections.push(`- ${achievement}`);
					}
				}
				
				if (exp.technologies.length > 0) {
					sections.push(`**Technologies:** ${exp.technologies.join(', ')}`);
				}
				sections.push('');
			}
		}

		// Projects
		if (resumeData.projects.length > 0 && args.includeProjects) {
			sections.push('## Projects');
			for (const project of resumeData.projects) {
				sections.push(`### ${project.name}`);
				sections.push(project.description);
				
				if (project.technologies.length > 0) {
					sections.push(`**Technologies:** ${project.technologies.join(', ')}`);
				}
				
				const links: string[] = [];
				if (project.url) links.push(`[Demo](${project.url})`);
				if (project.github) links.push(`[GitHub](${project.github})`);
				
				if (links.length > 0) {
					sections.push(links.join(' | '));
				}
				
				if (project.highlights.length > 0) {
					for (const highlight of project.highlights) {
						sections.push(`- ${highlight}`);
					}
				}
				sections.push('');
			}
		}

		// Education
		if (resumeData.education.length > 0) {
			sections.push('## Education');
			for (const edu of resumeData.education) {
				const degree = edu.field ? `${edu.degree} in ${edu.field}` : edu.degree;
				const dateRange = edu.endDate ? `${edu.startDate || ''} - ${edu.endDate}` : edu.startDate || '';
				
				sections.push(`### ${degree}`);
				sections.push(`${edu.institution} ${dateRange ? `(${dateRange})` : ''}`);
				
				if (edu.gpa) {
					sections.push(`GPA: ${edu.gpa}`);
				}
				
				if (edu.achievements.length > 0) {
					for (const achievement of edu.achievements) {
						sections.push(`- ${achievement}`);
					}
				}
				sections.push('');
			}
		}

		// Skills
		if (resumeData.skills.length > 0) {
			sections.push('## Skills');
			for (const skillGroup of resumeData.skills) {
				const proficiencyText = skillGroup.proficiency ? ` (${skillGroup.proficiency})` : '';
				sections.push(`**${skillGroup.category}${proficiencyText}:** ${skillGroup.skills.join(', ')}`);
			}
			sections.push('');
		}

		// Certifications
		if (resumeData.certifications.length > 0 && args.includeCertifications) {
			sections.push('## Certifications');
			for (const cert of resumeData.certifications) {
				const certLine = `**${cert.name}** - ${cert.issuer}`;
				const dateInfo = cert.date ? ` (${cert.date})` : '';
				sections.push(`${certLine}${dateInfo}`);
				
				if (cert.credentialId) {
					sections.push(`Credential ID: ${cert.credentialId}`);
				}
				
				if (cert.url) {
					sections.push(`[Verify](${cert.url})`);
				}
			}
		}

		return sections.join('\n\n');
	}
}