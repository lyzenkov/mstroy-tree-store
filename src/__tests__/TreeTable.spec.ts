// tests/TreeTable.spec.ts
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import TreeTable from '@/components/TreeTable.vue'
import { TreeStore } from '@/stores/TreeStore'
import type { TreeItem } from '@/types/tree'

// Мокаем ag-grid-vue3
vi.mock('ag-grid-vue3', () => ({
  AgGridVue: {
    name: 'AgGridVue',
    template: '<div class="mock-ag-grid"></div>',
    props: ['theme', 'columnDefs', 'rowData', 'treeData', 'getDataPath', 'autoGroupColumnDef', 'groupDefaultExpanded']
  }
}))

// Мокаем модули AG Grid
vi.mock('ag-grid-community', () => ({
  ModuleRegistry: {
    registerModules: vi.fn()
  },
  themeQuartz: {}
}))

vi.mock('ag-grid-enterprise', () => ({
  TreeDataModule: {}
}))

// Тип для экспортируемых свойств компонента
type TreeTableInstance = {
  store: TreeStore
  selectedId: string | number | null
  hasChildrenCache: Map<string | number, boolean>
  categoryValueGetter: (params: { data: TreeItem }) => string
  rowNumberValueGetter: (params: { node: { rowIndex: number } }) => number | string
  updateGridData: () => void
  handleAddAsChild: () => void
  handleAddAsRoot: () => void
  handleRemove: () => void
  handleUpdate: () => void
}

describe('TreeTable', () => {
  let wrapper: VueWrapper<TreeTableInstance>

  beforeEach(() => {
    wrapper = mount(TreeTable) as VueWrapper<TreeTableInstance>
  })

  it('should render toolbar with buttons', () => {
    const buttons = wrapper.findAll('.toolbar button')
    expect(buttons).toHaveLength(4)
    expect(buttons[0]?.text()).toBe('Добавить в выделенный')
    expect(buttons[1]?.text()).toBe('Добавить в корень')
    expect(buttons[2]?.text()).toBe('Удалить')
    expect(buttons[3]?.text()).toBe('Изменить')
  })

  it('should disable buttons when no item selected', () => {
    const buttons = wrapper.findAll('.toolbar button')
    // Добавить в выделенный - disabled
    expect(buttons[0]?.attributes('disabled')).toBe('')
    // Удалить - disabled
    expect(buttons[2]?.attributes('disabled')).toBe('')
    // Изменить - disabled
    expect(buttons[3]?.attributes('disabled')).toBe('')
    // Добавить в корень - не disabled (атрибут отсутствует)
    expect(buttons[1]?.attributes('disabled')).toBeUndefined()
  })

  it('should render ag-grid component', () => {
    expect(wrapper.findComponent({ name: 'AgGridVue' }).exists()).toBe(true)
  })

  it('should have correct initial data', () => {
    const store = wrapper.vm.store
    expect(store.getAll()).toHaveLength(8)
  })

  it('should handle add as root', async () => {
    const store = wrapper.vm.store
    const originalLength = store.getAll().length
    
    // Находим кнопку "Добавить в корень" и кликаем
    const addRootBtn = wrapper.findAll('.toolbar button')[1]
    if (addRootBtn) {
      await addRootBtn.trigger('click')
    }
    
    // Проверяем, что добавился новый элемент
    expect(store.getAll().length).toBe(originalLength + 1)
    
    // Проверяем, что новый элемент выделен
    expect(wrapper.vm.selectedId).not.toBeNull()
  })

  it('should enable add as child when item selected', async () => {
    // Симулируем выбор элемента
    wrapper.vm.selectedId = 1
    await wrapper.vm.$nextTick()
    
    const addChildBtn = wrapper.findAll('.toolbar button')[0]
    // Теперь кнопка должна быть активна (без атрибута disabled)
    expect(addChildBtn?.attributes('disabled')).toBeUndefined()
  })

  it('should confirm before remove', async () => {
    const confirmSpy: Mock = vi.spyOn(window, 'confirm')
    confirmSpy.mockReturnValue(true)
    
    wrapper.vm.selectedId = 1
    const removeBtn = wrapper.findAll('.toolbar button')[2]
    if (removeBtn) {
      await removeBtn.trigger('click')
    }
    
    expect(confirmSpy).toHaveBeenCalledWith('Удалить элемент и всех его потомков?')
    
    confirmSpy.mockRestore()
  })

  it('should not remove if cancelled', async () => {
    const confirmSpy: Mock = vi.spyOn(window, 'confirm')
    confirmSpy.mockReturnValue(false)
    
    const store = wrapper.vm.store
    const originalLength = store.getAll().length
    wrapper.vm.selectedId = 1
    
    const removeBtn = wrapper.findAll('.toolbar button')[2]
    if (removeBtn) {
      await removeBtn.trigger('click')
    }
    
    expect(store.getAll().length).toBe(originalLength)
    
    confirmSpy.mockRestore()
  })

  it('should handle update item', async () => {
    const promptSpy: Mock = vi.spyOn(window, 'prompt')
    promptSpy.mockReturnValue('Updated Label')
    
    wrapper.vm.selectedId = 1
    const updateBtn = wrapper.findAll('.toolbar button')[3]
    if (updateBtn) {
      await updateBtn.trigger('click')
    }
    
    const store = wrapper.vm.store
    const updatedItem = store.getItem(1)
    expect(updatedItem?.label).toBe('Updated Label')
    
    promptSpy.mockRestore()
  })

  it('should not update if prompt cancelled', async () => {
    const promptSpy: Mock = vi.spyOn(window, 'prompt')
    promptSpy.mockReturnValue(null)
    
    const store = wrapper.vm.store
    const originalItem = store.getItem(1)
    wrapper.vm.selectedId = 1
    
    const updateBtn = wrapper.findAll('.toolbar button')[3]
    if (updateBtn) {
      await updateBtn.trigger('click')
    }
    
    const currentItem = store.getItem(1)
    expect(currentItem?.label).toBe(originalItem?.label)
    
    promptSpy.mockRestore()
  })

  it('should have hasChildrenCache computed property', () => {
    const cache = wrapper.vm.hasChildrenCache
    expect(cache).toBeInstanceOf(Map)
    
    // Проверяем, что у элемента 1 есть дети
    expect(cache.get(1)).toBe(true)
    
    // Проверяем, что у элемента 8 нет детей
    expect(cache.get(8)).toBe(false)
  })

  it('should have categoryValueGetter function', () => {
    const params = {
      data: { id: 1, label: 'Test', parent: null } as TreeItem
    }
    
    const result = wrapper.vm.categoryValueGetter(params)
    expect(result).toBe('Группа')
  })

  it('should have rowNumberValueGetter function', () => {
    const params = {
      node: { rowIndex: 5 }
    }
    
    const result = wrapper.vm.rowNumberValueGetter(params)
    expect(result).toBe(6)
  })

  it('should enable buttons after row selection', async () => {
    // Изначально все кнопки (кроме корня) disabled
    let buttons = wrapper.findAll('.toolbar button')
    expect(buttons[0]?.attributes('disabled')).toBe('')
    expect(buttons[2]?.attributes('disabled')).toBe('')
    expect(buttons[3]?.attributes('disabled')).toBe('')
    
    // Симулируем выбор строки
    wrapper.vm.selectedId = 1
    await wrapper.vm.$nextTick()
    
    // После выбора кнопки должны стать активными
    buttons = wrapper.findAll('.toolbar button')
    expect(buttons[0]?.attributes('disabled')).toBeUndefined()
    expect(buttons[2]?.attributes('disabled')).toBeUndefined()
    expect(buttons[3]?.attributes('disabled')).toBeUndefined()
  })
})

