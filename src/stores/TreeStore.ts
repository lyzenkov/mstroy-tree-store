// TreeStore.ts
import type { TreeItem, ITreeStore } from '@/types/tree'

export class TreeStore implements ITreeStore {
  private items: TreeItem[]
  private itemsMap: Map<string | number, TreeItem>
  private childrenCache: Map<string | number | null, TreeItem[]>

  constructor(items: TreeItem[]) {
    this.items = [...items]
    this.itemsMap = new Map()
    this.childrenCache = new Map()
    this.buildMap()
    this.buildChildrenCache()
  }

  private buildMap(): void {
    this.items.forEach(item => {
      this.itemsMap.set(item.id, item)
    })
  }

  private buildChildrenCache(): void {
    this.childrenCache.clear()
    
    this.items.forEach(item => {
      const parentId = item.parent ?? null
      
      if (!this.childrenCache.has(parentId)) {
        this.childrenCache.set(parentId, [])
      }
      this.childrenCache.get(parentId)!.push(item)
    })
  }

  getAll(): TreeItem[] {
    return this.items
  }

  getItem(id: string | number): TreeItem | undefined {
    return this.itemsMap.get(id)
  }

  getChildren(id: string | number | null): TreeItem[] {
    return this.childrenCache.get(id) || []
  }

  getAllChildren(id: string | number): TreeItem[] {
    const result: TreeItem[] = []
    const stack = [...this.getChildren(id)]
    
    while (stack.length) {
      const current = stack.pop()!
      result.push(current)
      stack.push(...this.getChildren(current.id))
    }
    
    return result
  }

  getAllParents(id: string | number): TreeItem[] {
    const parents: TreeItem[] = []
    let current = this.getItem(id)
    
    while (current?.parent !== null && current?.parent !== undefined) {
      const parent = this.getItem(current.parent)
      if (!parent) break
      parents.push(parent)
      current = parent
    }
    
    return parents
  }

  addItem(item: TreeItem): void {
    if (this.itemsMap.has(item.id)) {
      console.warn(`Item with id ${item.id} already exists`)
      return
    }
    this.items.push(item)
    this.itemsMap.set(item.id, item)
    this.buildChildrenCache()
  }

  removeItem(id: string | number): void {
    const childrenIds = this.getAllChildren(id).map(child => child.id)
    const idsToRemove = [id, ...childrenIds]
    
    this.items = this.items.filter(item => !idsToRemove.includes(item.id))
    this.buildMap()
    this.buildChildrenCache()
  }

  updateItem(updatedItem: TreeItem): void {
    const index = this.items.findIndex(item => item.id === updatedItem.id)
    if (index !== -1) {
      this.items[index] = { ...updatedItem }
      this.itemsMap.set(updatedItem.id, updatedItem)
      this.buildChildrenCache()
    } else {
      console.warn(`Item with id ${updatedItem.id} not found`)
    }
  }
}