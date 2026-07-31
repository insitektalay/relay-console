import {
  CalendarExecutors1,
  CalendarExecutors1Registrations,
} from "./calendar-01.executors";
import {
  CommercePaymentsExecutors1,
  CommercePaymentsExecutors1Registrations,
} from "./commerce-payments-01.executors";
import {
  CommercePaymentsExecutors2,
  CommercePaymentsExecutors2Registrations,
} from "./commerce-payments-02.executors";
import {
  CommunicationExecutors1,
  CommunicationExecutors1Registrations,
} from "./communication-01.executors";
import {
  CommunicationExecutors2,
  CommunicationExecutors2Registrations,
} from "./communication-02.executors";
import {
  CommunicationExecutors3,
  CommunicationExecutors3Registrations,
} from "./communication-03.executors";
import {
  CommunicationExecutors4,
  CommunicationExecutors4Registrations,
} from "./communication-04.executors";
import {
  ContentCreativeExecutors1,
  ContentCreativeExecutors1Registrations,
} from "./content-creative-01.executors";
import {
  ContentCreativeExecutors2,
  ContentCreativeExecutors2Registrations,
} from "./content-creative-02.executors";
import {
  ContentCreativeExecutors3,
  ContentCreativeExecutors3Registrations,
} from "./content-creative-03.executors";
import {
  CrmSupportExecutors1,
  CrmSupportExecutors1Registrations,
} from "./crm-support-01.executors";
import {
  CrmSupportExecutors2,
  CrmSupportExecutors2Registrations,
} from "./crm-support-02.executors";
import {
  CrmSupportExecutors3,
  CrmSupportExecutors3Registrations,
} from "./crm-support-03.executors";
import {
  CrmSupportExecutors4,
  CrmSupportExecutors4Registrations,
} from "./crm-support-04.executors";
import {
  DeveloperExecutors1,
  DeveloperExecutors1Registrations,
} from "./developer-01.executors";
import {
  DeveloperExecutors2,
  DeveloperExecutors2Registrations,
} from "./developer-02.executors";
import {
  DeveloperExecutors3,
  DeveloperExecutors3Registrations,
} from "./developer-03.executors";
import {
  KnowledgeDocumentsExecutors1,
  KnowledgeDocumentsExecutors1Registrations,
} from "./knowledge-documents-01.executors";
import {
  KnowledgeDocumentsExecutors2,
  KnowledgeDocumentsExecutors2Registrations,
} from "./knowledge-documents-02.executors";
import {
  KnowledgeDocumentsExecutors3,
  KnowledgeDocumentsExecutors3Registrations,
} from "./knowledge-documents-03.executors";
import {
  KnowledgeDocumentsExecutors4,
  KnowledgeDocumentsExecutors4Registrations,
} from "./knowledge-documents-04.executors";
import {
  LegalComplianceExecutors1,
  LegalComplianceExecutors1Registrations,
} from "./legal-compliance-01.executors";
import {
  OtherExecutors1,
  OtherExecutors1Registrations,
} from "./other-01.executors";
import {
  WorkManagementExecutors1,
  WorkManagementExecutors1Registrations,
} from "./work-management-01.executors";
import {
  WorkManagementExecutors2,
  WorkManagementExecutors2Registrations,
} from "./work-management-02.executors";
import {
  WorkManagementExecutors3,
  WorkManagementExecutors3Registrations,
} from "./work-management-03.executors";
import {
  WorkManagementExecutors4,
  WorkManagementExecutors4Registrations,
} from "./work-management-04.executors";
import {
  WorkManagementExecutors5,
  WorkManagementExecutors5Registrations,
} from "./work-management-05.executors";
import { mergeConnectorMethodModules } from "../../connector-method-module";

