import { IBitFlags } from '@aperos/ts-goodies'
import { ClassName } from '@aperos/essentials'
import { IDataNode, IDataNodeEvent } from '../data_node'
import { IDataNodeLink } from '../data_node_link'
import {
  DataNodeBehavior,
  DataNodeBehaviorFlags,
  IDataNodeBehavior,
  IDataNodeBehaviorOpts
} from './data_node_behavior'

export interface IDnItemizedBehavior extends IDataNodeBehavior {
  readonly allowMultiselect: boolean
  readonly dnIndex: IDataNode
  readonly dnItems: IDataNode
  readonly roundRobin: boolean
}

export interface IDnItemizedBehaviorOpts extends IDataNodeBehaviorOpts {
  allowMultiselect?: boolean
  roundRobin?: boolean
}

export type DnItemizedBehaviorFlags = 'AllowMultiselect' | 'RoundRobin' | DataNodeBehaviorFlags

type EssentialChildren = 'dnIndex' | 'dnItems'

@ClassName('DnItemizedBehavior')
export class DnItemizedBehavior extends DataNodeBehavior implements IDnItemizedBehavior {
  private static readonly selectionsMap = new WeakMap<IDataNode, IDataNode>()
  readonly flags!: IBitFlags<DnItemizedBehaviorFlags>

  protected readonly essentials: Partial<Record<EssentialChildren, IDataNode>> = {}
  protected readonly selectedItems = new Set<IDataNode>()

  get allowMultiselect() {
    return this.flags.isSet('AllowMultiselect')
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

  protected readonly selectionChangeListener = (event: IDataNodeEvent) => {
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

  protected selectItem(item: IDataNode) {
    const { selectedItems: xs, selectionsMap: sm } = this
    xs.add(item)
    if (!this.allowMultiselect) {
      xs.forEach(x => {
        if (x !== item) {
          const s = sm.get(x)!
          s.value = false
        }
      })
    }
  }

  protected unselectItem(item: IDataNode) {}

  protected initBehavior(opts: IDnItemizedBehaviorOpts) {
    const { dataNode: dn, dnIndex, dnItems, flags, essentials: xs, selectionsMap: sm } = this
    flags.setFlag('AllowMultiselect', opts.allowMultiselect)
    flags.setFlag('RoundRobin', opts.roundRobin)

    xs.dnIndex = dn.makePath('index')!
    xs.dnItems = dn.makePath('items')!

    this.performUpdates(() => {
      dnIndex.enumChildren(c => {
        this.initItem(c)
      })
    })

    dnIndex.on('change', () => {
      this.updateIndex(dnIndex.getInt())
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
          this.updateIndex(dnItems.childCount > 0 ? Math.max(0, c.childIndex - 1) : -1)
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

  protected updateIndex(index: number) {}

  private get selectionsMap() {
    return DnItemizedBehavior.selectionsMap
  }
}
