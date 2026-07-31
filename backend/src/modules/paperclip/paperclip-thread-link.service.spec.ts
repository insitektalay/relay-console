import { PaperclipThreadLinkService } from './paperclip-thread-link.service'
import { PaperclipApiError } from './paperclip-api-client.service'

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation(async (value) => value),
    delete: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((input) => input),
    ...overrides,
  }
}

describe('PaperclipThreadLinkService', () => {
  it('returns object_not_found fetch state instead of throwing when the linked object is missing', async () => {
    const linkRepo = makeRepoMock({
      findOne: jest.fn().mockResolvedValue({
        id: 'link-1',
        workspaceId: 'workspace-1',
        threadId: 'thread-1',
        connectionId: 'connection-1',
        objectType: 'issue',
        paperclipObjectId: 'PAP-39',
        paperclipObjectRef: 'PAP-39',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        createdAt: new Date('2026-03-29T12:00:00.000Z'),
        updatedAt: new Date('2026-03-29T12:00:00.000Z'),
      }),
    })
    const threadRepo = makeRepoMock({
      findOne: jest.fn().mockResolvedValue({
        id: 'thread-1',
        workspaceId: 'workspace-1',
      }),
    })
    const workspaceMembershipService = {
      ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
      ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue(undefined),
    }
    const paperclipConnectionService = {
      getConnectionWithSecret: jest.fn().mockResolvedValue({
        id: 'connection-1',
        workspaceId: 'workspace-1',
        displayName: 'Main Paperclip',
        baseUrl: 'https://paperclip.example.com',
        companyId: 'company-1',
        companyName: 'Paperclip HQ',
        authType: 'bearer_token',
        status: 'ready',
        lastValidatedAt: new Date('2026-03-29T11:00:00.000Z'),
        lastSuccessAt: new Date('2026-03-29T11:00:00.000Z'),
        lastErrorCode: null,
        lastErrorMessage: null,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
        createdAt: new Date('2026-03-29T10:00:00.000Z'),
        updatedAt: new Date('2026-03-29T10:00:00.000Z'),
        bearerTokenCiphertext: 'cipher',
        bearerTokenIv: 'iv',
        bearerTokenAuthTag: 'tag',
        bearerTokenKeyVersion: 'v1',
      }),
      decryptBearerToken: jest.fn().mockReturnValue('token-1'),
      toView: jest.fn().mockImplementation((connection) => ({
        id: connection.id,
        workspaceId: connection.workspaceId,
        displayName: connection.displayName,
        baseUrl: connection.baseUrl,
        companyId: connection.companyId,
        companyName: connection.companyName,
        authType: 'bearer_token',
        status: connection.status,
        lastValidatedAt: connection.lastValidatedAt.toISOString(),
        lastSuccessAt: connection.lastSuccessAt.toISOString(),
        lastErrorCode: connection.lastErrorCode,
        lastErrorMessage: connection.lastErrorMessage,
        createdByUserId: connection.createdByUserId,
        updatedByUserId: connection.updatedByUserId,
        createdAt: connection.createdAt.toISOString(),
        updatedAt: connection.updatedAt.toISOString(),
      })),
      markConnectionFailure: jest.fn(),
    }
    const paperclipApiClient = {
      fetchIssue: jest
        .fn()
        .mockRejectedValue(
          new PaperclipApiError(
            'not_found',
            'The requested Paperclip resource was not found.',
            404,
          ),
        ),
      fetchApproval: jest.fn(),
    }

    const service = new PaperclipThreadLinkService(
      linkRepo as any,
      threadRepo as any,
      workspaceMembershipService as any,
      paperclipConnectionService as any,
      paperclipApiClient as any,
    )

    const result = await service.getThreadLinkView('thread-1', 'user-1')

    expect(result.fetchState).toBe('object_not_found')
    expect(result.link?.paperclipObjectId).toBe('PAP-39')
    expect(paperclipConnectionService.markConnectionFailure).not.toHaveBeenCalled()
  })
})
