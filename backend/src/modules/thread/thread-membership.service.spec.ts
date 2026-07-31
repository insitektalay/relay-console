import { ThreadMembershipService } from './thread-membership.service'

describe('ThreadMembershipService', () => {
  const membershipRepo = {
    find: jest.fn(),
  }
  const agentRepo = {}
  const threadRepo = {}
  const service = new ThreadMembershipService(
    membershipRepo as any,
    agentRepo as any,
    threadRepo as any,
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps membership rows authoritative when hydrating one thread', async () => {
    membershipRepo.find.mockResolvedValue([
      { agentId: 'membership-agent' },
    ])

    const result = await service.hydrateThread({
      id: 'thread-1',
      workspaceId: 'workspace-1',
      agentIds: ['legacy-agent'],
    } as any)

    expect(result.agentIds).toEqual(['membership-agent'])
  })

  it('falls back to legacy thread agent IDs when no membership rows exist', async () => {
    membershipRepo.find.mockResolvedValue([])

    const result = await service.hydrateThread({
      id: 'thread-1',
      workspaceId: 'workspace-1',
      agentIds: ['legacy-agent-1', '', 'legacy-agent-1', 'legacy-agent-2'],
    } as any)

    expect(result.agentIds).toEqual(['legacy-agent-1', 'legacy-agent-2'])
  })

  it('falls back per thread when batch membership rows are missing', async () => {
    membershipRepo.find.mockResolvedValue([
      { threadId: 'thread-with-membership', agentId: 'membership-agent' },
    ])

    const results = await service.hydrateThreads([
      {
        id: 'thread-with-membership',
        workspaceId: 'workspace-1',
        agentIds: ['stale-legacy-agent'],
      },
      {
        id: 'legacy-thread',
        workspaceId: 'workspace-1',
        agentIds: ['legacy-agent-1', 'legacy-agent-2'],
      },
    ] as any)

    expect(results.map((thread) => thread.agentIds)).toEqual([
      ['membership-agent'],
      ['legacy-agent-1', 'legacy-agent-2'],
    ])
  })
})
