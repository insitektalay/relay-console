export type PaperclipConnectionStatus =
  | 'unverified'
  | 'ready'
  | 'unauthorized'
  | 'unreachable'
  | 'error'

export type PaperclipObjectType = 'issue' | 'approval'

export interface PaperclipConnectionView {
  id: string
  workspaceId: string
  displayName: string
  baseUrl: string
  companyId: string
  companyName: string | null
  authType: 'bearer_token'
  status: PaperclipConnectionStatus
  lastValidatedAt: string | null
  lastSuccessAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  createdByUserId: string
  updatedByUserId: string
  createdAt: string
  updatedAt: string
}

export interface PaperclipIssueSummary {
  kind: 'issue'
  id: string
  identifier: string | null
  title: string
  status: string
  priority: string | null
  assigneeAgentId: string | null
  projectName: string | null
  updatedAt: string
  deepLinkUrl: string
  companyId: string | null
}

export interface PaperclipApprovalSummary {
  kind: 'approval'
  id: string
  title: string
  approvalType: string
  status: string
  requestedByAgentId: string | null
  decisionNote: string | null
  linkedIssueCount: number
  decidedAt: string | null
  updatedAt: string
  deepLinkUrl: string
  companyId: string | null
}

export type PaperclipLinkedObjectSummary =
  | PaperclipIssueSummary
  | PaperclipApprovalSummary

export type PaperclipLinkFetchState =
  | 'unlinked'
  | 'ok'
  | 'unauthorized'
  | 'unavailable'
  | 'object_not_found'
  | 'error'

export interface ThreadPaperclipLinkRecordView {
  id: string
  workspaceId: string
  threadId: string
  connectionId: string
  objectType: PaperclipObjectType
  paperclipObjectId: string
  paperclipObjectRef: string | null
  createdByUserId: string
  updatedByUserId: string
  createdAt: string
  updatedAt: string
}

export interface ThreadPaperclipLinkView {
  link: ThreadPaperclipLinkRecordView | null
  connection: PaperclipConnectionView | null
  objectSummary: PaperclipLinkedObjectSummary | null
  fetchState: PaperclipLinkFetchState
  errorCode: string | null
  errorMessage: string | null
  fetchedAt: string | null
}
