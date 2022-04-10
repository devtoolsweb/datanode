import { DataNode, DataNodeLink, IDataNode } from '../lib'

test('create', () => {
    const parent = new DataNode({ name: 'root' })
    const value = 12345
    const target = new DataNode({
        name: 'target',
        value
    })
    const link1 = new DataNodeLink({ target })
    const link2 = new DataNodeLink({
        name: 'link',
        target
    })
    parent.addSuccessorNode('a/b/c', target)
    parent.addSuccessorNode('x/y/z', link1)
    parent.addSuccessorNode('x/y/z', link2)
    expect(link1.realPath).toBe(target.fullPath)
    link1.addChild(new DataNode({ name: 'test' }))
    expect(link1.getInt()).toBe(value)
    expect(link2.getInt()).toBe(value)
})

test('childIndex', () => {
    const root = new DataNode({ name: 'root' })
    const list = root.makePath('list')
    for (let i = 0; i < 10; i++) {
        list.makePath(`item ${i}`)
    }
    const links = root.makePath('links')
  ;[ 1, 3, 5 ].forEach(k => {
        const target = list.getChildAt(k) as IDataNode
        links.addChild(new DataNodeLink({
            name: `linked item ${k}`,
            target
        }))
    })
    links.enumChildren((c, i) => {
        expect(c.childIndex).toBe(i)
    })
})
