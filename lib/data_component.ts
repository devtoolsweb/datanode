/**
 * A component can be created from any class that supports IBaseClass.
 */
import { IConstructor } from '@aperos/ts-goodies'
import { IDataNode } from '@aperos/datanode'
import { IBaseClass, IBaseClassOpts } from '@aperos/essentials'
import { IBaseEvents, ITypedEventEmitter } from '@aperos/event-emitter'

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
  setupEventListeners(): void
}

export interface IDataComponentConstructor extends IConstructor<IInternalDataComponent> {
  new (opts: IDataComponentOpts): IInternalDataComponent
  readonly knownDescendantNodes: Record<string, boolean>
}

type ActiveEventTuple = [string | number | Symbol, any]
type ActiveEventMap = Map<ITypedEventEmitter, Array<ActiveEventTuple>>

const symActiveEventMap = Symbol()
const symDataNode = Symbol()
const symNodeCache = Symbol()

export const uiDataComponentKnownNodes = {}

export function DataComponentMixin<TBase extends IConstructor<IBaseClass>>(
  Base: TBase
): TBase & IDataComponentConstructor {
  return class MixedDataComponent extends Base implements IDataComponent {
    static get knownDescendantNodes() {
      return uiDataComponentKnownNodes
    }

    private [symActiveEventMap]: ActiveEventMap
    private [symDataNode]: IDataNode
    private [symNodeCache]: Partial<
      Record<keyof typeof MixedDataComponent.knownDescendantNodes, IDataNode>
    >

    get dataNode() {
      return this[symDataNode]
    }

    get nodeCache() {
      return this[symNodeCache]
    }

    cleanupEventListeners() {
      for (const [emitter, listeners] of this.activeListeners.entries()) {
        for (const [eventName, listener] of listeners) {
          emitter.off(eventName as never, listener as never)
        }
      }
    }

    initComponent(opts: IDataComponentOpts) {
      if (!opts.dataNode) {
        throw new Error('DN0026: DataComponent parameters require a data node')
      }
      const { dataNode: root, dataPath: dp } = opts
      if (typeof dp === 'string' && !dp) {
        throw new Error('UI0027: The data node path cannot be an emtpy string')
      }
      const dn = dp ? root.getExistingNode(dp) : root
      this[symDataNode] = dn
      this.initNodeCache()
    }

    registerEventListener<Events extends IBaseEvents>(
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
      x.push([eventName, listener])
      emitter.on(eventName, listener as any)
      return this
    }

    setupEventListeners() {}

    private get activeListeners() {
      let xs = this[symActiveEventMap]
      if (!xs) {
        xs = this[symActiveEventMap] = new Map<ITypedEventEmitter, Array<ActiveEventTuple>>()
      }
      return xs
    }

    private initNodeCache() {
      this[symNodeCache] = {}
      const dn = this.dataNode
      const ctor = this.constructor as IDataComponentConstructor
      Object.entries(ctor.knownDescendantNodes).forEach(([k, v]) => {
        const node = v ? dn.getExistingNode(k) : dn.getNodeByPath(k)
        if (node) {
          ;(this.nodeCache as Record<string, IDataNode>)[k] = node
        }
      })
    }
  }
}
