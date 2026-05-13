import { describe, it, expect, beforeEach } from 'vitest'
import { TreeStore } from '@/stores/TreeStore'
import type { TreeItem } from '@/types/tree'

describe('TreeStore', () => {
  const items: TreeItem[] = [
    { id: 1, parent: null, label: 'Root' },
    { id: 2, parent: 1, label: 'Child 1' },
    { id: 3, parent: 2, label: 'Grandchild' },
    { id: 4, parent: 1, label: 'Child 2' }
  ]

  let store: TreeStore

  beforeEach(() => {
    store = new TreeStore(items)
  })

  it('getAll should return all items', () => {
    const result = store.getAll()
    expect(result).toHaveLength(4)
    expect(result).toEqual(items)
  })

  it('getItem should return correct item', () => {
    const item = store.getItem(1)
    expect(item).toBeDefined()
    expect(item?.id).toBe(1)
    expect(item?.label).toBe('Root')
    
    const nonExistent = store.getItem(999)
    expect(nonExistent).toBeUndefined()
  })

  it('getChildren should return direct children', () => {
    const childrenOf1 = store.getChildren(1)
    expect(childrenOf1).toHaveLength(2)
    expect(childrenOf1[0]?.id).toBe(2)
    expect(childrenOf1[1]?.id).toBe(4)
    
    const childrenOf2 = store.getChildren(2)
    expect(childrenOf2).toHaveLength(1)
    expect(childrenOf2[0]?.id).toBe(3)
    
    const childrenOf999 = store.getChildren(999)
    expect(childrenOf999).toHaveLength(0)
  })

  it('getAllChildren should return all descendants', () => {
    const descendants = store.getAllChildren(1)
    expect(descendants).toHaveLength(3)
    
    const ids = descendants.map(item => item.id)
    expect(ids).toContain(2)
    expect(ids).toContain(3)
    expect(ids).toContain(4)
  })

  it('getAllParents should return parent chain', () => {
    const parents = store.getAllParents(3)
    expect(parents).toHaveLength(2)
    
    // Используем optional chaining и проверяем, что элементы существуют
    expect(parents[0]).toBeDefined()
    expect(parents[0]?.id).toBe(2)
    expect(parents[0]?.label).toBe('Child 1')
    
    expect(parents[1]).toBeDefined()
    expect(parents[1]?.id).toBe(1)
    expect(parents[1]?.label).toBe('Root')
  })

  it('getAllParents should return empty array for root element', () => {
    const parents = store.getAllParents(1)
    expect(parents).toHaveLength(0)
  })

  it('getAllParents should return empty array for non-existent element', () => {
    const parents = store.getAllParents(999)
    expect(parents).toHaveLength(0)
  })

  it('addItem should add new item', () => {
    const newItem: TreeItem = { id: 5, parent: 1, label: 'New Child' }
    store.addItem(newItem)
    
    expect(store.getAll()).toHaveLength(5)
    expect(store.getItem(5)).toBeDefined()
    expect(store.getItem(5)?.label).toBe('New Child')
  })

  it('addItem should not duplicate existing id', () => {
    const duplicate: TreeItem = { id: 1, parent: null, label: 'Duplicate' }
    store.addItem(duplicate)
    
    expect(store.getAll()).toHaveLength(4)
    expect(store.getItem(1)?.label).toBe('Root') // Не изменилось
  })

  it('removeItem should remove item and all its children', () => {
    store.removeItem(1)
    
    expect(store.getItem(1)).toBeUndefined()
    expect(store.getItem(2)).toBeUndefined()
    expect(store.getItem(3)).toBeUndefined()
    expect(store.getItem(4)).toBeUndefined()
    expect(store.getAll()).toHaveLength(0)
  })

  it('removeItem should remove only specific branch', () => {
    store.removeItem(2)
    
    expect(store.getItem(2)).toBeUndefined()
    expect(store.getItem(3)).toBeUndefined()
    expect(store.getItem(1)).toBeDefined()
    expect(store.getItem(4)).toBeDefined()
    expect(store.getAll()).toHaveLength(2)
  })

  it('updateItem should update existing item', () => {
    const updated: TreeItem = { id: 1, parent: null, label: 'Updated Root' }
    store.updateItem(updated)
    
    expect(store.getItem(1)?.label).toBe('Updated Root')
    expect(store.getItem(1)?.id).toBe(1)
  })

  it('updateItem should not add non-existent item', () => {
    const nonExistent: TreeItem = { id: 999, parent: null, label: 'Ghost' }
    store.updateItem(nonExistent)
    
    expect(store.getItem(999)).toBeUndefined()
    expect(store.getAll()).toHaveLength(4)
  })
})

