import { DataNode } from '../lib'

test('create', () => {
  expect(() => new DataNode({ name: './' })).toThrow(Error)
})

test('makePath', () => {
  const parent = new DataNode({ name: 'root' })
  // parent.makePath('hello')
  parent.makePath('x/y/z')
  // expect(() => parent.makePath('x/y/')).toThrow(Error)
  // expect(() => parent.makePath(' path_enclosed_in_spaces ')).toThrow(Error)
  parent.makePath('x/y/abc')
  parent.makePath('x/y/1')
  parent.makePath('x/y/../../100/200/300')
  parent.makePath('x/y/1/2/Name With Spaces')!.value = 100
  parent.makePath('a/b/c')

  // console.log(parent.toString())
  // console.log(parent.getNodeByPath('x/y')!.toString())
  parent.releaseTree()
})

test('create', () => {
  const node = new DataNode({ value: '100', name: 'node' })
  const value = 123
  node.on('change', event => expect(event.node.getInt()).toBe(value))
  node.value = value
})

test('addChild', () => {
  const parent = new DataNode({ name: 'parent' })
  let n: number = 0
  parent.on('addChild', event => {
    if (event.child!.getInt() > 0) {
      n++
    }
  })
  parent.addChild(new DataNode({ value: '0', name: 'child 1' }))
  parent.addChild(new DataNode({ value: '1', name: 'child 2' }))
  parent.addChild(new DataNode({ value: '2', name: 'child 3' }))
  expect(n).toBe(2)
})

test('removeChild', () => {
  const parent = new DataNode({ name: 'parent' })
  const n = 10
  for (let i = 0; i < n; i++) {
    parent.addChild(new DataNode({ value: i, name: `child ${i}` }))
  }
  let c = parent.getChildAt(5)!
  expect(c.value).toBe(5)
  parent.removeChild(c)
  c = parent.getChildAt(5)!
  expect(c.value).toBe(6)
})

test('addSuccessorNode', () => {
  const parent = new DataNode({ name: 'parent' })
  parent.addSuccessorNode('a/b/c', new DataNode({ name: 'successor 1' }))
  parent.addSuccessorNode('x/y/z', new DataNode({ name: 'successor 2' }))
  expect(() =>
    parent.addSuccessorNode('/s2', new DataNode({ name: 'successor 3' }))
  ).toThrow(Error)
  expect(() =>
    parent.addSuccessorNode('../s3', new DataNode({ name: 'successor 4' }))
  ).toThrow(Error)
})

test('findChildNode', () => {
  const parent = new DataNode({ name: 'root' })
  parent.makePath('apple')
  parent.makePath('banana')
  parent.makePath('orange')
  expect(parent.findChildNode('grape')).toBeNull()
  expect(parent.findChildNode('orange')).not.toBeNull()
})

test('emitEvent', async () => {
  const parent = new DataNode({ name: 'root', isEventTrap: true })
  const path = 'a/b/c'
  parent.makePath(path)

  let n = 0
  const p = Promise.all([
    new Promise(resolve => {
      parent.on('change', () => {
        n++
        resolve()
      })
    }),
    new Promise(resolve => {
      parent.getNodeByPath(path)!.on('change', () => {
        n++
        resolve()
      })
    })
  ])
  parent.getNodeByPath(path)!.value = 123
  await p
  expect(n).toBe(2)
})
