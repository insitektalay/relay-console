import { shouldMountApiDocs } from './api-docs'

describe('shouldMountApiDocs', () => {
  it('mounts API docs by default outside production', () => {
    expect(shouldMountApiDocs({ NODE_ENV: 'development' })).toBe(true)
    expect(shouldMountApiDocs({ NODE_ENV: 'test' })).toBe(true)
  })

  it('allows API docs to be disabled outside production', () => {
    expect(
      shouldMountApiDocs({
        NODE_ENV: 'development',
        CLAWCHAT_API_DOCS_ENABLED: 'false',
      }),
    ).toBe(false)
  })

  it('does not mount API docs in production by default', () => {
    expect(shouldMountApiDocs({ NODE_ENV: 'production' })).toBe(false)
  })

  it('does not treat the generic docs flag as enough to expose production docs', () => {
    expect(
      shouldMountApiDocs({
        NODE_ENV: 'production',
        CLAWCHAT_API_DOCS_ENABLED: 'true',
      }),
    ).toBe(false)
  })

  it('requires the internal production docs flag to expose docs in production', () => {
    expect(
      shouldMountApiDocs({
        NODE_ENV: 'production',
        CLAWCHAT_INTERNAL_API_DOCS_ENABLED: 'true',
      }),
    ).toBe(true)
  })
})