describe('TreeStore Performance & Edge Cases', () => {
  it('getChildren should return cached result (performance test)', () => {
    // Создаем большой набор данных
    const largeDataSet: TreeItem[] = []
    for (let i = 0; i < 1000; i++) {
      largeDataSet.push({
        id: i,
        parent: i === 0 ? null : Math.floor(Math.random() * i),
        label: `Item ${i}`
      })
    }
    
    const largeStore = new TreeStore(largeDataSet)
    const startTime = performance.now()
    
    // Многократно вызываем getChildren для разных id
    for (let i = 0; i < 1000; i++) {
      largeStore.getChildren(Math.floor(Math.random() * 1000))
    }
    
    const endTime = performance.now()
    expect(endTime - startTime).toBeLessThan(100) // Должно быть быстрее 100ms
  })

  it('should handle mixed id types (string and number)', () => {
    const mixedItems: TreeItem[] = [
      { id: 1, parent: null, label: 'Root' },
      { id: 'abc', parent: 1, label: 'String Child' },
      { id: 'def', parent: 'abc', label: 'Grandchild' },
      { id: 2, parent: 'abc', label: 'Number Child' }
    ]
    
    const store = new TreeStore(mixedItems)
    
    expect(store.getChildren(1)).toHaveLength(1)
    expect(store.getChildren('abc')).toHaveLength(2)
    expect(store.getAllChildren(1)).toHaveLength(3)
    expect(store.getAllParents('def')).toHaveLength(2)
  })

  it('should handle circular references gracefully', () => {
    const circularItems: TreeItem[] = [
      { id: 1, parent: 2, label: 'Item 1' },
      { id: 2, parent: 1, label: 'Item 2' }
    ]
    
    const store = new TreeStore(circularItems)
    
    // Должен вернуть пустой массив для родителей, чтобы избежать бесконечного цикла
    const parents = store.getAllParents(1)
    expect(parents).toBeDefined()
  })

  it('getAllChildren should work with nested structure of depth 10', () => {
    const deepItems: TreeItem[] = []
    let prevId: string | number = 'root'
    
    for (let i = 0; i < 10; i++) {
      const currentId = i
      deepItems.push({
        id: currentId,
        parent: i === 0 ? null : prevId,
        label: `Level ${i}`
      })
      prevId = currentId
    }
    
    const store = new TreeStore(deepItems)
    const children = store.getAllChildren(0)
    
    expect(children).toHaveLength(9) // 9 потомков (уровни 1-9)
  })

  it('should maintain data integrity after multiple operations', () => {
    const store = new TreeStore([
      { id: 1, parent: null, label: 'Root' },
      { id: 2, parent: 1, label: 'Child' },
      { id: 3, parent: 2, label: 'Grandchild' }
    ])
    
    // Серия операций
    store.addItem({ id: 4, parent: 1, label: 'New Child' })
    store.removeItem(2)
    store.updateItem({ id: 1, parent: null, label: 'Updated Root' })
    store.addItem({ id: 5, parent: 4, label: 'Child of New' })
    
    expect(store.getAll()).toHaveLength(3) // id: 1, 4, 5
    expect(store.getItem(1)?.label).toBe('Updated Root')
    expect(store.getChildren(1)).toHaveLength(1) // только id: 4
    expect(store.getChildren(4)).toHaveLength(1) // id: 5
    expect(store.getAllChildren(1)).toHaveLength(2) // id: 4, 5
  })

  it('getAllParents should return items in correct order (from direct parent to root)', () => {
    const items: TreeItem[] = [
      { id: 1, parent: null, label: 'Root' },
      { id: 2, parent: 1, label: 'Level 1' },
      { id: 3, parent: 2, label: 'Level 2' },
      { id: 4, parent: 3, label: 'Level 3' }
    ]
    
    const store = new TreeStore(items)
    const parents = store.getAllParents(4)
    
    expect(parents).toHaveLength(3)
    expect(parents[0]?.id).toBe(3) // прямой родитель
    expect(parents[1]?.id).toBe(2)
    expect(parents[2]?.id).toBe(1) // корень
  })
})