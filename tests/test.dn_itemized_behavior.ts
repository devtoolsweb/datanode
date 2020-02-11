import { DataNode, DnItemizedBehavior, IDataNode } from '../lib'

const getf = (dn: IDataNode, path: string) => {
  return dn.getNodeByPath(path)!
}

const countSelected = (dn: IDataNode) => {
  let n = 0
  getf(dn, 'items').enumChildren(c => {
    n += getf(c, 'selected').value ? 1 : 0
  })
  return n
}

const createList = () => {
  const list = new DataNode({ name: 'list' })
  for (let i = 0; i < 10; i++) {
    list.makePath(`items/item ${i}`)
  }
  return list
}

test('create', () => {
  const list = createList()
  const b = new DnItemizedBehavior({ dataNode: list })
  expect(b.allowMultiSelect).toBeFalsy()
  expect(b.firstSelectedIndex).toBe(-1)
  expect(b.roundRobin).toBeFalsy()
  expect(b.selectedCount).toBe(0)
  expect(countSelected(list)).toBe(0)
  expect(getf(list, 'index').value).toBe(-1)
  expect(() => new DnItemizedBehavior({ dataNode: list })).toThrowError()
})

test('apply behavior', () => {
  const list = createList()
  new DnItemizedBehavior({ dataNode: list })
  expect(getf(list, 'index').value).toBe(-1)
  getf(list, 'items').enumChildren(c => {
    expect(getf(c, 'selected').value).toBeFalsy()
  })
})

test('select item', () => {
  const list = createList()
  new DnItemizedBehavior({ dataNode: list })
  for (let i = 0; i < 100; i++) {
    const index = Math.trunc(Math.random() * list.childCount)
    let item = getf(list, `items/item ${index}/selected`)
    item.value = true
    expect(getf(list, 'index').value).toBe(index)
    expect(countSelected(list)).toBe(1)
  }
})

test('index', () => {
  const list = createList()
  new DnItemizedBehavior({ dataNode: list })
  for (let i = 0; i < 100; i++) {
    const index = Math.trunc(Math.random() * getf(list, 'items').childCount)
    getf(list, 'index').value = index
    expect(getf(list, 'index').value).toBe(index)
    expect(countSelected(list)).toBe(1)
  }
})

test('round robin', () => {
  const list = createList()
  new DnItemizedBehavior({ dataNode: list, roundRobin: true })
  const dnIndex = getf(list, 'index')
  for (let i = 0; i < 100; i++) {
    const index = Math.trunc(Math.random() * getf(list, 'items').childCount)
    dnIndex.value = getf(list, 'items').childCount + index
    expect(dnIndex.value).toBe(index)
    expect(countSelected(list)).toBe(1)
  }
})

test('multi select', () => {
  const list = createList()
  new DnItemizedBehavior({ allowMultiSelect: true, dataNode: list })
  const dnIndex = getf(list, 'index')
  const dnItems = getf(list, 'items')
  dnItems.enumChildren(c => {
    getf(c, 'selected').value = true
  })
  expect(dnIndex.value).toBe(0)
  expect(countSelected(list)).toBe(dnItems.childCount)
  dnIndex.value = 5
  expect(dnIndex.value).toBe(5)
  expect(countSelected(list)).toBe(5)
  getf(dnItems, 'item 9/selected').value = false
  expect(dnIndex.value).toBe(5)
  expect(countSelected(list)).toBe(4)
  for (let i = 5; i < dnItems.childCount; i++) {
    getf(dnItems, `item ${i}/selected`).value = false
  }
  expect(dnIndex.value).toBe(-1)
  expect(countSelected(list)).toBe(0)
})

test('remove item', () => {
  const list = createList()
  new DnItemizedBehavior({ dataNode: list })
  const dnIndex = getf(list, 'index')
  const dnItems = getf(list, 'items')
  ;[9, 5, 0].forEach(i => {
    dnIndex.value = i
    dnItems.removeChild(dnItems.getChildAt(i)!)
    expect(dnIndex.value).toBe(-1)
  })
})

test('remove item: keep selection', () => {
  const list = createList()
  new DnItemizedBehavior({ dataNode: list, keepSelection: true })
  const dnIndex = getf(list, 'index')
  const dnItems = getf(list, 'items')
  ;[9, 5, 0].forEach(i => {
    dnIndex.value = i
    dnItems.removeChild(dnItems.getChildAt(i)!)
    expect(dnIndex.value).toBe(Math.max(0, i - 1))
    expect(countSelected(list)).toBe(1)
  })
  while (dnItems.childCount > 1) {
    dnItems.removeChild(dnItems.firstChild!)
    expect(dnIndex.value).toBe(0)
  }
  dnItems.removeChild(dnItems.firstChild!)
  expect(dnIndex.value).toBe(-1)
})

test('remove item: multiple selections', () => {
  const list = createList()
  new DnItemizedBehavior({ allowMultiSelect: true, dataNode: list })
  const dnIndex = getf(list, 'index')
  const dnItems = getf(list, 'items')
  dnIndex.value = 5
  while (dnItems.childCount > 5) {
    dnItems.removeChild(dnItems.firstChild!)
  }
  expect(dnIndex.value).toBe(0)
  dnItems.removeChild(dnItems.firstChild!)
  expect(dnIndex.value).toBe(-1)
})
