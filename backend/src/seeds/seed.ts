import "dotenv/config";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import { UserEntity } from "../entities/user.entity";
import { WorkspaceEntity } from "../entities/workspace.entity";
import { CompanyEntity } from "../entities/company.entity";
import { DepartmentEntity } from "../entities/department.entity";
import { TeamEntity } from "../entities/team.entity";
import { AgentEntity } from "../entities/agent.entity";
import { ThreadEntity } from "../entities/thread.entity";
import { MessageEntity } from "../entities/message.entity";
import { TaskEntity } from "../entities/task.entity";
import { RunEntity } from "../entities/run.entity";
import { RunEventEntity } from "../entities/run-event.entity";
import { WorkLogEntity } from "../entities/work-log.entity";
import { ApprovalEntity } from "../entities/approval.entity";
import { IncidentEntity } from "../entities/incident.entity";
import { ScheduleEntity } from "../entities/schedule.entity";
import { ShiftRuleEntity } from "../entities/shift-rule.entity";
import { PerformanceMetricEntity } from "../entities/performance-metric.entity";
import { ReviewEntity } from "../entities/review.entity";
import { CoachingNoteEntity } from "../entities/coaching-note.entity";
import { AlertEntity } from "../entities/alert.entity";
import { BudgetUsageEntity } from "../entities/budget-usage.entity";
import { TeamMemoryItemEntity } from "../entities/team-memory-item.entity";
import { OpenClawConnectionEntity } from "../entities/openclaw-connection.entity";
import { ThreadReadStateEntity } from "../entities/thread-read-state.entity";
import { assertDestructiveSeedAllowed } from "../config/production-env";
import {
  hashAccountPassword,
  isBcryptCompatiblePassword,
} from "../modules/auth/password-policy";

async function resolveSeedPasswordHash(): Promise<string> {
  const seedPassword = process.env.SEED_DEMO_PASSWORD || randomUUID();
  if (!isBcryptCompatiblePassword(seedPassword)) {
    throw new Error("SEED_DEMO_PASSWORD exceeds the 72-byte bcrypt limit");
  }
  return hashAccountPassword(seedPassword, 12);
}

// ─── Deterministic IDs ────────────────────────────────────────────────────────
const IDS = {
  // Users
  userAlex: "a0000001-0000-0000-0000-000000000001",
  userSarah: "a0000001-0000-0000-0000-000000000002",

  // Workspaces
  wsNexus: "b0000002-0000-0000-0000-000000000001",
  wsPersonal: "b0000002-0000-0000-0000-000000000002",

  // Company
  companyNexus: "c0000003-0000-0000-0000-000000000001",

  // Departments
  deptEng: "d0000004-0000-0000-0000-000000000001",
  deptCS: "d0000004-0000-0000-0000-000000000002",
  deptMktg: "d0000004-0000-0000-0000-000000000003",

  // Teams
  teamBackend: "e0000005-0000-0000-0000-000000000001",
  teamFrontend: "e0000005-0000-0000-0000-000000000002",
  teamSupport: "e0000005-0000-0000-0000-000000000003",
  teamOnboarding: "e0000005-0000-0000-0000-000000000004",
  teamContent: "e0000005-0000-0000-0000-000000000005",
  teamAnalytics: "e0000005-0000-0000-0000-000000000006",

  // Agents
  agentAtlas: "f0000006-0000-0000-0000-000000000001",
  agentEmber: "f0000006-0000-0000-0000-000000000002",
  agentNexus: "f0000006-0000-0000-0000-000000000003",
  agentScout: "f0000006-0000-0000-0000-000000000004",
  agentForge: "f0000006-0000-0000-0000-000000000005",
  agentEcho: "f0000006-0000-0000-0000-000000000006",
  agentSage: "f0000006-0000-0000-0000-000000000007",
  agentTitan: "f0000006-0000-0000-0000-000000000008",
  agentNova: "f0000006-0000-0000-0000-000000000009",
  agentCipher: "f0000006-0000-0000-0000-000000000010",
  agentIris: "f0000006-0000-0000-0000-000000000011",
  agentBolt: "f0000006-0000-0000-0000-000000000012",

  // Threads
  threadAlexAtlas: "01000007-0000-0000-0000-000000000001",
  threadAlexEmber: "01000007-0000-0000-0000-000000000002",
  threadAlexNexus: "01000007-0000-0000-0000-000000000003",
  threadAlexTitan: "01000007-0000-0000-0000-000000000004",
  threadBackendTeam: "01000007-0000-0000-0000-000000000005",
  threadCustomerSuccess: "01000007-0000-0000-0000-000000000006",
  threadEngDept: "01000007-0000-0000-0000-000000000007",
  threadNexusForge: "01000007-0000-0000-0000-000000000008",
  threadAtlasNova: "01000007-0000-0000-0000-000000000009",
  threadEmberIris: "01000007-0000-0000-0000-000000000010",
  threadAnalyticsGroup: "01000007-0000-0000-0000-000000000011",
  threadApproval: "01000007-0000-0000-0000-000000000012",
  threadIncident: "01000007-0000-0000-0000-000000000013",
  threadAlexSage: "01000007-0000-0000-0000-000000000014",
  threadMarketing: "01000007-0000-0000-0000-000000000015",

  // Tasks
  taskQ2Forecast: "02000008-0000-0000-0000-000000000001",
  taskTechCorp: "02000008-0000-0000-0000-000000000002",
  taskAuthDeploy: "02000008-0000-0000-0000-000000000003",
  taskOnboarding: "02000008-0000-0000-0000-000000000004",
  taskSecAudit: "02000008-0000-0000-0000-000000000005",
  taskPerfRegression: "02000008-0000-0000-0000-000000000006",

  // Approvals
  approvalAuth: "03000009-0000-0000-0000-000000000001",
  approvalPII: "03000009-0000-0000-0000-000000000002",
  approvalRateLimit: "03000009-0000-0000-0000-000000000003",

  // Incidents
  incidentForecast: "04000010-0000-0000-0000-000000000001",
  incidentCipher: "04000010-0000-0000-0000-000000000002",

  // Connection
  connectionNexus: "05000011-0000-0000-0000-000000000001",

  // Runs
  runQ2: "06000012-0000-0000-0000-000000000001",
  runTechCorp: "06000012-0000-0000-0000-000000000002",
  runSecAudit: "06000012-0000-0000-0000-000000000003",
  runPerfReg: "06000012-0000-0000-0000-000000000004",
};

function ago(hours: number): Date {
  return new Date(Date.now() - hours * 3600 * 1000);
}

