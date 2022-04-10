import { ClassName } from '@devtoolsweb/essentials'
import { DataNode, IDataNode, IDataNodeEvent } from '../data_node'
import { DataNodeBehavior, DataNodeBehaviorFlags, IDataNodeBehavior, IDataNodeBehaviorOpts } from './data_node_behavior'
import { DataNodeLink } from '../data_node_link'
import { IBitFlags, Memoize } from '@devtoolsweb/ts-goodies'

export interface IDnItemizedBehavior extends IDataNodeBehavior {
    readonly allowMultiSelect: boolean
    readonly dnIndex: IDataNode
    readonly dnItems: IDataNode
    readonly firstSelectedIndex: number
    readonly roundRobin: boolean
    readonly selectedCount: number
    selectNext(increment?: number): this
    unselectAll(): this
}

export interface IDnItemizedBehaviorOpts extends IDataNodeBehaviorOpts {
    allowMultiSelect?: boolean
    index?: number
    keepSelection?: boolean
    roundRobin?: boolean
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

    constructor (opts: IDnItemizedBehaviorOpts) {
        super(opts)
    }

    get allowMultiSelect () {
        return !!this.flags.isSet('AllowMultiSelect')
    }

    get dnIndex () {
        return this.essentials['dnIndex'] as IDataNode
    }

    get dnItems () {
        return this.essentials['dnItems'] as IDataNode
    }

    get firstSelectedIndex () {
        return this.dnIndex.getInt()
    }

    get roundRobin () {
        return this.flags.isSet('RoundRobin')
    }

    get selectedCount () {
        return this.selectedItems.size
    }

    @Memoize()
    protected get essentials () {
        return {} as Partial<Record<EssentialChildren, IDataNode>>
    }

    protected get keepSelection () {
        return this.flags.isSet('KeepSelection')
    }

    @Memoize()
    protected get selectedItems () {
        return new Set<IDataNode>()
    }

    @Memoize()
    protected get selectionChangeListener () {
        return (event: IDataNodeEvent) => {
            const s = event.node
            const p = s.parent as IDataNode
            this.safelyUpdateNode(s, () => {
                if (s.value) {
                    this.selectItem(p, false)
                }
                else {
                    this.unselectItem(p, false)
                }
            })
        }
    }

    private get selectionsMap () {
        return DnItemizedBehavior.selectionsMap
    }

    selectNext (increment = 1): this {
        if (increment === 0) {
            throw new Error(`DN0027: Itemized behavior index increment step cannot be 0: ${this.dataNode.fullPath}`)
        }
        const { dnIndex, dnItems, roundRobin: rr } = this
        let i = dnIndex.getInt()
        i += increment
        if (rr) {
            const n = dnItems.childCount
            i = ((i % n) + n) % n
        }
        // WARNING: Don't use method safelySetNodeValue() here.
        dnIndex.value = i
        return this
    }

    unselectAll () {
        const { selectedItems: xs } = this
        xs.forEach(x => {
            this.unselectItem(x)
        })
        this.safelySetNodeValue(this.dnIndex, -1)
        return this
    }

    protected applyIndex (index: number) {
        const { allowMultiSelect: ms, dnIndex, dnItems, roundRobin: rr, selectedItems: xs } = this
        const n = rr ? index % dnItems.childCount : index
        this.safelySetNodeValue(dnIndex, n)
        if (n < 0) {
            this.unselectAll()
        }
        else {
            let dn: IDataNode | null = null
            dnItems.enumChildren((c, i = 0) => {
                if (i >= n) {
                    dn = c
                    this.selectItem(c)
                    return 'Leave'
                }
                else {
                    this.unselectItem(c)
                }
                return
            })
            if (!ms) {
                xs.forEach(x => {
                    if (x !== dn) {
                        this.unselectItem(x)
                    }
                })
            }
        }
        return n
    }

    protected findFirstSelectedIndex () {
        const { dnItems } = this
        let index = -1
        dnItems.enumChildren((c, i) => {
            const s = this.getSelection(c) as IDataNode
            if (s.value) {
                index = i as number
                return 'Leave'
            }
            return
        })
        return index
    }

    protected getSelection (x: number | IDataNode) {
        const { dnItems, selectionsMap: sm } = this
        const c = x instanceof DataNode ? x : dnItems.getChildAt(x as number)
        return c ? sm.get((c.isLink ? (c as DataNodeLink).target : c)) : undefined
    }