export const NATIVE_PROVIDER_EXECUTORS = mergeConnectorMethodModules(
  CalendarExecutors1,
  CommercePaymentsExecutors1,
  CommercePaymentsExecutors2,
  CommunicationExecutors1,
  CommunicationExecutors2,
  CommunicationExecutors3,
  CommunicationExecutors4,
  ContentCreativeExecutors1,
  ContentCreativeExecutors2,
  ContentCreativeExecutors3,
  CrmSupportExecutors1,
  CrmSupportExecutors2,
  CrmSupportExecutors3,
  CrmSupportExecutors4,
  DeveloperExecutors1,
  DeveloperExecutors2,
  DeveloperExecutors3,
  KnowledgeDocumentsExecutors1,
  KnowledgeDocumentsExecutors2,
  KnowledgeDocumentsExecutors3,
  KnowledgeDocumentsExecutors4,
  LegalComplianceExecutors1,
  OtherExecutors1,
  WorkManagementExecutors1,
  WorkManagementExecutors2,
  WorkManagementExecutors3,
  WorkManagementExecutors4,
  WorkManagementExecutors5,
);

export const NATIVE_PROVIDER_EXECUTOR_REGISTRATION_MODULES = [
  {
    methods: CalendarExecutors1,
    registrations: CalendarExecutors1Registrations,
  },
  {
    methods: CommercePaymentsExecutors1,
    registrations: CommercePaymentsExecutors1Registrations,
  },
  {
    methods: CommercePaymentsExecutors2,
    registrations: CommercePaymentsExecutors2Registrations,
  },
  {
    methods: CommunicationExecutors1,
    registrations: CommunicationExecutors1Registrations,
  },
  {
    methods: CommunicationExecutors2,
    registrations: CommunicationExecutors2Registrations,
  },
  {
    methods: CommunicationExecutors3,
    registrations: CommunicationExecutors3Registrations,
  },
  {
    methods: CommunicationExecutors4,
    registrations: CommunicationExecutors4Registrations,
  },
  {
    methods: ContentCreativeExecutors1,
    registrations: ContentCreativeExecutors1Registrations,
  },
  {
    methods: ContentCreativeExecutors2,
    registrations: ContentCreativeExecutors2Registrations,
  },
  {
    methods: ContentCreativeExecutors3,
    registrations: ContentCreativeExecutors3Registrations,
  },
  {
    methods: CrmSupportExecutors1,
    registrations: CrmSupportExecutors1Registrations,
  },
  {
    methods: CrmSupportExecutors2,
    registrations: CrmSupportExecutors2Registrations,
  },
  {
    methods: CrmSupportExecutors3,
    registrations: CrmSupportExecutors3Registrations,
  },
  {
    methods: CrmSupportExecutors4,
    registrations: CrmSupportExecutors4Registrations,
  },
  {
    methods: DeveloperExecutors1,
    registrations: DeveloperExecutors1Registrations,
  },
  {
    methods: DeveloperExecutors2,
    registrations: DeveloperExecutors2Registrations,
  },
  {
    methods: DeveloperExecutors3,
    registrations: DeveloperExecutors3Registrations,
  },
  {
    methods: KnowledgeDocumentsExecutors1,
    registrations: KnowledgeDocumentsExecutors1Registrations,
  },
  {
    methods: KnowledgeDocumentsExecutors2,
    registrations: KnowledgeDocumentsExecutors2Registrations,
  },
  {
    methods: KnowledgeDocumentsExecutors3,
    registrations: KnowledgeDocumentsExecutors3Registrations,
  },
  {
    methods: KnowledgeDocumentsExecutors4,
    registrations: KnowledgeDocumentsExecutors4Registrations,
  },
  {
    methods: LegalComplianceExecutors1,
    registrations: LegalComplianceExecutors1Registrations,
  },
  { methods: OtherExecutors1, registrations: OtherExecutors1Registrations },
  {
    methods: WorkManagementExecutors1,
    registrations: WorkManagementExecutors1Registrations,
  },
  {
    methods: WorkManagementExecutors2,
    registrations: WorkManagementExecutors2Registrations,
  },
  {
    methods: WorkManagementExecutors3,
    registrations: WorkManagementExecutors3Registrations,
  },
  {
    methods: WorkManagementExecutors4,
    registrations: WorkManagementExecutors4Registrations,
  },
  {
    methods: WorkManagementExecutors5,
    registrations: WorkManagementExecutors5Registrations,
  },
] as const;
