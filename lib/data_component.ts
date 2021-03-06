/*
 * A component can be created from any class that supports IBaseClass.
 *
 * TODO: Add translated known node names, e.g. { selected: 'marked' } and so on.
 */
import { Constructor } from 'type-fest'
import { DataNodeValue, IDataNode } from './data_node'
import { IBaseClass, IBaseClassOpts } from '@devtoolsweb/essentials'
import { IBaseEvents, ITypedEventEmitter } from '@devtoolsweb/event-emitter'

export interface IDataComponent extends IBaseClass {
    readonly dataNode: IDataNode
}

export interface IDataComponentOpts extends IBaseClassOpts {
    dataNode?: IDataNode
    dataPath?: string
}

export interface IInternalDataComponent extends IDataComponent {
    cleanupEventListeners(): void
    initComponent(opts: IDataComponentOpts): void
    registerEventListener<Events extends IBaseEvents>(
        emitter: ITypedEventEmitter<Events>,
        eventName: keyof Events,
        listener: Events[keyof Events]
    ): this
    safelySetNodeValue(node: IDataNode, value: DataNodeValue): this
    safelyUpdateNode(node: IDataNode, update: () => void): this
    setupEventListeners(): void
}

export interface IDataComponentConstructor extends Constructor<IInternalDataComponent> {
    new (opts: IDataComponentOpts): IInternalDataComponent
    readonly knownDescendantNodes: Record<string, boolean>
}

type ActiveEventTuple = [string | number | symbol, unknown]
type ActiveEventMap = Map<ITypedEventEmitter, Array<ActiveEventTuple>>

export const uiDataComponentKnownNodes = {}

export function DataComponentMixin<TBase extends Constructor<IBaseClass>> (Base: TBase): TBase & IDataComponentConstructor {
    return class MixedDataComponent extends Base implements IDataComponent {

        private $activeEventMap!: ActiveEventMap

        private $dataNode!: IDataNode

        private $nodeCache!: Partial<
        Record<keyof typeof MixedDataComponent.knownDescendantNodes, IDataNode>
        >

        private inProcessNodes!: WeakSet<IDataNode>

        get dataNode () {
            return this.$dataNode
        }

        get nodeCache () {
            return this.$nodeCache
        }

        private get activeListeners () {
            let xs = this.$activeEventMap
            if (!xs) {
                xs = this.$activeEventMap = new Map<ITypedEventEmitter, Array<ActiveEventTuple>>()
            }
            return xs
        }

        cleanupEventListeners () {
            for (const [ emitter,
                listeners ] of this.activeListeners.entries()) {
                for (const [ eventName,
                    listener ] of listeners) {
                    emitter.off(eventName as never, listener as never)
                }
            }
        }

        dispose () {
            this.cleanupEventListeners()
        }

        initComponent (opts: IDataComponentOpts) {
            if (!opts.dataNode) {
                throw new Error('DN0025: DataComponent parameters require a data node')
            }
            const { dataNode: root, dataPath: dp } = opts
            if (typeof dp === 'string' && !dp) {
                throw new Error('DN0026: The data node path cannot be an emtpy string')
            }
            const dn = dp ? root.getExistingNode(dp) : root
            this.$dataNode = dn
            this.initNodeCache()
        }

        registerEventListener<Events extends IBaseEvents> (
            emitter: ITypedEventEmitter<Events>,
            eventName: keyof Events,
            listener: Events[keyof Events]
        ): this {
            const xs = this.activeListeners
            let x = xs.get(emitter)
            if (!x) {
                x = new Array<ActiveEventTuple>()
                xs.set(emitter, x)
            }
            x.push([ eventName, listener ])
            emitter.on(eventName, listener as Events[keyof Events])
            return this
        }

        safelySetNodeValue (node: IDataNode, value: DataNodeValue) {
            this.safelyUpdateNode(node, () => {
                node.value = value
            })
            return this
        }

        safelyUpdateNode (node: IDataNode, update: () => void) {
            let xs = this.inProcessNodes
            if (!xs) {
                this.inProcessNodes = xs = new WeakSet<IDataNode>()
            }
            if (!xs.has(node)) {
                xs.add(node)
                update()
                xs.delete(node)
            }
            return this
        }

        setupEventListeners () {
            //
        }

        private initNodeCache () {
            this.$nodeCache = {}
            const dn = this.dataNode
            const ctor = this.constructor as IDataComponentConstructor
            Object.entries(ctor.knownDescendantNodes).forEach(([ k,
                v ]) => {
                const node = v ? dn.getExistingNode(k) : dn.getNodeByPath(k)
                if (node) {
                    (this.nodeCache as Record<string, IDataNode>)[k] = node
                }
            })
        }

        static get knownDescendantNodes () {
            return uiDataComponentKnownNodes
        }

    }
}
