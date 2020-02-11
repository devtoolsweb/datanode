import { ClassName } from '@aperos/essentials'
import { DataNode, IDataNode, IDataNodeEvent } from '../data_node'
import { DataNodeLink } from '../data_node_link'
import { DataNodeBehavior, IDataNodeBehavior, IDataNodeBehaviorOpts } from './data_node_behavior'

export interface IItemContainerBehavior extends IDataNodeBehavior {}

export interface IItemContainerBehaviorOpts extends IDataNodeBehaviorOpts {}

const selectionsMap = new WeakMap<IDataNode, IDataNode>()

@ClassName('ItemContainerBehavior')
export class ItemContainerBehavior extends DataNodeBehavior implements IItemContainerBehavior {
  protected prevIndex!: number

  initBehavior() {
    const { dnIndex, dnItems } = this
    const index = dnIndex.getInt()
    this.prevIndex = index

    const selectionChangeListener = (event: IDataNodeEvent) => {
      let index = -1
      if (event.node.value) {
        this.dnItems.enumChildren((x, i) => {
          let s = selectionsMap.get(x)
          if (s && (s.isLink ? (s as DataNodeLink).target : s) === event.node) {
            index = i as number
            return 'Leave'
          }
          return
        })
      }
      this.updateIndex(index)
    }

    this.performUpdates(() => {
      dnItems.enumChildren((c, i) => {
        const s = this.getSelection(c)!
        if (!selectionsMap.has(c)) {
          selectionsMap.set(c, s)
        }
        s.on('change', selectionChangeListener)
        if (!s.isLink) {
          s.value = index === i
        }
      })
    })

    dnIndex.on('change', () => {
      this.updateIndex(dnIndex.getInt())
    })

    dnItems
      .on('addChild', event => {
        const s = this.getSelection(event.child!)!
        selectionsMap.set(event.child as IDataNode, s)
        s.on('change', selectionChangeListener)
      })
      .on('removeChild', event => {
        const cn = event.child!
        const s = selectionsMap.get(cn)!
        selectionsMap.delete(cn)
        if (cn.parent === dnItems && s.value) {
          this.updateIndex(dnItems.childCount > 0 ? Math.max(0, cn.childIndex - 1) : -1)
        }
        s.off('change', selectionChangeListener)
      })
  }

  protected get dnIndex() {
    return this.dataNode.getNodeByPath('index')!
  }

  protected get dnItems() {
    return this.dataNode.getNodeByPath('items')!
  }

  protected getSelection(x: number | IDataNode) {
    let s
    const c = x instanceof DataNode ? x : this.dnItems.getChildAt(x as number)!
    if (c) {
      s = c.getNodeByPath('selected')
      if (!s) {
        s = new DataNode({ name: 'selected' })
        c.addChild(s)
      }
    }
    return s
  }

  protected updateIndex(i: number) {
    this.performUpdates(() => {
      if (!this.dnItems.childCount) {
        this.prevIndex = -1
        return
      }
      const p = this.prevIndex
      if (i !== p) {
        this.dnIndex.value = i
        if (p >= 0) {
          const s = this.getSelection(p)
          /* WARNING: Don't change this behavior */
          if (s && s.value !== false) {
            s.value = false
          }
        }
        if (i >= 0) {
          const s = this.getSelection(i)
          /* WARNING: Don't change this behavior */
          s && (s.value = true)
        }
        this.prevIndex = i
      }
    })
  }

  static get requiredPaths() {
    return super.requiredPaths.concat(['index', 'items'])
  }
}