describe('TreeTable Integration', () => {
  let wrapper: VueWrapper<TreeTableInstance>

  beforeEach(() => {
    wrapper = mount(TreeTable) as VueWrapper<TreeTableInstance>
  })

  it('should maintain tree structure after add and remove operations', async () => {
    const store = wrapper.vm.store
    
    // Изначально 8 элементов
    expect(store.getAll()).toHaveLength(8)
    
    // Добавляем корневой элемент
    const addRootBtn = wrapper.findAll('.toolbar button')[1]
    if (addRootBtn) {
      await addRootBtn.trigger('click')
    }
    await wrapper.vm.$nextTick()
    expect(store.getAll()).toHaveLength(9)
    
    const newRootId = wrapper.vm.selectedId
    
    // Добавляем дочерний элемент к новому корню
    if (newRootId) {
      wrapper.vm.selectedId = newRootId
      const addChildBtn = wrapper.findAll('.toolbar button')[0]
      if (addChildBtn) {
        await addChildBtn.trigger('click')
      }
      await wrapper.vm.$nextTick()
      expect(store.getAll()).toHaveLength(10)
      expect(store.getChildren(newRootId)).toHaveLength(1)
      
      // Удаляем новый корень (должен удалиться и дочерний)
      const removeBtn = wrapper.findAll('.toolbar button')[2]
      if (removeBtn) {
        await removeBtn.trigger('click')
      }
      await wrapper.vm.$nextTick()
      expect(store.getAll()).toHaveLength(8)
    }
  })

  it('should update grid data after each operation', async () => {
    const updateGridSpy: Mock = vi.spyOn(wrapper.vm, 'updateGridData')
    
    const addRootBtn = wrapper.findAll('.toolbar button')[1]
    if (addRootBtn) {
      await addRootBtn.trigger('click')
    }
    await wrapper.vm.$nextTick()
    expect(updateGridSpy).toHaveBeenCalled()
    
    updateGridSpy.mockRestore()
  })

  it('should expand parent after adding child', async () => {
    const store = wrapper.vm.store
    const parentId = 1
    
    // Выбираем родителя
    wrapper.vm.selectedId = parentId
    await wrapper.vm.$nextTick()
    
    // Добавляем дочерний элемент
    const addChildBtn = wrapper.findAll('.toolbar button')[0]
    if (addChildBtn) {
      await addChildBtn.trigger('click')
    }
    await wrapper.vm.$nextTick()
    
    // Проверяем, что дочерний элемент добавлен
    const children = store.getChildren(parentId)
    expect(children.length).toBeGreaterThan(0)
  })
})