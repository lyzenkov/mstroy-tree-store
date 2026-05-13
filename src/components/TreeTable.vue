<template>
  <div class="tree-table">
    <div class="toolbar">
      <button @click="handleAddAsChild" :disabled="!selectedId">Добавить в выделенный</button>
      <button @click="handleAddAsRoot">Добавить в корень</button>
      <button @click="handleRemove" :disabled="!selectedId">Удалить</button>
      <button @click="handleUpdate" :disabled="!selectedId">Изменить</button>
    </div>

    <ag-grid-vue
      :theme="gridTheme"
      :columnDefs="columnDefs"
      :rowData="rowDataForGrid"
      :treeData="true"
      :getDataPath="getDataPath"
      :autoGroupColumnDef="autoGroupColumnDef"
      :groupDefaultExpanded="groupDefaultExpanded"
      @grid-ready="onGridReady"
      @cell-clicked="onCellClicked"
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
import type { 
  ColDef, 
  AutoGroupColumnDef, 
  ValueGetterFunc, 
  GridApi, 
  CellClickedEvent, 
  Column,
  GridReadyEvent
} from 'ag-grid-community'

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
  const result: TreeItemWithPath[] = []
  
  // Первый проход: создаем все объекты
  items.forEach(item => {
    const itemWithPath = { ...item, path: [] as string[] }
    itemMap.set(item.id, itemWithPath)
    result.push(itemWithPath)
  })
  
  // Второй проход: вычисляем пути, используя кэш
  const pathCache = new Map<string | number, string[]>()
  
  function getPath(item: TreeItemWithPath): string[] {
    if (pathCache.has(item.id)) return pathCache.get(item.id)!
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

// Функция для проверки, есть ли у элемента дети
function hasChildren(id: string | number): boolean {
  return store.getChildren(id).length > 0
}

// Создаём хранилище
const store = new TreeStore(initialData)

// Состояния
const selectedId = ref<string | number | null>(null)
const gridTheme = ref<Theme>(themeQuartz)
const gridApi = ref<GridApi<TreeItemWithPath> | null>(null)

// Value getter для порядкового номера
const rowNumberValueGetter: ValueGetterFunc<TreeItemWithPath> = (params): number | string => {
  const node = params.node
  if (node && typeof node.rowIndex === 'number') {
    return node.rowIndex + 1
  }
  return '—'
}

// Использовать computed для производных данных
const hasChildrenCache = computed(() => {
  const cache = new Map<string | number, boolean>()
  store.getAll().forEach(item => {
    cache.set(item.id, store.getChildren(item.id).length > 0)
  })
  return cache
})

// Value getter для категории (вычисляемое поле)
const categoryValueGetter: ValueGetterFunc<TreeItemWithPath> = (params): string => {
  const id = params.data?.id
  if (id === undefined) return '—'
  return hasChildrenCache.value.get(id) ? 'Группа' : 'Элемент'
}

// Cell style для категории
const categoryCellStyle = (params: { data: TreeItemWithPath | undefined }): { [key: string]: string | number } | undefined => {
  const id = params.data?.id
  if (id !== undefined && hasChildren(id)) {
    return { fontWeight: 'bold' }
  }
  return undefined
}

// Настройка обычных колонок AG Grid
const columnDefs = ref<ColDef<TreeItemWithPath>[]>([
  { 
    headerName: '№ п/п',
    flex: 0.5,
    valueGetter: rowNumberValueGetter,
    cellStyle: { textAlign: 'end' }
  },
  { 
    field: 'label', 
    headerName: 'Наименование',
    flex: 2
  }
])

// Настройка авто-группировки (колонка иерархии с категорией)
const autoGroupColumnDef = ref<AutoGroupColumnDef<TreeItemWithPath>>({
  headerName: 'Категория',
  minWidth: 150,
  flex: 1,
  valueGetter: categoryValueGetter,
  cellStyle: categoryCellStyle,
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

// Обработчик готовности сетки - здесь перемещаем столбцы в нужном порядке
const onGridReady = (params: GridReadyEvent<TreeItemWithPath>): void => {
  gridApi.value = params.api;

  setTimeout(() => {
    const api = params.api;
    const allColumns: Column[] = api.getColumns() || [];

    // Находим колонки по их заголовкам или id
    const rowNumberCol = allColumns.find(col => col.getColDef().headerName === '№ п/п');
    const categoryCol = allColumns.find(col => col.getColId() === 'ag-Grid-AutoColumn');
    const nameCol = allColumns.find(col => col.getColDef().field === 'label');

    // Перемещаем: № п/п -> 0, Категория -> 1, Наименование -> 2
    if (rowNumberCol) api.moveColumns([rowNumberCol], 0);
    if (categoryCol) api.moveColumns([categoryCol], 1);
    if (nameCol) api.moveColumns([nameCol], 2);
  }, 100);
};

// Обработчик клика по ячейке для выделения строки
const onCellClicked = (event: CellClickedEvent<TreeItemWithPath>): void => {
  if (event.data) {
    if (gridApi.value) {
      gridApi.value.deselectAll();
    }
    const rowNode = event.node;
    if (rowNode) {
      rowNode.setSelected(true);
      selectedId.value = event.data.id;
    }
  }
};

// Обновление данных сетки
function updateGridData(): void {
  const allItems = store.getAll();
  rowDataForGrid.value = buildDataWithPath(allItems);
  
  setTimeout(() => {
    if (gridApi.value && selectedId.value !== null) {
      const rowNode = gridApi.value.getRowNode(String(selectedId.value));
      if (rowNode) rowNode.setSelected(true);
    }
  }, 50);
}

// Добавление элемента как дочернего к выделенному
const handleAddAsChild = (): void => {
  if (!selectedId.value) {
    alert('Сначала выберите родительский элемент (кликните по строке)');
    return;
  }
  const newId = Date.now();
  const newItem: TreeItem = {
    id: newId,
    parent: selectedId.value,
    label: `Новый элемент ${newId}`
  };
  store.addItem(newItem);
  updateGridData();
  
  setTimeout(() => {
    if (gridApi.value) {
      const parentNode = gridApi.value.getRowNode(String(selectedId.value));
      if (parentNode && !parentNode.expanded) parentNode.setExpanded(true);
    }
  }, 50);
  selectedId.value = newId;
};

// Добавление элемента в корень
const handleAddAsRoot = (): void => {
  const newId = Date.now();
  const newItem: TreeItem = {
    id: newId,
    parent: null,
    label: `Новый элемент ${newId}`
  };
  store.addItem(newItem);
  updateGridData();
  selectedId.value = newId;
};

const handleRemove = (): void => {
  if (selectedId.value && confirm('Удалить элемент и всех его потомков?')) {
    store.removeItem(selectedId.value);
    updateGridData();
    selectedId.value = null;
  }
};

const handleUpdate = (): void => {
  if (selectedId.value) {
    const item = store.getItem(selectedId.value);
    if (item) {
      const newLabel = prompt('Введите новое название:', item.label);
      if (newLabel && newLabel.trim()) {
        const updatedItem: TreeItem = { ...item, label: newLabel.trim() };
        store.updateItem(updatedItem);
        updateGridData();
      }
    }
  }
};

// Преобразованные данные для AG Grid
const rowDataForGrid = ref<TreeItemWithPath[]>(buildDataWithPath(initialData));

// Экспортируем методы и свойства для тестов
defineExpose({
  store,
  selectedId,
  hasChildrenCache,
  categoryValueGetter,
  rowNumberValueGetter,
  updateGridData,
  handleAddAsChild,
  handleAddAsRoot,
  handleRemove,
  handleUpdate
});
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
</style>