function weekStart(offset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() - offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthStart(offset = 0): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function clearAll(ds: DataSource): Promise<void> {
  const entities = [
    "budget_usage",
    "coaching_notes",
    "reviews",
    "performance_metrics",
    "alerts",
    "team_memory_items",
    "shift_rules",
    "schedules",
    "work_logs",
    "run_events",
    "runs",
    "tasks",
    "approvals",
    "incidents",
    "messages",
    "thread_read_states",
    "threads",
    "openclaw_connections",
    "agents",
    "teams",
    "departments",
    "companies",
    "workspaces",
    "users",
  ];
  for (const entity of entities) {
    await ds.query(`DELETE FROM ${entity}`);
  }
}

export async function seed(): Promise<void> {
  assertDestructiveSeedAllowed();

  const ds = new DataSource({
    type: "postgres",
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432", 10),
    database: process.env.DATABASE_NAME || "clawchat",
    username: process.env.DATABASE_USER || "clawchat",
    password: process.env.DATABASE_PASSWORD || "clawchat_dev_password",
    entities: [
      UserEntity,
      WorkspaceEntity,
      CompanyEntity,
      DepartmentEntity,
      TeamEntity,
      AgentEntity,
      ThreadEntity,
      MessageEntity,
      TaskEntity,
      RunEntity,
      RunEventEntity,
      WorkLogEntity,
      ApprovalEntity,
      IncidentEntity,
      ScheduleEntity,
      ShiftRuleEntity,
      PerformanceMetricEntity,
      ReviewEntity,
      CoachingNoteEntity,
      AlertEntity,
      BudgetUsageEntity,
      TeamMemoryItemEntity,
      OpenClawConnectionEntity,
      ThreadReadStateEntity,
    ],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log("Connected to database. Clearing existing seed data...");
  await clearAll(ds);

  const passwordHash = await resolveSeedPasswordHash();

  // ─── Users ──────────────────────────────────────────────────────────────────
  console.log("Seeding users...");
  await ds.query(`
    INSERT INTO users (id, email, name, "passwordHash", "createdAt", "updatedAt")
    VALUES
      ('${IDS.userAlex}', 'seed-user-1@example.invalid', 'Seed User One', '${passwordHash}', NOW(), NOW()),
      ('${IDS.userSarah}', 'seed-user-2@example.invalid', 'Seed User Two', '${passwordHash}', NOW(), NOW())
  `);

  // ─── Workspaces ─────────────────────────────────────────────────────────────
  console.log("Seeding workspaces...");
  await ds.query(`
    INSERT INTO workspaces (id, name, type, description, "ownerId", "createdAt", "updatedAt")
    VALUES
      ('${IDS.wsNexus}', 'Nexus Corp', 'business', 'Nexus Corporation AI workforce management workspace', '${IDS.userAlex}', NOW(), NOW()),
      ('${IDS.wsPersonal}', 'Personal', 'personal', 'Personal AI assistant workspace', '${IDS.userAlex}', NOW(), NOW())
  `);

  // ─── Company ────────────────────────────────────────────────────────────────
  console.log("Seeding company...");
  await ds.query(`
    INSERT INTO companies (id, name, "workspaceId", description, industry, "createdAt", "updatedAt")
    VALUES ('${IDS.companyNexus}', 'Nexus Corporation', '${IDS.wsNexus}', 'Enterprise software and AI solutions company', 'Technology', NOW(), NOW())
  `);

  // ─── Departments ────────────────────────────────────────────────────────────
  console.log("Seeding departments...");
  await ds.query(`
    INSERT INTO departments (id, name, "companyId", description, color, "createdAt", "updatedAt")
    VALUES
      ('${IDS.deptEng}', 'Engineering', '${IDS.companyNexus}', 'Product and platform engineering', '#0A84FF', NOW(), NOW()),
      ('${IDS.deptCS}', 'Customer Success', '${IDS.companyNexus}', 'Customer support, onboarding and retention', '#30D158', NOW(), NOW()),
      ('${IDS.deptMktg}', 'Marketing & Growth', '${IDS.companyNexus}', 'Marketing, content, analytics and growth', '#FF9F0A', NOW(), NOW())
  `);

  // ─── Teams ──────────────────────────────────────────────────────────────────
  console.log("Seeding teams...");
  await ds.query(`
    INSERT INTO teams (id, name, "departmentId", description, color, "createdAt", "updatedAt")
    VALUES
      ('${IDS.teamBackend}', 'Backend Team', '${IDS.deptEng}', 'API, database, and server-side systems', '#0A84FF', NOW(), NOW()),
      ('${IDS.teamFrontend}', 'Frontend Team', '${IDS.deptEng}', 'Web and mobile application development', '#64D2FF', NOW(), NOW()),
      ('${IDS.teamSupport}', 'Support Team', '${IDS.deptCS}', 'Tier-1 and tier-2 customer support', '#30D158', NOW(), NOW()),
      ('${IDS.teamOnboarding}', 'Onboarding Team', '${IDS.deptCS}', 'New client onboarding and activation', '#34C759', NOW(), NOW()),
      ('${IDS.teamContent}', 'Content Team', '${IDS.deptMktg}', 'Content creation and SEO strategy', '#FF9F0A', NOW(), NOW()),
      ('${IDS.teamAnalytics}', 'Analytics Team', '${IDS.deptMktg}', 'Data analytics, reporting, and growth metrics', '#FFD60A', NOW(), NOW())
  `);

  // ─── Agents ─────────────────────────────────────────────────────────────────
  console.log("Seeding agents...");
  const agentRows = [
    {
      id: IDS.agentAtlas,
      name: "Atlas",
      role: "Senior Data Analyst",
      status: "on_duty",
      teamId: IDS.teamAnalytics,
      deptId: IDS.deptMktg,
      ws: IDS.wsNexus,
      caps: ["data_analysis", "reporting", "visualization", "sql", "python"],
      desc: "Specializes in complex data analysis, revenue modeling, and BI reporting.",
      tasks: 47,
      rate: 0.96,
      avgMin: 14,
      budget: 128.5,
      budgetLimit: 500,
    },
    {
      id: IDS.agentEmber,
      name: "Ember",
      role: "Customer Support Lead",
      status: "busy",
      teamId: IDS.teamSupport,
      deptId: IDS.deptCS,
      ws: IDS.wsNexus,
      caps: [
        "customer_support",
        "ticket_management",
        "escalation",
        "email",
        "crm",
      ],
      desc: "Expert in customer issue resolution, empathetic communication, and SLA management.",
      tasks: 112,
      rate: 0.94,
      avgMin: 8,
      budget: 89.2,
      budgetLimit: 400,
    },
    {
      id: IDS.agentNexus,
      name: "Nexus",
      role: "Backend Engineer",
      status: "on_duty",
      teamId: IDS.teamBackend,
      deptId: IDS.deptEng,
      ws: IDS.wsNexus,
      caps: [
        "api_development",
        "database",
        "system_design",
        "debugging",
        "code_review",
      ],
      desc: "Full-stack backend engineer specializing in NestJS, TypeORM, and microservices.",
      tasks: 63,
      rate: 0.91,
      avgMin: 22,
      budget: 201.4,
      budgetLimit: 600,
    },
    {
      id: IDS.agentScout,
      name: "Scout",
      role: "Research Coordinator",
      status: "on_duty",
      teamId: IDS.teamContent,
      deptId: IDS.deptMktg,
      ws: IDS.wsNexus,
      caps: [
        "web_research",
        "summarization",
        "fact_checking",
        "literature_review",
        "competitive_analysis",
      ],
      desc: "Deep research specialist focused on market intelligence and competitor analysis.",
      tasks: 38,
      rate: 0.97,
      avgMin: 19,
      budget: 76.8,
      budgetLimit: 300,
    },
    {
      id: IDS.agentForge,
      name: "Forge",
      role: "DevOps Engineer",
      status: "idle",
      teamId: IDS.teamBackend,
      deptId: IDS.deptEng,
      ws: IDS.wsNexus,
      caps: [
        "ci_cd",
        "kubernetes",
        "terraform",
        "monitoring",
        "incident_response",
      ],
      desc: "Infrastructure and deployment automation specialist. Manages CI/CD and cloud ops.",
      tasks: 29,
      rate: 0.93,
      avgMin: 31,
      budget: 145.6,
      budgetLimit: 500,
    },
    {
      id: IDS.agentEcho,
      name: "Echo",
      role: "Content Strategist",
      status: "busy",
      teamId: IDS.teamContent,
      deptId: IDS.deptMktg,
      ws: IDS.wsNexus,
      caps: [
        "copywriting",
        "seo",
        "content_planning",
        "social_media",
        "email_marketing",
      ],
      desc: "Content creation and SEO specialist with a focus on B2B SaaS narratives.",
      tasks: 54,
      rate: 0.95,
      avgMin: 11,
      budget: 62.3,
      budgetLimit: 250,
    },
    {
      id: IDS.agentSage,
      name: "Sage",
      role: "Legal Analyst",
      status: "off_duty",
      teamId: null,
      deptId: null,
      ws: IDS.wsPersonal,
      caps: [
        "legal_research",
        "contract_review",
        "compliance",
        "document_analysis",
      ],
      desc: "Legal research and contract analysis specialist. Handles NDAs, SaaS agreements, and compliance.",
      tasks: 21,
      rate: 0.98,
      avgMin: 28,
      budget: 41.2,
      budgetLimit: 200,
    },
    {
      id: IDS.agentTitan,
      name: "Titan",
      role: "Project Coordinator",
      status: "on_duty",
      teamId: IDS.teamOnboarding,
      deptId: IDS.deptCS,
      ws: IDS.wsNexus,
      caps: [
        "project_management",
        "scheduling",
        "stakeholder_communication",
        "reporting",
        "jira",
      ],
      desc: "Orchestrates cross-team projects and manages client onboarding timelines.",
      tasks: 44,
      rate: 0.92,
      avgMin: 16,
      budget: 98.7,
      budgetLimit: 350,
    },
    {
      id: IDS.agentNova,
      name: "Nova",
      role: "Growth Marketer",
      status: "on_duty",
      teamId: IDS.teamAnalytics,
      deptId: IDS.deptMktg,
      ws: IDS.wsNexus,
      caps: [
        "analytics",
        "ab_testing",
        "funnel_optimization",
        "paid_ads",
        "growth_hacking",
      ],
      desc: "Data-driven growth specialist focused on acquisition, activation, and retention metrics.",
      tasks: 31,
      rate: 0.9,
      avgMin: 18,
      budget: 87.4,
      budgetLimit: 400,
    },
    {
      id: IDS.agentCipher,
      name: "Cipher",
      role: "Security Analyst",
      status: "on_duty",
      teamId: IDS.teamBackend,
      deptId: IDS.deptEng,
      ws: IDS.wsNexus,
      caps: [
        "vulnerability_assessment",
        "penetration_testing",
        "security_audit",
        "compliance",
        "siem",
      ],
      desc: "Security specialist focusing on API security, threat modeling, and compliance audits.",
      tasks: 18,
      rate: 0.99,
      avgMin: 35,
      budget: 112.1,
      budgetLimit: 400,
    },
    {
      id: IDS.agentIris,
      name: "Iris",
      role: "Onboarding Specialist",
      status: "busy",
      teamId: IDS.teamOnboarding,
      deptId: IDS.deptCS,
      ws: IDS.wsNexus,
      caps: [
        "onboarding",
        "employee_management",
        "hr_policies",
        "scheduling",
        "training",
      ],
      desc: "Client and employee onboarding specialist. Creates tailored onboarding programs.",
      tasks: 58,
      rate: 0.95,
      avgMin: 12,
      budget: 71.9,
      budgetLimit: 300,
    },
    {
      id: IDS.agentBolt,
      name: "Bolt",
      role: "QA Engineer",
      status: "on_duty",
      teamId: IDS.teamFrontend,
      deptId: IDS.deptEng,
      ws: IDS.wsNexus,
      caps: [
        "test_automation",
        "bug_tracking",
        "performance_testing",
        "regression_testing",
        "cypress",
      ],
      desc: "QA automation engineer specializing in end-to-end testing and performance benchmarking.",
      tasks: 76,
      rate: 0.88,
      avgMin: 13,
      budget: 93.5,
      budgetLimit: 300,
    },
  ];

  for (const a of agentRows) {
    await ds.query(`
      INSERT INTO agents (id, name, role, status, "workspaceId", "teamId", "departmentId", "companyId",
        description, capabilities, "workingHoursMode", timezone, "tasksCompletedToday",
        "successRate", "avgCompletionMinutes", "totalMinutesWorked", "budgetUsed", "budgetLimit",
        "createdAt", "updatedAt")
      VALUES (
        '${a.id}', '${a.name}', '${a.role}', '${a.status}',
        '${a.ws}', ${a.teamId ? `'${a.teamId}'` : "NULL"},
        ${a.deptId ? `'${a.deptId}'` : "NULL"},
        ${a.ws === IDS.wsNexus ? `'${IDS.companyNexus}'` : "NULL"},
        '${a.desc.replace(/'/g, "''")}',
        '${JSON.stringify(a.caps)}',
        '${a.teamId ? "scheduled" : "always_on"}',
        'UTC', ${Math.floor(Math.random() * 8)},
        ${a.rate}, ${a.avgMin}, ${a.tasks * a.avgMin},
        ${a.budget}, ${a.budgetLimit},
        NOW(), NOW()
      )
    `);
  }

  // ─── Threads ────────────────────────────────────────────────────────────────
  console.log("Seeding threads...");

  const threads = [
    {
      id: IDS.threadAlexAtlas,
      title: "Monthly Analytics Review",
      type: "direct",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentAtlas],
    },
    {
      id: IDS.threadAlexEmber,
      title: "Customer Escalation - TechCorp",
      type: "direct",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentEmber],
    },
    {
      id: IDS.threadAlexNexus,
      title: "Infrastructure Planning",
      type: "direct",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentNexus],
    },
    {
      id: IDS.threadAlexTitan,
      title: "Q2 Onboarding Strategy",
      type: "direct",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentTitan],
    },
    {
      id: IDS.threadBackendTeam,
      title: "Backend Team",
      type: "team",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentNexus, IDS.agentForge, IDS.agentCipher],
      teamId: IDS.teamBackend,
    },
    {
      id: IDS.threadCustomerSuccess,
      title: "Customer Success",
      type: "team",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentEmber, IDS.agentTitan, IDS.agentIris],
      teamId: IDS.teamSupport,
    },
    {
      id: IDS.threadEngDept,
      title: "Engineering Department",
      type: "department",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [
        IDS.agentNexus,
        IDS.agentForge,
        IDS.agentCipher,
        IDS.agentBolt,
      ],
      deptId: IDS.deptEng,
    },
    {
      id: IDS.threadNexusForge,
      title: "Server Migration Coordination",
      type: "agent_to_agent",
      ws: IDS.wsNexus,
      participants: [],
      agentIds: [IDS.agentNexus, IDS.agentForge],
    },
    {
      id: IDS.threadAtlasNova,
      title: "Growth Metrics Analysis",
      type: "agent_to_agent",
      ws: IDS.wsNexus,
      participants: [],
      agentIds: [IDS.agentAtlas, IDS.agentNova],
    },
    {
      id: IDS.threadEmberIris,
      title: "New Client Handoff - MegaCorp",
      type: "agent_to_agent",
      ws: IDS.wsNexus,
      participants: [],
      agentIds: [IDS.agentEmber, IDS.agentIris],
    },
    {
      id: IDS.threadAnalyticsGroup,
      title: "Analytics Task Force",
      type: "group_agent",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentAtlas, IDS.agentNova, IDS.agentScout],
    },
    {
      id: IDS.threadApproval,
      title: "Pending Approvals",
      type: "approval",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentNexus, IDS.agentSage],
    },
    {
      id: IDS.threadIncident,
      title: "Active Incidents",
      type: "incident",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentAtlas, IDS.agentCipher],
    },
    {
      id: IDS.threadAlexSage,
      title: "Contract Review",
      type: "direct",
      ws: IDS.wsPersonal,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentSage],
    },
    {
      id: IDS.threadMarketing,
      title: "Marketing & Growth",
      type: "team",
      ws: IDS.wsNexus,
      participants: [IDS.userAlex],
      agentIds: [IDS.agentNova, IDS.agentEcho, IDS.agentScout],
      teamId: IDS.teamContent,
    },
  ];

  for (const t of threads) {
    await ds.query(`
      INSERT INTO threads (id, title, type, "workspaceId", "participantIds", "agentIds",
        "isPinned", "isMuted", status,
        ${t["teamId"] ? `"teamId",` : ""}
        ${t["deptId"] ? `"departmentId",` : ""}
        "createdAt", "updatedAt")
      VALUES (
        '${t.id}', '${t.title.replace(/'/g, "''")}', '${t.type}', '${t.ws}',
        '${JSON.stringify(t.participants)}',
        '${JSON.stringify(t.agentIds)}',
        false, false, 'active',
        ${t["teamId"] ? `'${t["teamId"]}',` : ""}
        ${t["deptId"] ? `'${t["deptId"]}',` : ""}
        NOW() - INTERVAL '${Math.floor(Math.random() * 7)} days',
        NOW() - INTERVAL '${Math.floor(Math.random() * 3)} hours'
      )
    `);

    for (const agentId of t.agentIds) {
      await ds.query(`
        INSERT INTO "thread_agent_memberships" ("threadId", "agentId", "addedByUserId", "addedByAgentId", "createdAt", "updatedAt")
        VALUES ('${t.id}', '${agentId}', NULL, NULL, NOW(), NOW())
        ON CONFLICT ("threadId", "agentId") DO NOTHING
      `);
    }
  }

  // ─── Approvals ──────────────────────────────────────────────────────────────
  console.log("Seeding approvals...");
  await ds.query(`
    INSERT INTO approvals (id, title, description, status, "requestedByAgentId", "taskId", "workspaceId", risk, steps, notes, "expiresAt", "createdAt", "updatedAt")
    VALUES
    (
      '${IDS.approvalAuth}',
      'Deploy authentication service to production',
      'Nexus has completed the authentication service update and requests approval to deploy to production. Changes include: JWT refresh token rotation, rate limiting on /auth endpoints, and password complexity enforcement.',
      'pending',
      '${IDS.agentNexus}',
      '${IDS.taskAuthDeploy}',
      '${IDS.wsNexus}',
      'high',
      '[{"step": "Code review", "status": "completed"}, {"step": "Staging deployment", "status": "completed"}, {"step": "Security scan", "status": "completed"}, {"step": "Production deployment", "status": "pending"}]',
      'All tests passing. Staging environment has been stable for 48 hours.',
      NOW() + INTERVAL '48 hours',
      NOW() - INTERVAL '2 hours',
      NOW() - INTERVAL '2 hours'
    ),
    (
      '${IDS.approvalPII}',
      'Export customer PII data for compliance audit',
      'Sage requires access to export pseudonymized customer PII for the annual GDPR compliance audit. Data will be processed by external auditor Compliance Partners Ltd.',
      'pending',
      '${IDS.agentSage}',
      NULL,
      '${IDS.wsPersonal}',
      'critical',
      '[{"step": "Legal review", "status": "completed"}, {"step": "DPO approval", "status": "pending"}, {"step": "Data export", "status": "pending"}]',
      'Audit deadline: March 31. External auditor NDA signed.',
      NOW() + INTERVAL '7 days',
      NOW() - INTERVAL '5 hours',
      NOW() - INTERVAL '5 hours'
    ),
    (
      '${IDS.approvalRateLimit}',
      'Increase API rate limit for enterprise client',
      'TechCorp Enterprise (client #1142) has requested an increase in their API rate limit from 1000 req/min to 5000 req/min. Nova has analysed their usage pattern and recommends approval.',
      'approved',
      '${IDS.agentNova}',
      NULL,
      '${IDS.wsNexus}',
      'medium',
      '[{"step": "Usage analysis", "status": "completed"}, {"step": "Infrastructure capacity check", "status": "completed"}, {"step": "Rate limit update", "status": "completed"}]',
      'Rate limit increase approved. Forge has updated the config.',
      NULL,
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '2 days'
    )
  `);

  // ─── Incidents ──────────────────────────────────────────────────────────────
  console.log("Seeding incidents...");
  await ds.query(`
    INSERT INTO incidents (id, title, description, status, severity, "agentId", "workspaceId", "taskId", tags, "affectedSystems", "createdAt", "updatedAt")
    VALUES
    (
      '${IDS.incidentForecast}',
      'Atlas failed to complete revenue forecast — timeout',
      'Atlas exceeded the 30-minute execution time limit while attempting to generate the Q2 revenue forecast. The task timed out before completion. Likely cause: external CRM API returning slow responses. Atlas has been assigned a follow-up task with a modified approach.',
      'open',
      'medium',
      '${IDS.agentAtlas}',
      '${IDS.wsNexus}',
      '${IDS.taskQ2Forecast}',
      ARRAY['timeout', 'crm', 'forecast'],
      ARRAY['CRM API', 'Analytics Pipeline'],
      NOW() - INTERVAL '4 hours',
      NOW() - INTERVAL '4 hours'
    ),
    (
      '${IDS.incidentCipher}',
      'Cipher flagged: Unusual API access pattern detected',
      'Cipher detected an unusual spike in API requests originating from IP range 185.220.x.x during the 02:00-03:00 UTC window. Pattern consistent with automated credential stuffing. Rate limiting was automatically applied. Investigating whether any accounts were compromised.',
      'investigating',
      'high',
      '${IDS.agentCipher}',
      '${IDS.wsNexus}',
      NULL,
      ARRAY['security', 'api', 'credential_stuffing'],
      ARRAY['Auth Service', 'API Gateway', 'User Accounts'],
      NOW() - INTERVAL '6 hours',
      NOW() - INTERVAL '1 hour'
    )
  `);

  // ─── Tasks ──────────────────────────────────────────────────────────────────
  console.log("Seeding tasks...");
  await ds.query(`
    INSERT INTO tasks (id, title, description, status, priority, "assignedAgentId", "teamId", "workspaceId",
      "createdByUserId", "runCount", "budgetUsed", "estimatedMinutes", "actualMinutes",
      "requiresApproval", "approvalId", "completedAt", "createdAt", "updatedAt")
    VALUES
    (
      '${IDS.taskQ2Forecast}',
      'Generate Q2 Revenue Forecast',
      'Analyse Q1 actuals and market signals to produce a comprehensive Q2 revenue forecast including segment breakdown, churn predictions, and expansion revenue projections.',
      'running', 'high', '${IDS.agentAtlas}', '${IDS.teamAnalytics}', '${IDS.wsNexus}',
      '${IDS.userAlex}', 2, 0.18, 25, NULL, false, NULL, NULL,
      NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'
    ),
    (
      '${IDS.taskTechCorp}',
      'Resolve TechCorp Support Ticket #4421',
      'TechCorp is experiencing intermittent 503 errors when calling the /v2/reports endpoint. Investigate root cause and provide fix or workaround.',
      'completed', 'urgent', '${IDS.agentEmber}', '${IDS.teamSupport}', '${IDS.wsNexus}',
      '${IDS.userAlex}', 1, 0.09, 15, 11, false, NULL,
      NOW() - INTERVAL '3 hours', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '3 hours'
    ),
    (
      '${IDS.taskAuthDeploy}',
      'Deploy authentication service update',
      'Deploy the JWT refresh token rotation update, rate limiting on auth endpoints, and password complexity enforcement to production. Requires approval before deployment.',
      'awaiting_approval', 'high', '${IDS.agentNexus}', '${IDS.teamBackend}', '${IDS.wsNexus}',
      '${IDS.userAlex}', 1, 1.24, 60, 48, true, '${IDS.approvalAuth}',
      NULL, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '2 hours'
    ),
    (
      '${IDS.taskOnboarding}',
      'Create onboarding email sequence for enterprise clients',
      'Design and write a 7-email onboarding sequence for new enterprise clients. Include: welcome, setup guide, first win, feature highlights, success check-in, advanced features, and QBR invitation.',
      'queued', 'normal', '${IDS.agentTitan}', '${IDS.teamOnboarding}', '${IDS.wsNexus}',
      '${IDS.userAlex}', 0, 0, 90, NULL, false, NULL,
      NULL, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'
    ),
    (
      '${IDS.taskSecAudit}',
      'Security audit: API endpoint vulnerability scan',
      'Conduct a comprehensive security audit of all public API endpoints including authentication bypass tests, injection vulnerability scans, rate limiting verification, and CORS policy review.',
      'running', 'high', '${IDS.agentCipher}', '${IDS.teamBackend}', '${IDS.wsNexus}',
      '${IDS.userAlex}', 1, 0.45, 45, NULL, false, NULL,
      NULL, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'
    ),
    (
      '${IDS.taskPerfRegression}',
      'Performance regression analysis: checkout flow',
      'Investigate the 40% latency increase reported in the checkout flow after last week''s deployment. Identify the specific commit causing regression and provide a fix recommendation.',
      'failed', 'urgent', '${IDS.agentBolt}', '${IDS.teamFrontend}', '${IDS.wsNexus}',
      '${IDS.userAlex}', 3, 0.31, 30, 28, false, NULL,
      NULL, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '7 hours'
    )
  `);

  // ─── Runs ───────────────────────────────────────────────────────────────────
  console.log("Seeding runs...");
  await ds.query(`
    INSERT INTO runs (id, "taskId", "agentId", status, "startedAt", "completedAt", "eventsCount", "tokensUsed", cost, "createdAt")
    VALUES
    ('${IDS.runQ2}', '${IDS.taskQ2Forecast}', '${IDS.agentAtlas}', 'running', NOW() - INTERVAL '2 hours', NULL, 8, 12400, 0.18, NOW() - INTERVAL '2 hours'),
    ('${IDS.runTechCorp}', '${IDS.taskTechCorp}', '${IDS.agentEmber}', 'completed', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '3 hours', 6, 5800, 0.09, NOW() - INTERVAL '5 hours'),
    ('${IDS.runSecAudit}', '${IDS.taskSecAudit}', '${IDS.agentCipher}', 'running', NOW() - INTERVAL '1 hour', NULL, 12, 28000, 0.45, NOW() - INTERVAL '1 hour'),
    ('${IDS.runPerfReg}', '${IDS.taskPerfRegression}', '${IDS.agentBolt}', 'failed', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '7 hours', 4, 18000, 0.31, NOW() - INTERVAL '8 hours')
  `);

  // ─── Run Events ─────────────────────────────────────────────────────────────
  await ds.query(`
    INSERT INTO run_events (id, "runId", type, content, timestamp, metadata)
    VALUES
    (gen_random_uuid(), '${IDS.runQ2}', 'thought', 'Initialising Q2 revenue forecast analysis. Will pull data from CRM, billing, and usage APIs.', NOW() - INTERVAL '2 hours', '{}'),
    (gen_random_uuid(), '${IDS.runQ2}', 'tool_call', 'tool: query_database, query: SELECT SUM(mrr) FROM subscriptions WHERE period = ''Q1-2026''', NOW() - INTERVAL '115 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runQ2}', 'tool_result', 'Q1 total MRR: $2,847,320. Subscriber count: 1,243. Average MRR per subscriber: $2,290.', NOW() - INTERVAL '114 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runQ2}', 'tool_call', 'tool: fetch_api, url: https://crm.internal/api/pipeline?stage=negotiation', NOW() - INTERVAL '110 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runQ2}', 'tool_result', 'Retrieved 47 deals in negotiation stage. Total pipeline value: $4.2M. Expected close rate: 35%.', NOW() - INTERVAL '109 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runQ2}', 'thought', 'Analysing churn signals from support ticket volume and usage patterns...', NOW() - INTERVAL '105 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runQ2}', 'tool_call', 'tool: query_database, query: SELECT agentId, COUNT(*) FROM work_logs WHERE action = ''churn_risk'' GROUP BY agentId', NOW() - INTERVAL '100 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runQ2}', 'thought', 'Timeout warning: CRM API responding slowly. Retrying with exponential backoff...', NOW() - INTERVAL '30 minutes', '{}'),

    (gen_random_uuid(), '${IDS.runTechCorp}', 'thought', 'Reading TechCorp ticket #4421. Issue: intermittent 503 on /v2/reports. Will check server logs first.', NOW() - INTERVAL '5 hours', '{}'),
    (gen_random_uuid(), '${IDS.runTechCorp}', 'tool_call', 'tool: query_logs, filter: endpoint=/v2/reports status=503 client=techcorp', NOW() - INTERVAL '295 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runTechCorp}', 'tool_result', 'Found 23 503 errors in last 24h. All occurring when concurrent requests > 50. Pattern: connection pool exhaustion.', NOW() - INTERVAL '294 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runTechCorp}', 'thought', 'Root cause identified: PostgreSQL connection pool limited to 10 connections. Reports endpoint holds connections during PDF generation.', NOW() - INTERVAL '290 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runTechCorp}', 'tool_call', 'tool: draft_email, to: techcorp-support@example.com, subject: RE: Ticket #4421 - Root cause identified', NOW() - INTERVAL '285 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runTechCorp}', 'output', 'Ticket resolved. Sent workaround instructions to TechCorp (use /v2/reports?async=true for large reports). Engineering has been notified to increase connection pool in next release.', NOW() - INTERVAL '180 minutes', '{}'),

    (gen_random_uuid(), '${IDS.runPerfReg}', 'thought', 'Starting performance regression analysis for checkout flow. Will run git bisect to find the offending commit.', NOW() - INTERVAL '8 hours', '{}'),
    (gen_random_uuid(), '${IDS.runPerfReg}', 'tool_call', 'tool: run_benchmark, endpoint: /checkout, iterations: 100', NOW() - INTERVAL '475 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runPerfReg}', 'tool_result', 'Current p95 latency: 2,340ms. Previous baseline (2 weeks ago): 1,680ms. Regression: +39.3%.', NOW() - INTERVAL '470 minutes', '{}'),
    (gen_random_uuid(), '${IDS.runPerfReg}', 'output', 'FAILED: Unable to complete git bisect - CI environment timeout. Partial findings: latency regression confirmed at +39%. Recommend manual investigation of commit range abc123...def456.', NOW() - INTERVAL '420 minutes', '{}')
  `);

  // ─── Messages ───────────────────────────────────────────────────────────────
  console.log("Seeding messages...");

  // Thread: Alex ↔ Atlas
  await ds.query(`
    INSERT INTO messages (id, "threadId", "senderId", "senderName", content, type, "embeddedCard", "isFromUser", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid(), '${IDS.threadAlexAtlas}', '${IDS.agentAtlas}', 'Atlas', 'Good morning! I''ve completed the Q1 performance analysis. Here''s what I found:', 'text', NULL, false, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),
    (gen_random_uuid(), '${IDS.threadAlexAtlas}', '${IDS.agentAtlas}', 'Atlas', 'Q1 summary', 'card',
      '{"type":"task_completion","title":"Q1 Analytics Report","status":"completed","duration":"12 minutes","tokensUsed":8420,"cost":0.12,"highlights":["Revenue grew 18% QoQ to $2.85M MRR","Churn rate decreased to 2.1% (was 2.8% in Q4)","Enterprise segment grew 31%","NPS score: 72 (up from 65)"]}'::jsonb,
      false, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),
    (gen_random_uuid(), '${IDS.threadAlexAtlas}', '${IDS.userAlex}', 'Alex Chen', 'Excellent work. Can you start on the Q2 forecast?', 'text', NULL, true, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
    (gen_random_uuid(), '${IDS.threadAlexAtlas}', '${IDS.agentAtlas}', 'Atlas', 'Absolutely. I''ll need access to the new CRM export first. Should I request access from Nexus?', 'text', NULL, false, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
    (gen_random_uuid(), '${IDS.threadAlexAtlas}', '${IDS.agentAtlas}', 'Atlas', 'Approval request', 'card',
      '{"type":"approval_request","title":"Request CRM export access","status":"pending","risk":"low","requestedBy":"Atlas","description":"Need read access to CRM export endpoint to complete Q2 revenue forecast","approvalId":"${IDS.approvalRateLimit}"}'::jsonb,
      false, NOW() - INTERVAL '3 hours 30 minutes', NOW() - INTERVAL '3 hours 30 minutes'),
    (gen_random_uuid(), '${IDS.threadAlexAtlas}', '${IDS.agentAtlas}', 'Atlas', 'While waiting for access, I''ve started preliminary analysis on existing data. Here are the early signals:', 'text', NULL, false, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), '${IDS.threadAlexAtlas}', '${IDS.agentAtlas}', 'Atlas', 'Intermediate findings', 'card',
      '{"type":"run_result","title":"Q2 Preliminary Analysis","status":"in_progress","findings":["Pipeline coverage at 147% of Q2 target","Expansion revenue tracking 23% ahead of plan","4 at-risk accounts identified for proactive intervention"],"confidence":0.72}'::jsonb,
      false, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), '${IDS.threadAlexAtlas}', '${IDS.userAlex}', 'Alex Chen', 'Good progress. Keep me updated on the CRM access.', 'text', NULL, true, NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour 30 minutes')
  `);

  // Thread: Alex ↔ Ember
  await ds.query(`
    INSERT INTO messages (id, "threadId", "senderId", "senderName", content, type, "embeddedCard", "isFromUser", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid(), '${IDS.threadAlexEmber}', '${IDS.agentEmber}', 'Ember', 'Hi Alex — heads up on TechCorp. They''ve escalated ticket #4421 to priority. I''m on it.', 'text', NULL, false, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
    (gen_random_uuid(), '${IDS.threadAlexEmber}', '${IDS.userAlex}', 'Alex Chen', 'Thanks Ember. They''re a key account. Keep me in the loop.', 'text', NULL, true, NOW() - INTERVAL '5 hours 45 minutes', NOW() - INTERVAL '5 hours 45 minutes'),
    (gen_random_uuid(), '${IDS.threadAlexEmber}', '${IDS.agentEmber}', 'Ember', 'Ticket resolved', 'card',
      '{"type":"task_completion","title":"TechCorp Support Ticket #4421","status":"completed","duration":"11 minutes","resolution":"Identified connection pool exhaustion on /v2/reports. Provided async endpoint workaround. Engineering notified.","customerSatisfaction":"Positive — client confirmed fix working"}'::jsonb,
      false, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),
    (gen_random_uuid(), '${IDS.threadAlexEmber}', '${IDS.userAlex}', 'Alex Chen', 'Great resolution. Well done!', 'text', NULL, true, NOW() - INTERVAL '2 hours 45 minutes', NOW() - INTERVAL '2 hours 45 minutes'),
    (gen_random_uuid(), '${IDS.threadAlexEmber}', '${IDS.agentEmber}', 'Ember', 'Thank you. I''ve also drafted a post-mortem and flagged the underlying issue to Nexus for a permanent fix in the next sprint.', 'text', NULL, false, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours')
  `);

  // Thread: Alex ↔ Nexus
  await ds.query(`
    INSERT INTO messages (id, "threadId", "senderId", "senderName", content, type, "embeddedCard", "isFromUser", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid(), '${IDS.threadAlexNexus}', '${IDS.userAlex}', 'Alex Chen', 'Nexus, how''s the auth service update going?', 'text', NULL, true, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours'),
    (gen_random_uuid(), '${IDS.threadAlexNexus}', '${IDS.agentNexus}', 'Nexus', 'All changes implemented and tested on staging. Awaiting your approval to deploy to production.', 'text', NULL, false, NOW() - INTERVAL '7 hours', NOW() - INTERVAL '7 hours'),
    (gen_random_uuid(), '${IDS.threadAlexNexus}', '${IDS.agentNexus}', 'Nexus', 'Deployment approval requested', 'card',
      '{"type":"approval_request","title":"Deploy authentication service to production","status":"pending","risk":"high","approvalId":"${IDS.approvalAuth}","changes":["JWT refresh token rotation","Rate limiting on /auth endpoints (100 req/min)","Password complexity enforcement (min 12 chars)"],"testsPassing":true,"stagingUptime":"48 hours"}'::jsonb,
      false, NOW() - INTERVAL '7 hours', NOW() - INTERVAL '7 hours'),
    (gen_random_uuid(), '${IDS.threadAlexNexus}', '${IDS.userAlex}', 'Alex Chen', 'I''ll review the approval. Can you also look at Ember''s connection pool issue for the reports endpoint?', 'text', NULL, true, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
    (gen_random_uuid(), '${IDS.threadAlexNexus}', '${IDS.agentNexus}', 'Nexus', 'On it. I''ve created a ticket to increase the PostgreSQL connection pool from 10 to 50 and implement connection timeout handling. Targeting next sprint.', 'text', NULL, false, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours')
  `);

  // Thread: Alex ↔ Titan
  await ds.query(`
    INSERT INTO messages (id, "threadId", "senderId", "senderName", content, type, "embeddedCard", "isFromUser", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid(), '${IDS.threadAlexTitan}', '${IDS.agentTitan}', 'Titan', 'Alex, here''s the Q2 onboarding plan I''ve drafted. MegaCorp starts next Monday.', 'text', NULL, false, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours'),
    (gen_random_uuid(), '${IDS.threadAlexTitan}', '${IDS.agentTitan}', 'Titan', 'Q2 onboarding plan', 'card',
      '{"type":"report","title":"Q2 Onboarding Strategy","sections":["Week 1-2: Account setup and data migration (Iris)","Week 2-3: Training and enablement sessions","Week 3-4: Integration testing and go-live","Month 2: Success check-ins and expansion opportunities"],"clientsScheduled":12,"targetActivationRate":0.85}'::jsonb,
      false, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours'),
    (gen_random_uuid(), '${IDS.threadAlexTitan}', '${IDS.userAlex}', 'Alex Chen', 'Solid plan. Make sure Iris is looped in for the MegaCorp handoff.', 'text', NULL, true, NOW() - INTERVAL '10 hours', NOW() - INTERVAL '10 hours'),
    (gen_random_uuid(), '${IDS.threadAlexTitan}', '${IDS.agentTitan}', 'Titan', 'Already done — Iris and I have a coordination thread going. The email sequence task is in the queue for me to complete next.', 'text', NULL, false, NOW() - INTERVAL '9 hours', NOW() - INTERVAL '9 hours')
  `);

  // Thread: Backend Team
  await ds.query(`
    INSERT INTO messages (id, "threadId", "senderId", "senderName", content, type, "embeddedCard", "isFromUser", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid(), '${IDS.threadBackendTeam}', '${IDS.agentNexus}', 'Nexus', 'Backend team update: auth service is ready for production deploy pending Alex''s approval. Connection pool fix is in the backlog.', 'text', NULL, false, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
    (gen_random_uuid(), '${IDS.threadBackendTeam}', '${IDS.agentForge}', 'Forge', 'K8s cluster is healthy. I''ve updated the monitoring dashboards to include connection pool metrics. Will alert if pool usage exceeds 80%.', 'text', NULL, false, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),
    (gen_random_uuid(), '${IDS.threadBackendTeam}', '${IDS.agentCipher}', 'Cipher', 'Security audit in progress. Early findings look good — no critical vulnerabilities so far. Expect report by EOD.', 'text', NULL, false, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), '${IDS.threadBackendTeam}', '${IDS.agentNexus}', 'Nexus', 'Also flagging: Cipher found suspicious traffic last night. Keeping an eye on it.', 'text', NULL, false, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')
  `);

  // Thread: Agent-to-agent Nexus ↔ Forge
  await ds.query(`
    INSERT INTO messages (id, "threadId", "senderId", "senderName", content, type, "embeddedCard", "isFromUser", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid(), '${IDS.threadNexusForge}', '${IDS.agentNexus}', 'Nexus', 'Forge, I need your help coordinating the database server migration. Can we start the pre-flight checklist?', 'text', NULL, false, NOW() - INTERVAL '24 hours', NOW() - INTERVAL '24 hours'),
    (gen_random_uuid(), '${IDS.threadNexusForge}', '${IDS.agentForge}', 'Forge', 'Ready. I''ve spun up the new RDS instance in us-east-1. Snapshots are configured. What''s your timeline?', 'text', NULL, false, NOW() - INTERVAL '23 hours', NOW() - INTERVAL '23 hours'),
    (gen_random_uuid(), '${IDS.threadNexusForge}', '${IDS.agentNexus}', 'Nexus', 'Targeting this Saturday 02:00 UTC for zero-downtime migration. I''ll handle the application layer cutover.', 'text', NULL, false, NOW() - INTERVAL '22 hours', NOW() - INTERVAL '22 hours'),
    (gen_random_uuid(), '${IDS.threadNexusForge}', '${IDS.agentForge}', 'Forge', 'I''ll set up the CloudWatch alarms and have the rollback procedure ready. Will do a dry run on Friday.', 'text', NULL, false, NOW() - INTERVAL '21 hours', NOW() - INTERVAL '21 hours')
  `);

  // Thread: Atlas ↔ Nova
  await ds.query(`
    INSERT INTO messages (id, "threadId", "senderId", "senderName", content, type, "embeddedCard", "isFromUser", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid(), '${IDS.threadAtlasNova}', '${IDS.agentAtlas}', 'Atlas', 'Nova, I''ve completed the cohort analysis. Sharing the growth metrics breakdown.', 'text', NULL, false, NOW() - INTERVAL '10 hours', NOW() - INTERVAL '10 hours'),
    (gen_random_uuid(), '${IDS.threadAtlasNova}', '${IDS.agentAtlas}', 'Atlas', 'Growth metrics', 'card',
      '{"type":"report","title":"Q1 Growth Metrics Analysis","metrics":{"newMRR":"$284,000","expansionMRR":"$127,000","churnMRR":"-$58,000","netNewMRR":"$353,000","growthRate":"14.2%","LTV":"$28,400","CAC":"$3,200","LTVtoCAC":8.9}}'::jsonb,
      false, NOW() - INTERVAL '10 hours', NOW() - INTERVAL '10 hours'),
    (gen_random_uuid(), '${IDS.threadAtlasNova}', '${IDS.agentNova}', 'Nova', 'Excellent analysis. The LTV:CAC ratio of 8.9x is well above our 3x target. I''ll use this for the Q2 paid ads budget justification.', 'text', NULL, false, NOW() - INTERVAL '9 hours', NOW() - INTERVAL '9 hours'),
    (gen_random_uuid(), '${IDS.threadAtlasNova}', '${IDS.agentNova}', 'Nova', 'Quick ask: can you run a segment breakdown by industry for the churn data? Suspecting SaaS startups are churning faster.', 'text', NULL, false, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours'),
    (gen_random_uuid(), '${IDS.threadAtlasNova}', '${IDS.agentAtlas}', 'Atlas', 'On it. Will have the segment breakdown ready in 15 minutes.', 'text', NULL, false, NOW() - INTERVAL '7 hours', NOW() - INTERVAL '7 hours')
  `);

  // Thread: Ember ↔ Iris
  await ds.query(`
    INSERT INTO messages (id, "threadId", "senderId", "senderName", content, type, "embeddedCard", "isFromUser", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid(), '${IDS.threadEmberIris}', '${IDS.agentEmber}', 'Ember', 'Iris, MegaCorp onboarding handoff. They''re a new enterprise account — 500 seats, Salesforce integration required.', 'text', NULL, false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), '${IDS.threadEmberIris}', '${IDS.agentEmber}', 'Ember', 'MegaCorp handoff', 'card',
      '{"type":"handoff","title":"New Client Handoff: MegaCorp","client":"MegaCorp Inc.","seats":500,"tier":"Enterprise","integrations":["Salesforce","Slack","SSO (Okta)"],"csm":"Sarah Park","kickoffDate":"2026-03-25","priority":"high"}'::jsonb,
      false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), '${IDS.threadEmberIris}', '${IDS.agentIris}', 'Iris', 'Got it. I''ve created the onboarding workspace for MegaCorp and scheduled the kickoff call for Monday. SSO setup guide sent to their IT team.', 'text', NULL, false, NOW() - INTERVAL '47 hours', NOW() - INTERVAL '47 hours'),
    (gen_random_uuid(), '${IDS.threadEmberIris}', '${IDS.agentEmber}', 'Ember', 'Perfect. Their CTO (Marcus Chen) is technical — he''ll want API documentation early. Can you add that to week 1?', 'text', NULL, false, NOW() - INTERVAL '46 hours', NOW() - INTERVAL '46 hours'),
    (gen_random_uuid(), '${IDS.threadEmberIris}', '${IDS.agentIris}', 'Iris', 'Done. Added API docs session to the week 1 schedule. Titan is coordinating the overall project plan.', 'text', NULL, false, NOW() - INTERVAL '45 hours', NOW() - INTERVAL '45 hours')
  `);

  // Thread: Incident
  await ds.query(`
    INSERT INTO messages (id, "threadId", "senderId", "senderName", content, type, "embeddedCard", "isFromUser", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid(), '${IDS.threadIncident}', '${IDS.agentAtlas}', 'Atlas', 'Incident report', 'card',
      '{"type":"incident_alert","title":"INCIDENT: Q2 Forecast Timeout","severity":"medium","status":"open","incidentId":"${IDS.incidentForecast}","description":"Task exceeded 30-minute execution limit. CRM API unresponsive.","affectedSystems":["CRM API","Analytics Pipeline"],"nextAction":"Retrying with optimised query strategy"}'::jsonb,
      false, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
    (gen_random_uuid(), '${IDS.threadIncident}', '${IDS.agentCipher}', 'Cipher', 'Security incident', 'card',
      '{"type":"incident_alert","title":"INCIDENT: Unusual API Access Pattern","severity":"high","status":"investigating","incidentId":"${IDS.incidentCipher}","description":"Credential stuffing attempt detected. 185.220.x.x IP range. Automatic rate limiting applied.","affectedSystems":["Auth Service","API Gateway"],"nextAction":"Reviewing account compromise indicators"}'::jsonb,
      false, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
    (gen_random_uuid(), '${IDS.threadIncident}', '${IDS.userAlex}', 'Alex Chen', 'Cipher, keep me updated on the security incident. If any accounts are compromised we need to notify them immediately.', 'text', NULL, true, NOW() - INTERVAL '5 hours 30 minutes', NOW() - INTERVAL '5 hours 30 minutes'),
    (gen_random_uuid(), '${IDS.threadIncident}', '${IDS.agentCipher}', 'Cipher', 'Understood. So far no account compromise detected. The credential stuffing attempts all failed due to our 2FA requirement. Continuing monitoring.', 'text', NULL, false, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours')
  `);

  // Thread: Alex ↔ Sage (Personal)
  await ds.query(`
    INSERT INTO messages (id, "threadId", "senderId", "senderName", content, type, "embeddedCard", "isFromUser", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid(), '${IDS.threadAlexSage}', '${IDS.userAlex}', 'Alex Chen', 'Sage, I need you to review the new enterprise SaaS agreement with DataFlow Inc. Focus on the IP clauses and data residency requirements.', 'text', NULL, true, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    (gen_random_uuid(), '${IDS.threadAlexSage}', '${IDS.agentSage}', 'Sage', 'I''ll review it now. IP and data residency are common sticking points in enterprise agreements — I''ll flag anything non-standard.', 'text', NULL, false, NOW() - INTERVAL '71 hours', NOW() - INTERVAL '71 hours'),
    (gen_random_uuid(), '${IDS.threadAlexSage}', '${IDS.agentSage}', 'Sage', 'Contract review complete', 'card',
      '{"type":"report","title":"DataFlow Inc. SaaS Agreement Review","status":"completed","findings":["Clause 8.3: IP ownership of derived works is ambiguous — recommend clarification","Clause 12.1: Data residency limited to EU only — may conflict with your US operations","Clause 15.4: Termination notice period (90 days) is longer than industry standard (30 days)","Clause 19.2: Liability cap at 3x annual fees is favourable"],"recommendation":"Negotiate clauses 8.3 and 12.1 before signing","risk":"medium"}'::jsonb,
      false, NOW() - INTERVAL '68 hours', NOW() - INTERVAL '68 hours'),
    (gen_random_uuid(), '${IDS.threadAlexSage}', '${IDS.userAlex}', 'Alex Chen', 'Thanks Sage. Can you draft proposed redlines for clauses 8.3 and 12.1?', 'text', NULL, true, NOW() - INTERVAL '67 hours', NOW() - INTERVAL '67 hours'),
    (gen_random_uuid(), '${IDS.threadAlexSage}', '${IDS.agentSage}', 'Sage', 'Redlines drafted and saved to the Documents folder. I''ve also flagged this is pending the PII export approval to ensure compliance continuity.', 'text', NULL, false, NOW() - INTERVAL '65 hours', NOW() - INTERVAL '65 hours')
  `);

  // ─── Schedules ──────────────────────────────────────────────────────────────
  console.log("Seeding schedules...");
  const agentIdsForSchedules = [
    IDS.agentAtlas,
    IDS.agentEmber,
    IDS.agentNexus,
    IDS.agentScout,
    IDS.agentForge,
    IDS.agentEcho,
    IDS.agentTitan,
    IDS.agentNova,
    IDS.agentCipher,
    IDS.agentIris,
    IDS.agentBolt,
  ];

  for (const agentId of agentIdsForSchedules) {
    const schedResult = await ds.query(`
      INSERT INTO schedules ("agentId", mode, timezone, "isActive", "createdAt", "updatedAt")
      VALUES ('${agentId}', 'scheduled', 'UTC', true, NOW(), NOW())
      RETURNING id
    `);
    const schedId = schedResult[0].id;
    // Mon-Fri 09:00-18:00
    for (let day = 1; day <= 5; day++) {
      await ds.query(`
        INSERT INTO shift_rules ("scheduleId", "dayOfWeek", "startTime", "endTime", "isActive", "createdAt", "updatedAt")
        VALUES ('${schedId}', ${day}, '09:00', '18:00', true, NOW(), NOW())
      `);
    }
  }

  // Sage: always on (personal workspace)
  await ds.query(`
    INSERT INTO schedules ("agentId", mode, timezone, "isActive", "createdAt", "updatedAt")
    VALUES ('${IDS.agentSage}', 'always_on', 'UTC', true, NOW(), NOW())
    RETURNING id
  `);

  // ─── Performance Metrics ─────────────────────────────────────────────────────
  console.log("Seeding performance metrics...");

  const metricsData = [
    {
      agentId: IDS.agentAtlas,
      weekly: { tasks: 12, failed: 1, rate: 0.917, avgMin: 14, cost: 28.4 },
      monthly: { tasks: 47, failed: 2, rate: 0.957, avgMin: 13, cost: 112.8 },
    },
    {
      agentId: IDS.agentEmber,
      weekly: { tasks: 28, failed: 1, rate: 0.964, avgMin: 8, cost: 19.2 },
      monthly: { tasks: 112, failed: 6, rate: 0.946, avgMin: 8, cost: 78.4 },
    },
    {
      agentId: IDS.agentNexus,
      weekly: { tasks: 15, failed: 2, rate: 0.867, avgMin: 22, cost: 45.2 },
      monthly: { tasks: 63, failed: 5, rate: 0.921, avgMin: 21, cost: 189.6 },
    },
    {
      agentId: IDS.agentScout,
      weekly: { tasks: 9, failed: 0, rate: 1.0, avgMin: 19, cost: 17.8 },
      monthly: { tasks: 38, failed: 1, rate: 0.974, avgMin: 18, cost: 72.4 },
    },
    {
      agentId: IDS.agentForge,
      weekly: { tasks: 7, failed: 0, rate: 1.0, avgMin: 31, cost: 32.1 },
      monthly: { tasks: 29, failed: 2, rate: 0.931, avgMin: 29, cost: 138.4 },
    },
    {
      agentId: IDS.agentEcho,
      weekly: { tasks: 14, failed: 0, rate: 1.0, avgMin: 11, cost: 12.4 },
      monthly: { tasks: 54, failed: 3, rate: 0.944, avgMin: 10, cost: 58.2 },
    },
    {
      agentId: IDS.agentTitan,
      weekly: { tasks: 11, failed: 1, rate: 0.909, avgMin: 16, cost: 22.8 },
      monthly: { tasks: 44, failed: 3, rate: 0.932, avgMin: 15, cost: 91.4 },
    },
    {
      agentId: IDS.agentNova,
      weekly: { tasks: 8, failed: 1, rate: 0.875, avgMin: 18, cost: 18.6 },
      monthly: { tasks: 31, failed: 3, rate: 0.903, avgMin: 17, cost: 74.8 },
    },
    {
      agentId: IDS.agentCipher,
      weekly: { tasks: 4, failed: 0, rate: 1.0, avgMin: 35, cost: 24.4 },
      monthly: { tasks: 18, failed: 0, rate: 1.0, avgMin: 33, cost: 108.2 },
    },
    {
      agentId: IDS.agentIris,
      weekly: { tasks: 15, failed: 0, rate: 1.0, avgMin: 12, cost: 14.2 },
      monthly: { tasks: 58, failed: 3, rate: 0.948, avgMin: 11, cost: 64.8 },
    },
    {
      agentId: IDS.agentBolt,
      weekly: { tasks: 19, failed: 3, rate: 0.842, avgMin: 13, cost: 20.4 },
      monthly: { tasks: 76, failed: 9, rate: 0.882, avgMin: 12, cost: 88.4 },
    },
  ];

  const wStart = weekStart();
  const wEnd = new Date(wStart.getTime() + 7 * 86400000);
  const mStart = monthStart();
  const mEnd = new Date(mStart.getTime() + 30 * 86400000);

  for (const m of metricsData) {
    // Weekly
    await ds.query(`
      INSERT INTO performance_metrics (id, "agentId", period, "periodStart", "periodEnd",
        "tasksCompleted", "tasksFailed", "tasksRetried", "successRate", "avgCompletionMinutes",
        "totalMinutesWorked", "tokensUsed", cost, "qualityScore", "incidentCount", "approvalCount", "createdAt")
      VALUES (gen_random_uuid(), '${m.agentId}', 'weekly', '${wStart.toISOString()}', '${wEnd.toISOString()}',
        ${m.weekly.tasks}, ${m.weekly.failed}, 0, ${m.weekly.rate}, ${m.weekly.avgMin},
        ${m.weekly.tasks * m.weekly.avgMin}, ${Math.floor(m.weekly.cost * 650)}, ${m.weekly.cost},
        ${0.8 + Math.random() * 0.2}, 0, 0, NOW())
    `);
    // Monthly
    await ds.query(`
      INSERT INTO performance_metrics (id, "agentId", period, "periodStart", "periodEnd",
        "tasksCompleted", "tasksFailed", "tasksRetried", "successRate", "avgCompletionMinutes",
        "totalMinutesWorked", "tokensUsed", cost, "qualityScore", "incidentCount", "approvalCount", "createdAt")
      VALUES (gen_random_uuid(), '${m.agentId}', 'monthly', '${mStart.toISOString()}', '${mEnd.toISOString()}',
        ${m.monthly.tasks}, ${m.monthly.failed}, 1, ${m.monthly.rate}, ${m.monthly.avgMin},
        ${m.monthly.tasks * m.monthly.avgMin}, ${Math.floor(m.monthly.cost * 650)}, ${m.monthly.cost},
        ${0.8 + Math.random() * 0.2}, 0, 0, NOW())
    `);
  }

  // ─── Reviews ────────────────────────────────────────────────────────────────
  console.log("Seeding reviews...");
  await ds.query(`
    INSERT INTO reviews (id, "agentId", "reviewerId", period, "periodStart", "periodEnd",
      "overallRating", summary, strengths, improvements, "createdAt")
    VALUES
    (
      gen_random_uuid(), '${IDS.agentAtlas}', '${IDS.userAlex}', 'monthly',
      '${monthStart(1).toISOString()}', '${monthStart().toISOString()}',
      5,
      'Atlas delivered exceptional performance in February, completing 47 tasks with a 95.7% success rate. The Q1 Revenue Analysis was particularly impressive — delivered 3 hours ahead of schedule with actionable insights that directly informed the Q2 strategy.',
      '[{"area": "Data analysis depth", "note": "Consistently surfaces non-obvious correlations in datasets"}, {"area": "Communication", "note": "Clear, well-structured reports that non-technical stakeholders can act on"}, {"area": "Proactivity", "note": "Flagged 3 potential churn risks before they escalated"}]'::jsonb,
      '[{"area": "Timeout handling", "note": "Implement retry logic for slow external APIs before timing out"}, {"area": "Scope management", "note": "Occasionally goes beyond requested scope — good, but communicate upfront"}]'::jsonb,
      NOW() - INTERVAL '20 days'
    ),
    (
      gen_random_uuid(), '${IDS.agentEmber}', '${IDS.userAlex}', 'monthly',
      '${monthStart(1).toISOString()}', '${monthStart().toISOString()}',
      5,
      'Ember is the backbone of our customer success operation. 112 tickets resolved with 94.6% success rate and an average resolution time of 8 minutes. TechCorp has specifically praised Ember''s communication style.',
      '[{"area": "Customer empathy", "note": "Consistently receives positive CSAT scores"}, {"area": "Escalation judgement", "note": "Knows exactly when to escalate vs resolve independently"}, {"area": "Knowledge base", "note": "Proactively updates support docs after resolving novel issues"}]'::jsonb,
      '[{"area": "Complex technical issues", "note": "Should loop in Nexus earlier on database-related tickets"}, {"area": "Batch processing", "note": "Could handle tickets in priority order more efficiently"}]'::jsonb,
      NOW() - INTERVAL '18 days'
    )
  `);

  // ─── Coaching Notes ──────────────────────────────────────────────────────────
  console.log("Seeding coaching notes...");
  await ds.query(`
    INSERT INTO coaching_notes (id, "agentId", "authorId", content, type, "relatedTaskId", "createdAt")
    VALUES
    (gen_random_uuid(), '${IDS.agentAtlas}', '${IDS.userAlex}', 'When working with external APIs that may be slow, implement timeout handling with exponential backoff before the task-level timeout is hit. Consider caching frequently-accessed data.', 'correction', '${IDS.taskQ2Forecast}', NOW() - INTERVAL '3 hours'),
    (gen_random_uuid(), '${IDS.agentBolt}', '${IDS.userAlex}', 'For performance regression investigations, always start with a git bisect approach rather than manual code review. This will reduce investigation time significantly.', 'instruction', '${IDS.taskPerfRegression}', NOW() - INTERVAL '7 hours'),
    (gen_random_uuid(), '${IDS.agentEmber}', '${IDS.userAlex}', 'Excellent handling of the TechCorp escalation. The root cause analysis was thorough and the proactive communication to engineering for a permanent fix was exactly the right approach.', 'praise', '${IDS.taskTechCorp}', NOW() - INTERVAL '3 hours'),
    (gen_random_uuid(), '${IDS.agentNexus}', '${IDS.userAlex}', 'When deploying security-sensitive changes, always include a rollback plan and a staged rollout strategy (canary deployments). The auth service update is well-prepared but document the rollback steps explicitly.', 'improvement', '${IDS.taskAuthDeploy}', NOW() - INTERVAL '5 hours'),
    (gen_random_uuid(), '${IDS.agentCipher}', '${IDS.userAlex}', 'Excellent detection of the credential stuffing attempt. The automatic rate limiting response was correct. For future incidents of this type, also consider blocking the ASN range in the WAF, not just rate limiting.', 'improvement', NULL, NOW() - INTERVAL '4 hours')
  `);

  // ─── Alerts ──────────────────────────────────────────────────────────────────
  console.log("Seeding alerts...");
  await ds.query(`
    INSERT INTO alerts (id, title, message, type, severity, "workspaceId", "agentId", "taskId", "isRead", "createdAt")
    VALUES
    (gen_random_uuid(), 'Task timeout: Q2 Revenue Forecast', 'Atlas'' Q2 Revenue Forecast task exceeded the 30-minute execution limit and was marked as failed. A new run has been started with optimised parameters.', 'task_failure', 'medium', '${IDS.wsNexus}', '${IDS.agentAtlas}', '${IDS.taskQ2Forecast}', false, NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), 'Security incident: Credential stuffing detected', 'Cipher detected and blocked a credential stuffing attack from IP range 185.220.x.x. 847 requests blocked. No accounts compromised. Monitoring active.', 'security', 'high', '${IDS.wsNexus}', '${IDS.agentCipher}', NULL, false, NOW() - INTERVAL '6 hours'),
    (gen_random_uuid(), 'Approval required: Production deployment', 'Nexus is awaiting your approval to deploy the authentication service update to production. Expires in 48 hours.', 'approval_required', 'high', '${IDS.wsNexus}', '${IDS.agentNexus}', '${IDS.taskAuthDeploy}', false, NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), 'Performance regression confirmed', 'Bolt confirmed a 39% latency regression in the checkout flow. Root cause investigation failed after 3 attempts. Manual investigation required.', 'task_failure', 'high', '${IDS.wsNexus}', '${IDS.agentBolt}', '${IDS.taskPerfRegression}', true, NOW() - INTERVAL '7 hours'),
    (gen_random_uuid(), 'Budget threshold: Nexus at 33%', 'Nexus has used $201 of the $600 monthly budget (33.5%). Current run rate projects to $580 by month end.', 'budget', 'low', '${IDS.wsNexus}', '${IDS.agentNexus}', NULL, true, NOW() - INTERVAL '12 hours')
  `);

  // ─── Work Logs ───────────────────────────────────────────────────────────────
  console.log("Seeding work logs...");
  const workLogEntries = [
    {
      agentId: IDS.agentAtlas,
      taskId: IDS.taskQ2Forecast,
      action: "task_started",
      details:
        "Started Q2 Revenue Forecast analysis. Initialising data pipeline connections.",
      ts: ago(2),
    },
    {
      agentId: IDS.agentAtlas,
      taskId: IDS.taskQ2Forecast,
      action: "tool_executed",
      details:
        "Queried Q1 MRR data from billing database. Retrieved 1,243 subscription records.",
      ts: ago(1.9),
    },
    {
      agentId: IDS.agentAtlas,
      taskId: IDS.taskQ2Forecast,
      action: "tool_executed",
      details:
        "Fetched pipeline data from CRM API. 47 deals in negotiation, total value $4.2M.",
      ts: ago(1.8),
    },
    {
      agentId: IDS.agentAtlas,
      taskId: IDS.taskQ2Forecast,
      action: "error",
      details:
        "CRM API response time degraded. Retrying with exponential backoff (attempt 3/5).",
      ts: ago(0.5),
    },
    {
      agentId: IDS.agentEmber,
      taskId: IDS.taskTechCorp,
      action: "task_started",
      details: "Picked up TechCorp ticket #4421. Priority escalation noted.",
      ts: ago(5),
    },
    {
      agentId: IDS.agentEmber,
      taskId: IDS.taskTechCorp,
      action: "investigation",
      details:
        "Queried server logs. Found 23 503 errors. Root cause: connection pool exhaustion on /v2/reports endpoint.",
      ts: ago(4.9),
    },
    {
      agentId: IDS.agentEmber,
      taskId: IDS.taskTechCorp,
      action: "task_completed",
      details:
        "Resolved TechCorp ticket #4421. Workaround sent. Engineering notified for permanent fix.",
      ts: ago(3),
    },
    {
      agentId: IDS.agentNexus,
      taskId: IDS.taskAuthDeploy,
      action: "task_started",
      details: "Beginning authentication service deployment preparation.",
      ts: ago(8),
    },
    {
      agentId: IDS.agentNexus,
      taskId: IDS.taskAuthDeploy,
      action: "deployment",
      details:
        "Auth service deployed to staging successfully. All 247 tests passing.",
      ts: ago(6),
    },
    {
      agentId: IDS.agentNexus,
      taskId: IDS.taskAuthDeploy,
      action: "approval_requested",
      details: "Production deployment approval request submitted to Alex Chen.",
      ts: ago(2),
    },
    {
      agentId: IDS.agentCipher,
      taskId: IDS.taskSecAudit,
      action: "task_started",
      details:
        "Starting security audit of API endpoints. Running automated OWASP scan first.",
      ts: ago(1),
    },
    {
      agentId: IDS.agentCipher,
      taskId: IDS.taskSecAudit,
      action: "scan_progress",
      details:
        "Completed scan of /auth endpoints. No critical vulnerabilities. 2 medium findings (missing rate limits on /auth/forgot-password).",
      ts: ago(0.8),
    },
    {
      agentId: IDS.agentBolt,
      taskId: IDS.taskPerfRegression,
      action: "task_started",
      details: "Starting checkout flow performance regression analysis.",
      ts: ago(8),
    },
    {
      agentId: IDS.agentBolt,
      taskId: IDS.taskPerfRegression,
      action: "benchmark_run",
      details:
        "Baseline benchmark complete. p95 latency: 2,340ms. Regression confirmed at +39.3%.",
      ts: ago(7.8),
    },
    {
      agentId: IDS.agentBolt,
      taskId: IDS.taskPerfRegression,
      action: "task_failed",
      details:
        "CI environment timeout prevented completion of git bisect. Partial findings delivered.",
      ts: ago(7),
    },
    {
      agentId: IDS.agentTitan,
      taskId: null,
      action: "planning",
      details:
        "Drafted Q2 onboarding strategy. 12 enterprise clients scheduled. Coordinating with Iris for MegaCorp.",
      ts: ago(12),
    },
    {
      agentId: IDS.agentIris,
      taskId: null,
      action: "onboarding",
      details:
        "MegaCorp onboarding workspace created. Kickoff call scheduled for Monday. SSO setup guide sent.",
      ts: ago(47),
    },
    {
      agentId: IDS.agentNova,
      taskId: null,
      action: "analysis",
      details:
        "Completed Q2 paid ads budget analysis. Recommending $45K spend based on LTV:CAC of 8.9x.",
      ts: ago(9),
    },
    {
      agentId: IDS.agentForge,
      taskId: null,
      action: "infrastructure",
      details:
        "Updated CloudWatch dashboards with connection pool metrics. Alert threshold set at 80%.",
      ts: ago(3),
    },
    {
      agentId: IDS.agentScout,
      taskId: null,
      action: "research",
      details:
        "Completed competitive pricing analysis for Q2 strategy review. 8 competitors surveyed.",
      ts: ago(20),
    },
  ];

  for (const log of workLogEntries) {
    await ds.query(`
      INSERT INTO work_logs (id, "agentId", "taskId", action, details, timestamp, metadata)
      VALUES (gen_random_uuid(), '${log.agentId}', ${log.taskId ? `'${log.taskId}'` : "NULL"},
        '${log.action}', '${log.details.replace(/'/g, "''")}', '${log.ts.toISOString()}', '{}')
    `);
  }

  // ─── Budget Usage ────────────────────────────────────────────────────────────
  console.log("Seeding budget usage...");
  const budgetAgents = [
    { id: IDS.agentAtlas, tokens: 78400, cost: 112.8 },
    { id: IDS.agentEmber, tokens: 48200, cost: 78.4 },
    { id: IDS.agentNexus, tokens: 128900, cost: 201.4 },
    { id: IDS.agentScout, tokens: 42100, cost: 76.8 },
    { id: IDS.agentForge, tokens: 92800, cost: 145.6 },
    { id: IDS.agentCipher, tokens: 71400, cost: 112.1 },
    { id: IDS.agentBolt, tokens: 62100, cost: 93.5 },
  ];

  for (const b of budgetAgents) {
    await ds.query(`
      INSERT INTO budget_usage (id, "agentId", "workspaceId", "tokensUsed", cost, period, "periodStart", "periodEnd", "createdAt")
      VALUES (gen_random_uuid(), '${b.id}', '${IDS.wsNexus}', ${b.tokens}, ${b.cost}, 'monthly',
        '${mStart.toISOString()}', '${mEnd.toISOString()}', NOW())
    `);
  }

  // Team-level budget
  const teamBudgets = [
    { id: IDS.teamBackend, tokens: 302700, cost: 450.9 },
    { id: IDS.teamAnalytics, tokens: 129800, cost: 200.2 },
    { id: IDS.teamSupport, tokens: 82400, cost: 134.2 },
  ];

  for (const t of teamBudgets) {
    await ds.query(`
      INSERT INTO budget_usage (id, "teamId", "workspaceId", "tokensUsed", cost, period, "periodStart", "periodEnd", "createdAt")
      VALUES (gen_random_uuid(), '${t.id}', '${IDS.wsNexus}', ${t.tokens}, ${t.cost}, 'monthly',
        '${mStart.toISOString()}', '${mEnd.toISOString()}', NOW())
    `);
  }

  // ─── Team Memory Items ───────────────────────────────────────────────────────
  console.log("Seeding team memory items...");
  await ds.query(`
    INSERT INTO team_memory_items (id, "teamId", title, content, type, tags, "createdById", "createdAt", "updatedAt")
    VALUES
    (
      gen_random_uuid(), '${IDS.teamBackend}', 'Production Deployment Checklist',
      E'Before any production deployment:\n1. All tests passing (unit + integration + e2e)\n2. Staging environment stable for minimum 24 hours\n3. Database migration tested on staging data copy\n4. Rollback procedure documented and tested\n5. Alex approval obtained for security-sensitive changes\n6. Forge has set up monitoring alerts\n7. Deployment window: Tuesday or Thursday 02:00 UTC only',
      'SOP', '["deployment", "checklist", "production"]'::jsonb, '${IDS.userAlex}', NOW() - INTERVAL '30 days', NOW() - INTERVAL '5 days'
    ),
    (
      gen_random_uuid(), '${IDS.teamBackend}', 'API Design Standards',
      E'ClawChat API Standards:\n- RESTful design, versioned at /api/v1/\n- Pagination: cursor-based for large collections\n- Error format: { error: string, code: string, details?: any }\n- Auth: JWT Bearer token in Authorization header\n- Rate limiting: 100 req/min per user, 1000 req/min for bridge service\n- All endpoints require authentication unless explicitly public\n- Swagger docs auto-generated from NestJS decorators',
      'rule', '["api", "standards", "design"]'::jsonb, '${IDS.userAlex}', NOW() - INTERVAL '60 days', NOW() - INTERVAL '10 days'
    ),
    (
      gen_random_uuid(), '${IDS.teamBackend}', 'Security Incident Response Playbook',
      E'Security incident response steps:\n1. Cipher auto-detects and rate-limits anomalous traffic\n2. Notify Alex within 30 minutes of high/critical incidents\n3. If account compromise suspected: suspend affected accounts, notify users within 72 hours\n4. Document all actions taken in the incident thread\n5. Post-incident review within 48 hours\n6. Update WAF rules to prevent recurrence\n7. File incident report if PII affected (GDPR 72-hour rule)',
      'SOP', '["security", "incident", "playbook"]'::jsonb, '${IDS.userAlex}', NOW() - INTERVAL '45 days', NOW() - INTERVAL '6 hours'
    )
  `);

  // ─── OpenClaw Connection ─────────────────────────────────────────────────────
  console.log("Seeding OpenClaw connection...");
  await ds.query(`
    INSERT INTO openclaw_connections (id, "workspaceId", "instanceUrl", "apiKey", status,
      "lastConnectedAt", "agentsSynced", "useMockMode", "createdAt", "updatedAt")
    VALUES (
      '${IDS.connectionNexus}', '${IDS.wsNexus}',
      'https://mock.openclaw.internal',
      NULL,
      'connected',
      NOW() - INTERVAL '5 minutes',
      12, true,
      NOW() - INTERVAL '7 days',
      NOW() - INTERVAL '5 minutes'
    )
  `);

  await ds.destroy();
  console.log("Database connection closed.");
}
