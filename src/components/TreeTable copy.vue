<template>
  <div class="tree-table">
    <div class="toolbar">
      <button @click="handleAdd">➕ Добавить</button>
      <button @click="handleRemove" :disabled="!selectedId">🗑️ Удалить</button>
      <button @click="handleUpdate" :disabled="!selectedId">✏️ Обновить</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>№ п/п</th>
          <th>ID</th>
          <th>Название</th>
          <th>Parent</th>
          <th>Категория</th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="item in flattenedData" 
          :key="item.id"
          :class="{ 'selected': selectedId === item.id, 'group': item.category === 'Группа' }"
          @click="selectedId = item.id"
        >
          <td>{{ item.rowNumber }}</td>
          <td>{{ item.id }}</td>
          <td>
            <div :style="{ paddingLeft: (item.level * 20) + 'px' }">
              <span v-if="item.hasChildren" class="expand-icon" @click.stop="toggleExpand(item.id)">
                {{ expandedIds.has(item.id) ? '▼' : '▶' }}
              </span>
              <span v-else class="expand-icon-placeholder"></span>
              {{ item.label }}
            </div>
          </td>
          <td>{{ item.parent !== null ? item.parent : '—' }}</td>
          <td>{{ item.category }}</td>
        </tr>
      </tbody>
    </table>

    <ag-grid-vue
      :theme="gridTheme"
      :columnDefs="columnDefs"
      :rowData="rowDataForGrid"
      :treeData="true"
      :getDataPath="getDataPath"
      :autoGroupColumnDef="autoGroupColumnDef"
      :groupDefaultExpanded="groupDefaultExpanded"
      style="height: 500px; margin-top: 20px;"
    >
    </ag-grid-vue>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { AgGridVue } from "ag-grid-vue3"
import { themeQuartz, type Theme } from 'ag-grid-community'
import { ModuleRegistry } from 'ag-grid-community'
import { TreeDataModule } from 'ag-grid-enterprise'
import type { ColDef, AutoGroupColumnDef, ValueFormatterFunc } from 'ag-grid-community'

import { TreeStore } from '@/stores/TreeStore'
import type { TreeItem } from '@/types/tree'

// Регистрируем модуль для работы с деревом
ModuleRegistry.registerModules([TreeDataModule])

// Расширенный тип для данных с path
interface TreeItemWithPath extends TreeItem {
  path: string[]
}

interface FlattenedItem extends TreeItem {
  level: number
  hasChildren: boolean
  category: string
  rowNumber: number
}

// Начальные данные
const initialData: TreeItem[] = [
  { id: 1, parent: null, label: 'Айтем 1' },
  { id: '91064cee', parent: 1, label: 'Айтем 2' },
  { id: 3, parent: 1, label: 'Айтем 3' },
  { id: 4, parent: '91064cee', label: 'Айтем 4' },
  { id: 5, parent: '91064cee', label: 'Айтем 5' },
  { id: 6, parent: '91064cee', label: 'Айтем 6' },
  { id: 7, parent: 4, label: 'Айтем 7' },
  { id: 8, parent: 4, label: 'Айтем 8' }
]

// Функция для преобразования плоских данных в формат с path
function buildDataWithPath(items: TreeItem[]): TreeItemWithPath[] {
  // Создаём карту для быстрого доступа к элементам
  const itemMap = new Map<string | number, TreeItemWithPath>()
  
  // Сначала создаём все элементы с пустым path
  items.forEach(item => {
    itemMap.set(item.id, { ...item, path: [] })
  })
  
  // Функция для построения пути рекурсивно
  function buildPath(item: TreeItemWithPath): string[] {
    if (item.parent === null) {
      return [item.label]
    }
    
    const parent = itemMap.get(item.parent)
    if (parent) {
      const parentPath = parent.path.length > 0 
        ? parent.path 
        : buildPath(parent)
      return [...parentPath, item.label]
    }
    
    return [item.label]
  }
  
  // Строим пути для всех элементов
  const result: TreeItemWithPath[] = []
  items.forEach(item => {
    const itemWithPath = itemMap.get(item.id)
    if (itemWithPath) {
      itemWithPath.path = buildPath(itemWithPath)
      result.push(itemWithPath)
    }
  })
  
  return result
}

// Создаём хранилище
const store = new TreeStore(initialData)

// Состояния
const selectedId = ref<string | number | null>(null)
const expandedIds = ref<Set<string | number>>(new Set())
const gridTheme = ref<Theme>(themeQuartz)