    protected initBehavior (opts: IDnItemizedBehaviorOpts) {
        if (opts.allowMultiSelect && opts.keepSelection) {
            throw new Error('DN0024: Parameters \'allowMultiSelect\' and \'keepSelection\' can\'t be used simultaneously')
        }

        const { dataNode: dn, essentials: cn } = this
        cn.dnIndex = dn.makePath('index') as IDataNode
        cn.dnItems = dn.makePath('items') as IDataNode

        const { dnIndex, dnItems, flags } = this
        flags.setFlagValue('AllowMultiSelect', !!opts.allowMultiSelect)
        flags.setFlagValue('KeepSelection', !!opts.keepSelection)
        flags.setFlagValue('RoundRobin', opts.roundRobin !== false)

        dnItems.enumChildren((c, i) => {
            this.initItem(c, dnIndex.value === i)
        })
        const i = opts.index
        const v = dnIndex.value
        this.applyIndex(i === undefined ? (typeof v === 'number' ? v : -1) : i)

        dnIndex.on('change', event => {
            this.safelyUpdateNode(dnIndex, () => {
                event.confirm(this.applyIndex(dnIndex.getInt()))
            })
        })

        dnItems
            .on('addChild', event => {
                const c = event.child as IDataNode
                this.initItem(c)
                const s = this.getSelection(c) as IDataNode
                s.on('change', this.selectionChangeListener)
                const i = dnIndex.getInt()
                if (event.childIndex as number <= this.firstSelectedIndex) {
                    this.safelySetNodeValue(dnIndex, i + 1)
                }
            })
            .on('removeChild', event => {
                this.releaseItem(event.child as IDataNode)
            })
    }

    protected initItem (item: IDataNode, selected = false) {
        const dn = item.isLink ? (item as DataNodeLink).target : item
        const { selectionsMap: sm } = this
        const s = dn.makePath('selected') as IDataNode
        if (!sm.has(dn)) {
            sm.set(dn, s)
        }
        this.safelySetNodeValue(s, selected)
        s.on('change', this.selectionChangeListener)
    }

    protected releaseItem (item: IDataNode) {
        const { dnIndex, dnItems, selectionsMap: sm } = this
        const s = this.getSelection(item) as IDataNode
        s.off('change', this.selectionChangeListener)

        const i = dnIndex.getInt()
        const n = dnItems.childCount
        const ci = item.childIndex
        let index = i
        this.unselectItem(item)
        this.selectedItems.delete(item)
        const f = this.findFirstSelectedIndex()
        if (this.allowMultiSelect) {
            if (f > ci) {
                index = i === n ? -1 : f - 1
            }
            else if (f < 0) {
                index = -1
            }
        }
        else if (this.keepSelection) {
            if (n > 1) {
                index = Math.max(0, i - 1)
                const next = index < n - 1 ? index : index - 1
                this.selectItem(dnItems.getChildAt(next === 0 ? 1 : next) as IDataNode)
            }
            else {
                index = -1
            }
        }
        else {
            index = -1
        }
        if (index !== i) {
            this.safelySetNodeValue(dnIndex, index)
        }
        sm.delete(item)
    }

    protected selectItem (item: IDataNode, standalone = true) {
        const { selectedItems: xs } = this
        const s = this.getSelection(item) as IDataNode
        this.safelySetNodeValue(s, true)
        xs.add(item)
        if (!standalone) {
            if (!this.allowMultiSelect) {
                xs.forEach(x => {
                    if (x !== item) {
                        this.unselectItem(x)
                    }
                })
            }
            this.setFirstSelectedIndex()
        }
    }

    protected setFirstSelectedIndex () {
        const { dnIndex } = this
        const index = this.findFirstSelectedIndex()
        if (index !== dnIndex.value) {
            this.safelySetNodeValue(dnIndex, index)
        }
    }

    protected unselectItem (item: IDataNode, standalone = true) {
        const { selectedItems: xs } = this
        const s = this.getSelection(item) as IDataNode
        this.safelySetNodeValue(s, false)
        xs.delete(item)
        if (!standalone) {
            this.setFirstSelectedIndex()
        }
    }

    @Memoize()
    static get selectionsMap () {
        return new WeakMap<IDataNode, IDataNode>()
    }

}
