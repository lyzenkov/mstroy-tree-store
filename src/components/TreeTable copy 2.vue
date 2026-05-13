<template>
  <div class="tree-table">
    <div class="toolbar">
      <button @click="handleAdd">➕ Добавить</button>
      <button @click="handleRemove" :disabled="!selectedId">🗑️ Удалить</button>
      <button @click="handleUpdate" :disabled="!selectedId">✏️ Обновить</button>
    </div>

    <ag-grid-vue
      :theme="gridTheme"
      :columnDefs="columnDefs"
      :rowData="rowDataForGrid"
      :treeData="true"
      :getDataPath="getDataPath"
      :groupDefaultExpanded="groupDefaultExpanded"
      :autoGroupColumnDef="autoGroupColumnDef"
      @grid-ready="onGridReady"
      style="height: 500px; margin-top: 20px;"
    >
    </ag-grid-vue>
  </div>
</template>

<script setup lang="ts">
import { ref, h } from 'vue'
import { AgGridVue } from "ag-grid-vue3"
import { themeQuartz, type Theme } from 'ag-grid-community'
import { ModuleRegistry } from 'ag-grid-community'
import { TreeDataModule } from 'ag-grid-enterprise'
import type { ColDef, ValueGetterFunc, GridApi, ICellRendererParams } from 'ag-grid-community'

import { TreeStore } from '@/stores/TreeStore'
import type { TreeItem } from '@/types/tree'

// Регистрируем модуль для работы с деревом
ModuleRegistry.registerModules([TreeDataModule])

// Расширенный тип для данных с path
interface TreeItemWithPath extends TreeItem {
  path: string[]
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
  const itemMap = new Map<string | number, TreeItemWithPath>()
  
  items.forEach(item => {
    itemMap.set(item.id, { ...item, path: [] })
  })
  
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

// Функция для проверки, есть ли у элемента дети
/* function hasChildren(id: string | number): boolean {
  return store.getChildren(id).length > 0
} */

// Создаём хранилище
const store = new TreeStore(initialData)

// Состояния
const selectedId = ref<string | number | null>(null)
const gridTheme = ref<Theme>(themeQuartz)
const gridApi = ref<GridApi<TreeItemWithPath> | null>(null)

// Value formatter для parent колонки
/* const parentValueFormatter: ValueFormatterFunc<TreeItemWithPath, string | number | null> = (params): string => {
  return params.value !== null ? String(params.value) : '—'
} */

// Value getter для порядкового номера
const rowNumberValueGetter: ValueGetterFunc<TreeItemWithPath> = (params): number | string => {
  const node = params.node
  if (node && typeof node.rowIndex === 'number') {
    return node.rowIndex + 1
  }
  return '—'
}

// Кастомный компонент для рендеринга категории с иерархией
const CategoryRenderer = {
  name: 'CategoryRenderer',
  props: ['params'],
  setup(props: { params: ICellRendererParams<TreeItemWithPath> }) {
    const { params } = props
    const node = params.node
    const isGroup = node?.group === true
    const isExpanded = node?.expanded === true
    const level = node?.level || 0
    
    const toggleExpand = () => {
      if (node && isGroup) {
        node.setExpanded(!isExpanded)
        params.api.refreshCells({ force: true })
      }
    }
    
    return () => h('div', {
      style: {
        paddingLeft: `${level * 20}px`,
        display: 'flex',
        alignItems: 'center',
        height: '100%'
      }
    }, [
      isGroup ? h('span', {
        onClick: toggleExpand,
        style: {
          cursor: 'pointer',
          marginRight: '8px',
          width: '16px',
          display: 'inline-block',
          userSelect: 'none'
        }
      }, isExpanded ? '▼' : '▶') : h('span', {
        style: {
          width: '24px',
          display: 'inline-block'
        }
      }),
      h('span', {
        style: {
          fontWeight: isGroup ? 'bold' : 'normal'
        }
      }, isGroup ? 'Группа' : 'Элемент')
    ])
  }
}

// Настройка автоматической колонки иерархии (скрываем её полностью)
const autoGroupColumnDef = ref({
  headerName: '',
  minWidth: 0,
  maxWidth: 0,
  width: 0,
  hide: true,
  suppressColumnsToolPanel: true,
  resizable: false,
  sortable: false
})

// Настройка колонок для AG Grid
const columnDefs = ref<ColDef<TreeItemWithPath>[]>([
  { 
    headerName: '№ п/п',
    flex: 1,
    valueGetter: rowNumberValueGetter,
    cellStyle: { textAlign: 'center' }
  },
  { 
    headerName: 'Категория',
    flex: 1,
    cellRenderer: CategoryRenderer,
    cellStyle: { display: 'flex', alignItems: 'center' }
  },
  { 
    field: 'label', 
    headerName: 'Наименование',
    flex: 2
  },
/*   { 
    field: 'parent', 
    headerName: 'Parent', 
    flex: 1, 
    valueFormatter: parentValueFormatter
  } */
])

// Раскрываем все узлы по умолчанию (-1 = все)
const groupDefaultExpanded = ref<number>(-1)

// Функция получения пути для дерева
const getDataPath = (data: TreeItemWithPath): string[] => {
  return data.path
}

// Обработчик готовности сетки
const onGridReady = (params: { api: GridApi<TreeItemWithPath> }): void => {
  gridApi.value = params.api
}

// Обновление нумерации строк при изменении данных
function refreshRowNumbers(): void {
  if (gridApi.value) {
    gridApi.value.refreshCells({ force: true })
  }
}

// Преобразованные данные для AG Grid
const rowDataForGrid = ref<TreeItemWithPath[]>(buildDataWithPath(initialData))

// Функция для обновления данных сетки после изменений в хранилище
function updateGridData(): void {
  const allItems = store.getAll()
  rowDataForGrid.value = buildDataWithPath(allItems)
  setTimeout(() => refreshRowNumbers(), 50)
}

const handleAdd = (): void => {
  const newId = Date.now()
  const newItem: TreeItem = {
    id: newId,
    parent: selectedId.value !== null ? selectedId.value : null,
    label: `Новый элемент ${newId}`
  }
  store.addItem(newItem)
  updateGridData()
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

/* Переставляем колонки визуально через CSS Grid */
:deep(.ag-header-row) {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr 1fr !important;
}

:deep(.ag-header-cell[col-id="ag-Grid-AutoColumn"]) {
  display: none !important;
}

:deep(.ag-header-cell[col-id="0"]) {
  order: 0 !important;
}

:deep(.ag-header-cell[col-id="1"]) {
  order: 1 !important;
}

:deep(.ag-header-cell[col-id="label"]) {
  order: 2 !important;
}

:deep(.ag-header-cell[col-id="parent"]) {
  order: 3 !important;
}

/* Применяем тот же порядок к ячейкам */
:deep(.ag-row) {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr 1fr !important;
}

:deep(.ag-cell[col-id="ag-Grid-AutoColumn"]) {
  display: none !important;
}

:deep(.ag-cell[col-id="0"]) {
  order: 0 !important;
}

:deep(.ag-cell[col-id="1"]) {
  order: 1 !important;
}

:deep(.ag-cell[col-id="label"]) {
  order: 2 !important;
}

:deep(.ag-cell[col-id="parent"]) {
  order: 3 !important;
}
</style>