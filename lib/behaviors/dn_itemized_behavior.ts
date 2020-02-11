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
  keepSelection?: boolean
  roundRobin?: boolean
  index?: number
}

export type DnItemizedBehaviorFlags =
  | 'AllowMultiSelect'
  | 'KeepSelection'
  | 'RoundRobin'
  | DataNodeBehaviorFlags

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

  protected get keepSelection() {
    return this.flags.isSet('KeepSelection')
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

  protected findFirstSelectedIndex() {
    const { dnItems, selectionsMap: sm } = this
    let index = -1
    dnItems.enumChildren((c, i) => {
      const s = sm.get(c)!
      if (s.value) {
        index = i!
        return 'Leave'
      }
      return
    })
    return index
  }

  protected initBehavior(opts: IDnItemizedBehaviorOpts) {
    if (opts.allowMultiSelect && opts.keepSelection) {
      throw new Error(
        `DN0024: Parameters 'allowMultiSelect' and 'keepSelection' can't be used simultaneously`
      )
    }

    const { dataNode: dn, essentials: cn } = this
    cn.dnIndex = dn.makePath('index')!
    cn.dnItems = dn.makePath('items')!

    const { dnIndex, dnItems, flags, selectionsMap: sm } = this
    flags.setFlagValue('AllowMultiSelect', !!opts.allowMultiSelect)
    flags.setFlagValue('KeepSelection', !!opts.keepSelection)
    flags.setFlagValue('RoundRobin', !!opts.roundRobin)

    this.performUpdates(() => {
      dnItems.enumChildren(c => {
        this.initItem(c)
      })
      const i = opts.index
      this.applyIndex(i === undefined ? dnIndex.getInt() : i)
    })

    dnIndex.on('change', () => {
      if (!this.isUpdating) {
        this.applyIndex(dnIndex.getInt())
      }
    })

    dnItems
      .on('addChild', event => {
        const c = event.child!
        this.initItem(c)
        const s = sm.get(c)!
        s.on('change', this.selectionChangeListener)
      })
      .on('removeChild', event => {
        this.performUpdates(() => this.releaseItem(event.child!))
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

  protected releaseItem(item: IDataNode) {
    const { dnIndex, dnItems, selectionsMap: sm } = this
    const s = sm.get(item)!
    s.off('change', this.selectionChangeListener)

    const i = dnIndex.getInt()
    const n = dnItems.childCount
    const ci = item.childIndex
    let index = i
    this.unselectItem(item, true)
    this.selectedItems.delete(item)
    const f = this.findFirstSelectedIndex()
    if (this.allowMultiSelect) {
      if (f > ci) {
        index = i === n ? -1 : f - 1
      } else if (f < 0) {
        index = -1
      }
    } else if (this.keepSelection) {
      if (n > 1) {
        index = Math.max(0, i - 1)
        const next = index < n - 1 ? index : index - 1
        this.selectItem(dnItems.getChildAt(next === 0 ? 1 : next)!, true)
      } else {
        index = -1
      }
    } else {
      index = -1
    }
    if (index !== i) {
      dnIndex.value = index
    }
    sm.delete(item)
  }

  protected selectItem(item: IDataNode, standalone = false) {
    const { selectedItems: xs, selectionsMap: sm } = this
    sm.get(item)!.value = true
    xs.add(item)
    if (!standalone) {
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
  }

  protected setFirstSelectedIndex() {
    const { dnIndex } = this
    const index = this.findFirstSelectedIndex()
    if (index !== dnIndex.value) {
      dnIndex.value = index
    }
  }

  protected unselectItem(item: IDataNode, standalone = false) {
    const { selectedItems: xs, selectionsMap: sm } = this
    sm.get(item)!.value = false
    xs.delete(item)
    if (!standalone) {
      this.setFirstSelectedIndex()
    }
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
