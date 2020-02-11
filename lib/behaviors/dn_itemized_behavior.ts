import { IBitFlags, Memoize } from '@aperos/ts-goodies'
import { ClassName } from '@aperos/essentials'
import { IDataNode, IDataNodeEvent } from '../data_node'
import {
  DataNodeBehavior,
  DataNodeBehaviorFlags,
  IDataNodeBehavior,
  IDataNodeBehaviorOpts
} from './data_node_behavior'

export interface IDnItemizedBehavior extends IDataNodeBehavior {
  readonly allowMultiSelect: boolean
  readonly dnIndex: IDataNode
  readonly dnItems: IDataNode
  readonly firstSelectedIndex: number
  readonly roundRobin: boolean
  readonly selectedCount: number
  unselectAll(): this
}

export interface IDnItemizedBehaviorOpts extends IDataNodeBehaviorOpts {
  allowMultiSelect?: boolean
  roundRobin?: boolean
  index?: number
}

export type DnItemizedBehaviorFlags = 'AllowMultiSelect' | 'RoundRobin' | DataNodeBehaviorFlags

type EssentialChildren = 'dnIndex' | 'dnItems'

@ClassName('DnItemizedBehavior')
export class DnItemizedBehavior extends DataNodeBehavior implements IDnItemizedBehavior {
  readonly flags!: IBitFlags<DnItemizedBehaviorFlags>

  constructor(opts: IDnItemizedBehaviorOpts) {
    super(opts)
  }

  get allowMultiSelect() {
    return !!this.flags.isSet('AllowMultiSelect')
  }

  get firstSelectedIndex() {
    return this.dnIndex.getInt()
  }

  get dnIndex() {
    return this.essentials['dnIndex']!
  }

  get dnItems() {
    return this.essentials['dnItems']!
  }

  get roundRobin() {
    return this.flags.isSet('RoundRobin')
  }

  get selectedCount() {
    return this.selectedItems.size
  }

  unselectAll() {
    const { selectedItems: xs, selectionsMap: sm } = this
    xs.forEach(x => {
      const s = sm.get(x)!
      s.value = false
    })
    return this
  }

  @Memoize()
  protected get essentials() {
    return {} as Partial<Record<EssentialChildren, IDataNode>>
  }

  @Memoize()
  protected get selectionChangeListener() {
    return (event: IDataNodeEvent) => {
      const s = event.node
      const p = s.parent!
      this.performUpdates(() => {
        if (s.value) {
          this.selectItem(p)
        } else {
          this.unselectItem(p)
        }
      })
    }
  }

  @Memoize()
  protected get selectedItems() {
    return new Set<IDataNode>()
  }

  protected initBehavior(opts: IDnItemizedBehaviorOpts) {
    const { dataNode: dn, essentials: cn } = this
    cn.dnIndex = dn.makePath('index')!
    cn.dnItems = dn.makePath('items')!

    const { dnIndex, dnItems, flags, selectionsMap: sm } = this
    flags.setFlagValue('AllowMultiSelect', !!opts.allowMultiSelect)
    flags.setFlagValue('RoundRobin', !!opts.roundRobin)

    this.performUpdates(() => {
      dnItems.enumChildren(c => {
        this.initItem(c)
      })
      const i = opts.index
      this.applyIndex(i === undefined ? -1 : i)
    })

    dnIndex.on('change', () => {
      this.applyIndex(dnIndex.getInt())
    })

    dnItems
      .on('addChild', event => {
        const c = event.child!
        this.initItem(c)
        const s = sm.get(c)!
        s.on('change', this.selectionChangeListener)
      })
      .on('removeChild', event => {
        const c = event.child!
        const s = sm.get(c)!
        sm.delete(c)
        if (c.parent === dnItems && s.value) {
          this.applyIndex(dnItems.childCount > 0 ? Math.max(0, c.childIndex - 1) : -1)
        }
        s.off('change', this.selectionChangeListener)
      })
  }

  protected initItem(item: IDataNode, selected = false) {
    const { selectionsMap: sm } = this
    const s = item.makePath('selected')!
    if (!sm.has(item)) {
      sm.set(item, s)
    }
    s.value = selected
    s.on('change', this.selectionChangeListener)
  }

  protected selectItem(item: IDataNode) {
    const { selectedItems: xs, selectionsMap: sm } = this
    xs.add(item)
    if (!this.allowMultiSelect) {
      xs.forEach(x => {
        if (x !== item) {
          const s = sm.get(x)!
          s.value = false
        }
      })
    }
    this.setFirstSelectedIndex()
  }

  protected setFirstSelectedIndex() {
    const { dnIndex, dnItems, selectionsMap: sm } = this
    let index = -1
    dnItems.enumChildren((c, i) => {
      const s = sm.get(c)!
      if (s.value) {
        index = i!
        return 'Leave'
      }
      return
    })
    if (index !== dnIndex.value) {
      dnIndex.value = index
    }
  }

  protected unselectItem(item: IDataNode) {
    const { selectedItems: xs } = this
    xs.delete(item)
    this.setFirstSelectedIndex()
  }

  protected applyIndex(index: number) {
    const {
      allowMultiSelect: ms,
      dnIndex,
      dnItems,
      roundRobin: rr,
      selectedItems: xs,
      selectionsMap: sm
    } = this
    const n = rr ? index % dnItems.childCount : index
    dnIndex.value = n
    if (n < 0) {
      this.unselectAll()
    } else {
      let dn: IDataNode | null = null
      dnItems.enumChildren((c, i = 0) => {
        const s = sm.get(c)!
        if (i >= n) {
          dn = c
          s.value = true
          return 'Leave'
        } else {
          s.value = false
        }
        return
      })
      if (!ms) {
        xs.forEach(x => {
          if (x !== dn) {
            const s = sm.get(x)!
            s.value = false
          }
        })
      }
    }
  }

  private get selectionsMap() {
    return DnItemizedBehavior.selectionsMap
  }

  @Memoize()
  static get selectionsMap() {
    return new WeakMap<IDataNode, IDataNode>()
  }
}
