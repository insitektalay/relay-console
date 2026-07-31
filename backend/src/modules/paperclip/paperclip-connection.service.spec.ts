import { BadRequestException } from '@nestjs/common'
import { PaperclipConnectionService } from './paperclip-connection.service'

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((input) => ({
      ...input,
      id: 'connection-1',
      createdAt: new Date('2026-03-29T12:00:00.000Z'),
      updatedAt: new Date('2026-03-29T12:00:00.000Z'),
    })),
    save: jest.fn().mockImplementation(async (value) => ({
      ...value,
      id: value.id ?? 'connection-1',
      createdAt: value.createdAt ?? new Date('2026-03-29T12:00:00.000Z'),
      updatedAt: new Date('2026-03-29T12:00:00.000Z'),
    })),
    createQueryBuilder: jest.fn(),
    ...overrides,
  }
}

describe('PaperclipConnectionService', () => {
  it('stores the canonical company id returned by Paperclip validation', async () => {
    const connectionRepo = makeRepoMock()
    const encryptionService = {
      encryptString: jest.fn().mockReturnValue({
        ciphertext: 'cipher',
        iv: 'iv',
        authTag: 'tag',
        keyVersion: 'v1',
      }),
      decryptString: jest.fn(),
    }
    const paperclipApiClient = {
      normalizeBaseUrl: jest
        .fn()
        .mockReturnValue('https://paperclip.example.com'),
      validateConnection: jest.fn().mockResolvedValue({
        companyId: 'company-canonical',
        companyName: 'Paperclip HQ',
      }),
    }

    const service = new PaperclipConnectionService(
      connectionRepo as any,
      encryptionService as any,
      paperclipApiClient as any,
    )

    const result = await service.createConnection(
      'workspace-1',
      {
        displayName: 'Main Paperclip',
        baseUrl: 'https://paperclip.example.com/api',
        companyId: 'company-alias',
        bearerToken: 'token-1',
      },
      'user-1',
    )

    expect(connectionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        companyId: 'company-canonical',
        companyName: 'Paperclip HQ',
      }),
    )
    expect(result.companyId).toBe('company-canonical')
  })

  it('rejects create with a blank bearer token', async () => {
    const service = new PaperclipConnectionService(
      makeRepoMock() as any,
      {
        encryptString: jest.fn(),
        decryptString: jest.fn(),
      } as any,
      {
        normalizeBaseUrl: jest.fn().mockReturnValue('https://paperclip.example.com'),
        validateConnection: jest.fn(),
      } as any,
    )

    await expect(
      service.createConnection(
        'workspace-1',
        {
          displayName: 'Main Paperclip',
          baseUrl: 'https://paperclip.example.com',
          companyId: 'company-1',
          bearerToken: '   ',
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException)
  })
})