// Value formatter для parent колонки
const parentValueFormatter: ValueFormatterFunc<TreeItemWithPath, string | number | null> = (params): string => {
  return params.value !== null ? String(params.value) : '—'
}

// Настройка колонок для AG Grid
const columnDefs = ref<ColDef<TreeItemWithPath>[]>([
    { 
    field: 'id', 
    headerName: '№ п\п', 
    flex: 1 
  },
  { 
    field: 'label', 
    headerName: 'Название',
    flex: 2
  },
  
  { 
    field: 'parent', 
    headerName: 'Parent', 
    flex: 1, 
    valueFormatter: parentValueFormatter
  }
])

// Настройка авто-группировки - явно указываем тип
const autoGroupColumnDef = ref<AutoGroupColumnDef<TreeItemWithPath>>({
  headerName: 'Иерархия',
  minWidth: 280,
  cellRendererParams: {
    suppressCount: true
  }
})

// Раскрываем все узлы по умолчанию (-1 = все)
const groupDefaultExpanded = ref<number>(-1)

// Функция получения пути для дерева
const getDataPath = (data: TreeItemWithPath): string[] => {
  return data.path
}

// Преобразованные данные для AG Grid
const rowDataForGrid = ref<TreeItemWithPath[]>(buildDataWithPath(initialData))

// Функция для обновления данных сетки после изменений в хранилище
function updateGridData(): void {
  const allItems = store.getAll()
  rowDataForGrid.value = buildDataWithPath(allItems)
}

// Остальные методы для работы с деревом
const getCategory = (item: TreeItem): string => {
  const children = store.getChildren(item.id)
  return children.length > 0 ? 'Группа' : 'Элемент'
}

const hasChildren = (id: string | number): boolean => {
  return store.getChildren(id).length > 0
}

const toggleExpand = (id: string | number): void => {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
  expandedIds.value = new Set(expandedIds.value)
}

const flattenedData = computed((): FlattenedItem[] => {
  const result: FlattenedItem[] = []
  let rowCounter = 0

  const addItem = (item: TreeItem, level: number): void => {
    rowCounter++
    result.push({
      ...item,
      level,
      hasChildren: hasChildren(item.id),
      category: getCategory(item),
      rowNumber: rowCounter
    })

    if (expandedIds.value.has(item.id)) {
      const children = store.getChildren(item.id)
      children.forEach(child => {
        addItem(child, level + 1)
      })
    }
  }

  const rootItems = store.getAll().filter(item => item.parent === null)
  rootItems.forEach(root => addItem(root, 0))

  return result
})

const handleAdd = (): void => {
  const newId = Date.now()
  const newItem: TreeItem = {
    id: newId,
    parent: selectedId.value !== null ? selectedId.value : null,
    label: `Новый элемент ${newId}`
  }
  store.addItem(newItem)
  updateGridData()
  
  if (selectedId.value) {
    expandedIds.value.add(selectedId.value)
    expandedIds.value = new Set(expandedIds.value)
  }
  
  selectedId.value = newId
}

const handleRemove = (): void => {
  if (selectedId.value && confirm('Удалить элемент и всех его потомков?')) {
    store.removeItem(selectedId.value)
    updateGridData()
    selectedId.value = null
  }
}

const handleUpdate = (): void => {
  if (selectedId.value) {
    const item = store.getItem(selectedId.value)
    if (item) {
      const newLabel = prompt('Введите новое название:', item.label)
      if (newLabel && newLabel.trim()) {
        const updatedItem: TreeItem = { ...item, label: newLabel.trim() }
        store.updateItem(updatedItem)
        updateGridData()
      }
    }
  }
}
</script>

<style scoped>
.tree-table {
  padding: 20px;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.toolbar button {
  padding: 8px 16px;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.toolbar button:hover:not(:disabled) {
  background-color: #33a06f;
}

.toolbar button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-family: Arial, sans-serif;
  margin-bottom: 20px;
}

.data-table th,
.data-table td {
  border: 1px solid #ddd;
  padding: 10px;
  text-align: left;
}

.data-table th {
  background-color: #f2f2f2;
  font-weight: bold;
}

.data-table tbody tr:hover {
  background-color: #f5f5f5;
  cursor: pointer;
}

.data-table tr.selected {
  background-color: #e3f2fd;
}

.data-table tr.group {
  font-weight: 500;
}

.expand-icon {
  display: inline-block;
  width: 16px;
  margin-right: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
}

.expand-icon-placeholder {
  display: inline-block;
  width: 24px;
  margin-right: 8px;
}
</style>