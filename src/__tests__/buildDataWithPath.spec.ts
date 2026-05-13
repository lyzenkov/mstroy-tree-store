// tests/utils/buildDataWithPath.spec.ts
import { describe, it, expect } from 'vitest'
import type { TreeItem } from '@/types/tree'

interface TreeItemWithPath extends TreeItem {
  path: string[]
}

// Копируем функцию из компонента для тестирования
function buildDataWithPath(items: TreeItem[]): TreeItemWithPath[] {
  const itemMap = new Map<string | number, TreeItemWithPath>()
  const result: TreeItemWithPath[] = []
  
  items.forEach(item => {
    const itemWithPath: TreeItemWithPath = { ...item, path: [] }
    itemMap.set(item.id, itemWithPath)
    result.push(itemWithPath)
  })
  
  const pathCache = new Map<string | number, string[]>()
  
  function getPath(item: TreeItemWithPath): string[] {
    const cachedPath = pathCache.get(item.id)
    if (cachedPath) return cachedPath
    
    if (item.parent === null) {
      pathCache.set(item.id, [item.label])
      return [item.label]
    }
    
    const parent = itemMap.get(item.parent)
    if (parent) {
      const parentPath = getPath(parent)
      const path = [...parentPath, item.label]
      pathCache.set(item.id, path)
      return path
    }
    
    return [item.label]
  }
  
  result.forEach(item => {
    item.path = getPath(item)
  })
  
  return result
}

describe('buildDataWithPath', () => {
  it('should build correct paths for flat data', () => {
    const items: TreeItem[] = [
      { id: 1, parent: null, label: 'Root' },
      { id: 2, parent: 1, label: 'Child' },
      { id: 3, parent: 2, label: 'Grandchild' }
    ]
    
    const result: TreeItemWithPath[] = buildDataWithPath(items)
    
    const item1 = result.find(i => i.id === 1)
    const item2 = result.find(i => i.id === 2)
    const item3 = result.find(i => i.id === 3)
    
    expect(item1?.path).toEqual(['Root'])
    expect(item2?.path).toEqual(['Root', 'Child'])
    expect(item3?.path).toEqual(['Root', 'Child', 'Grandchild'])
  })

  it('should handle multiple roots', () => {
    const items: TreeItem[] = [
      { id: 1, parent: null, label: 'Root A' },
      { id: 2, parent: null, label: 'Root B' },
      { id: 3, parent: 1, label: 'Child of A' }
    ]
    
    const result: TreeItemWithPath[] = buildDataWithPath(items)
    
    const item1 = result.find(i => i.id === 1)
    const item2 = result.find(i => i.id === 2)
    const item3 = result.find(i => i.id === 3)
    
    expect(item1?.path).toEqual(['Root A'])
    expect(item2?.path).toEqual(['Root B'])
    expect(item3?.path).toEqual(['Root A', 'Child of A'])
  })

  it('should handle orphaned items (parent not found)', () => {
    const items: TreeItem[] = [
      { id: 1, parent: null, label: 'Root' },
      { id: 2, parent: 999, label: 'Orphan' }
    ]
    
    const result: TreeItemWithPath[] = buildDataWithPath(items)
    
    const orphan = result.find(i => i.id === 2)
    expect(orphan?.path).toEqual(['Orphan'])
  })
})