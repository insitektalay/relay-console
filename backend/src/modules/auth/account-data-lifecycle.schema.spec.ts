import dataSource from '../../infrastructure/database/data-source'
import {
  ACCOUNT_LIFECYCLE_ACCOUNT_SCOPED_EXPORT_TABLES,
  ACCOUNT_LIFECYCLE_GLOBAL_TABLES,
  ACCOUNT_LIFECYCLE_INTENTIONALLY_SECRET_TABLES,
  ACCOUNT_LIFECYCLE_WORKSPACE_GRAPH_TABLES,
} from './account-data-lifecycle.service'

describe('account data lifecycle schema coverage', () => {
  beforeAll(async () => {
    if (!dataSource.entityMetadatas.length) {
      await (dataSource as any).buildMetadatas()
    }
  })

  it('classifies every persisted entity into a workspace, account, graph, or global lifecycle scope', () => {
    const unclassified = dataSource.entityMetadatas
      .filter((entity) => {
        const columns = new Set(entity.columns.map((column) => column.propertyName))
        return !columns.has('workspaceId') &&
          !columns.has('userId') &&
          !ACCOUNT_LIFECYCLE_WORKSPACE_GRAPH_TABLES.has(entity.tableName) &&
          !ACCOUNT_LIFECYCLE_GLOBAL_TABLES.has(entity.tableName)
      })
      .map((entity) => entity.tableName)
      .sort()

    expect(unclassified).toEqual([])
  })

  it('exports every safe account-scoped table that is not already workspace-scoped', () => {
    const omitted = dataSource.entityMetadatas
      .filter((entity) => {
        const columns = new Set(entity.columns.map((column) => column.propertyName))
        return columns.has('userId') &&
          !columns.has('workspaceId') &&
          !ACCOUNT_LIFECYCLE_ACCOUNT_SCOPED_EXPORT_TABLES.has(entity.tableName) &&
          !ACCOUNT_LIFECYCLE_INTENTIONALLY_SECRET_TABLES.has(entity.tableName)
      })
      .map((entity) => entity.tableName)
      .sort()

    expect(omitted).toEqual([])
  })

  it('keeps every declared relational graph table backed by an entity', () => {
    const entityTables = new Set(
      dataSource.entityMetadatas.map((entity) => entity.tableName),
    )
    const missing = [...ACCOUNT_LIFECYCLE_WORKSPACE_GRAPH_TABLES]
      .filter((table) => !entityTables.has(table))
      .sort()

    expect(missing).toEqual([])
  })
})
