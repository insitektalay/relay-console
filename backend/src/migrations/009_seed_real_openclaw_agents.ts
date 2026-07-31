import { MigrationInterface, QueryRunner } from 'typeorm'

export class SeedRealOpenClawAgents1774179000000 implements MigrationInterface {
  name = 'SeedRealOpenClawAgents1774179000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const workspaceId = 'b0000002-0000-0000-0000-000000000001'
    const workspaceExists = await queryRunner.query(
      `SELECT 1 FROM workspaces WHERE id = $1 LIMIT 1`,
      [workspaceId],
    )

    if (!workspaceExists.length) {
      return
    }

    const agents = [
      {
        name: 'The Distressed Dad Bot',
        role: 'Main Orchestrator',
        description: 'Primary orchestration agent — manages and coordinates all other agents.',
        status: 'on_duty',
        capabilities: ['orchestration', 'coordination', 'task-management'],
      },
      {
        name: 'Inspector Gadget',
        role: 'Research & Investigation',
        description: 'Inspects, audits, and investigates tasks and data pipelines.',
        status: 'on_duty',
        capabilities: ['research', 'investigation', 'data-analysis'],
      },
      {
        name: 'Postman Pat',
        role: 'API & Messaging',
        description: 'Handles API calls, webhooks, and message delivery.',
        status: 'on_duty',
        capabilities: ['api-calls', 'webhooks', 'messaging'],
      },
      {
        name: 'SaaS Marketing Dude',
        role: 'Growth & Marketing',
        description: 'Drives growth, marketing campaigns, and SaaS acquisition strategies.',
        status: 'on_duty',
        capabilities: ['marketing', 'growth', 'copywriting', 'saas'],
      },
      {
        name: 'Ebenezer Scrooge',
        role: 'Finance & Cost Control',
        description: 'Monitors budgets, cuts costs, and enforces financial discipline.',
        status: 'on_duty',
        capabilities: ['finance', 'budgeting', 'cost-control'],
      },
      {
        name: 'Cinderella',
        role: 'Operations & Scheduling',
        description: 'Keeps operations running on time — scheduling, logistics, and task sequencing.',
        status: 'on_duty',
        capabilities: ['scheduling', 'logistics', 'operations'],
      },
      {
        name: 'Kitty',
        role: 'Customer Support',
        description: 'Friendly customer-facing support agent handling queries and escalations.',
        status: 'on_duty',
        capabilities: ['customer-support', 'communication', 'escalation'],
      },
      {
        name: 'Tosser',
        role: 'General Assistant',
        description: 'Handles miscellaneous tasks that other agents throw over the fence.',
        status: 'idle',
        capabilities: ['general', 'task-handling'],
      },
      {
        name: 'Inkadu Researcher',
        role: 'Market Research',
        description: 'Deep research agent specialising in market intelligence and competitive analysis.',
        status: 'on_duty',
        capabilities: ['research', 'market-intelligence', 'competitive-analysis'],
      },
      {
        name: 'Koh Phangan Holidays',
        role: 'Travel & Lifestyle',
        description: 'Manages travel bookings, itineraries, and lifestyle planning.',
        status: 'idle',
        capabilities: ['travel', 'bookings', 'itinerary-planning'],
      },
      {
        name: 'Gapminer',
        role: 'Gap Analysis',
        description: 'Identifies gaps in content, markets, and processes for strategic advantage.',
        status: 'on_duty',
        capabilities: ['gap-analysis', 'content-strategy', 'research'],
      },
      {
        name: 'Gapminer Auditor',
        role: 'Quality Auditor',
        description: 'Audits Gapminer output for accuracy, completeness, and quality.',
        status: 'on_duty',
        capabilities: ['auditing', 'quality-control', 'gap-analysis'],
      },
      {
        name: 'My Gapminer Orchestrator',
        role: 'Orchestrator',
        description: 'Coordinates the Gapminer pipeline across researcher and auditor agents.',
        status: 'on_duty',
        capabilities: ['orchestration', 'pipeline-management', 'gap-analysis'],
      },
      {
        name: 'My Lizard Chief of Staff',
        role: 'Chief of Staff',
        description: 'Top-level strategic coordination and decision support for the Lizard org.',
        status: 'on_duty',
        capabilities: ['strategy', 'coordination', 'decision-support'],
      },
      {
        name: 'My Lizard Press Secretary',
        role: 'Communications',
        description: 'Drafts press releases, public statements, and external communications.',
        status: 'on_duty',
        capabilities: ['copywriting', 'communications', 'pr'],
      },
      {
        name: 'My Lizard Staff Secretary',
        role: 'Administrative Assistant',
        description: 'Manages internal correspondence, scheduling, and staff logistics.',
        status: 'idle',
        capabilities: ['administration', 'scheduling', 'correspondence'],
      },
      {
        name: 'My Lizard National Advisor',
        role: 'Strategic Advisor',
        description: 'Provides high-level strategic and policy advice across domains.',
        status: 'idle',
        capabilities: ['strategy', 'advisory', 'policy'],
      },
      {
        name: 'Rankscope Onpage Optimizer',
        role: 'SEO Specialist',
        description: 'Optimises on-page SEO elements for improved search engine rankings.',
        status: 'on_duty',
        capabilities: ['seo', 'content-optimization', 'keyword-research'],
      },
    ]

    for (const agent of agents) {
      await queryRunner.query(
        `
        INSERT INTO agents (
          id, name, role, description, status, "workspaceId", capabilities,
          "workingHoursMode", timezone,
          "tasksCompletedToday", "successRate", "avgCompletionMinutes",
          "totalMinutesWorked", "budgetUsed",
          "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb,
          'scheduled', 'UTC',
          0, 0, 0, 0, 0,
          NOW(), NOW()
        )
        `,
        [
          agent.name,
          agent.role,
          agent.description,
          agent.status,
          workspaceId,
          JSON.stringify(agent.capabilities),
        ],
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM agents
      WHERE "workspaceId" = 'b0000002-0000-0000-0000-000000000001'
    `)
  }
}
