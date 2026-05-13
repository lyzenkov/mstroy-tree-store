export interface TreeItem {
  id: string | number
  parent: string | number | null
  label: string
}

export interface ITreeStore {
  getAll(): TreeItem[]
  getItem(id: string | number): TreeItem | undefined
  getChildren(id: string | number): TreeItem[]
  getAllChildren(id: string | number): TreeItem[]
  getAllParents(id: string | number): TreeItem[]
  addItem(item: TreeItem): void
  removeItem(id: string | number): void
  updateItem(item: TreeItem): void
}