import { Constructor, IBitFlags } from '@aperos/ts-goodies'
import {
  BaseClass,
  BaseClassFlags,
  IBaseClass,
  IBaseClassOpts,
  INStructChild,
  INStructChildConstructor,
  INStructContainer,
  INStructContainerConstructor,
  NStructChildMixin,
  NStructContainerMixin
} from '@aperos/essentials'
import {
  EventEmitterConstructor,
  EventEmitterMixin,
  IBaseEvents,
  ITypedEvent,
  ITypedEventEmitter,
  ITypedEventOpts,
  TypedEvent
} from '@aperos/event-emitter'

export type DataNodeCreator = (name: string, pathParts?: string[]) => IDataNode | null

export type DataNodeVisitor = (node: IDataNode | null, pathParts?: string[]) => IDataNode | null

export type DataNodeValue = Date | boolean | null | number | string

export interface IDataNodeEvents extends IBaseEvents {
  readonly change: (event: IDataNodeEvent) => void
  readonly addChild: (event: IDataNodeEvent) => void
  readonly removeChild: (event: IDataNodeEvent) => void
}

export interface IDataNode
  extends ITypedEventEmitter<IDataNodeEvents>,
    IBaseClass,
    INStructChild,
    INStructContainer<IDataNode> {
  value: DataNodeValue
  readonly fullPath: string
  readonly isEventTrap: boolean
  readonly isLink: boolean
  readonly parent: IDataNode | null
  readonly realPath: string
  addChild(child: IDataNode): this
  addSuccessorNode(path: string, node: IDataNode): this
  findChildNode(name: string): IDataNode | null
  getBoolean(): boolean
  getDate(): Date
  getExistingNode(path: string): IDataNode
  getFloat(): number
  getInt(): number
  getNodeByPath(path: string): IDataNode | null
  getRelativePath(node: IDataNode, target: IDataNode): string
  getString(): string
  makePath(path: string, createNode?: DataNodeCreator): IDataNode
  removeChild(child: IDataNode): this
  setEventTrap(value: boolean): this
  setValue(value: DataNodeValue): this
  toJSON(): object
  walkPath(path: string, visit: DataNodeVisitor): IDataNode | null
}

export interface IDataNodeOpts extends IBaseClassOpts {
  readonly isEventTrap?: boolean
  readonly value?: DataNodeValue
}

export interface IDataNodeEvent extends ITypedEvent<IDataNodeEvents> {
  readonly node: IDataNode
  readonly child?: IDataNode
}

export interface IDataNodeEventOpts extends ITypedEventOpts<IDataNodeEvents> {
  origin: IDataNode
  child?: IDataNode
}

export class DataNodeEvent extends TypedEvent<IDataNodeEvents> implements IDataNodeEvent {
  readonly child?: IDataNode

  constructor(p: IDataNodeEventOpts) {
    super(p)
    p.child && (this.child = p.child)
  }

  get node(): IDataNode {
    return this.origin as IDataNode
  }
}

export type DataNodeFlags = 'IsChanging' | 'IsEventTrap' | BaseClassFlags

export type DataNodeNStructChild = Constructor<INStructChild> & Constructor<IBaseClass>

export type DataNodeNStructContainer = DataNodeNStructChild &
  INStructContainerConstructor<INStructContainer<IDataNode>>

export const MixinDataNodeNStructChild = (
  base: Constructor<IBaseClass>
): DataNodeNStructChild & INStructChildConstructor<INStructChild> =>
  NStructChildMixin<Constructor<IBaseClass>>(base)

export const MixinDataNodeNStructContainer = (
  base: Constructor<INStructChild & IBaseClass>
): DataNodeNStructContainer =>
  NStructContainerMixin<IDataNode, Constructor<INStructChild> & Constructor<IBaseClass>>(base)

export const MixinDataNodeEventEmitter = (
  base: DataNodeNStructContainer
): DataNodeNStructContainer & EventEmitterConstructor<ITypedEventEmitter<IDataNodeEvents>> =>
  EventEmitterMixin<IDataNodeEvents, DataNodeNStructContainer>(base)

export const BaseDataNodeConstructor = MixinDataNodeEventEmitter(
  MixinDataNodeNStructContainer(MixinDataNodeNStructChild(BaseClass))
)

type DataNodeJson = Record<string, DataNodeValue | object>

export class DataNode extends BaseDataNodeConstructor implements IDataNode {
  static readonly pathSeparator = '/'

  private static nodeNameRegexp = /^\w[\s\w\-\.#():+_]*$/

  readonly flags!: IBitFlags<DataNodeFlags>
  readonly root!: IDataNode
  readonly parent!: IDataNode | null

  protected $value: DataNodeValue | IDataNode

  constructor(p: IDataNodeOpts) {
    super({ ...p, name: DataNode.verifyName(p.name)! })
    this.$value = p.value === undefined ? null : p.value
    p.isEventTrap && this.flags.setFlag('IsEventTrap')
  }

  get fullPath(): string {
    const s = DataNode.pathSeparator
    const p = this.chain.map(x => (x as IDataNode).name)
    p.shift()
    return `${s}${p.join(s)}`
  }

  get isChanging() {
    return this.flags.isSet('IsChanging')
  }

  get isEventTrap() {
    return this.flags.isSet('IsEventTrap')
  }

  get isLink(): boolean {
    return false
  }

  get realPath(): string {
    return this.fullPath
  }

  get value(): DataNodeValue {
    return this.$value as DataNodeValue
  }

  set value(value: DataNodeValue) {
    if (this.$value !== value) {
      this.$value = value
      this.emitEvent(new DataNodeEvent({ origin: this, type: 'change' }))
    }
  }

  addChild(child: IDataNode): this {
    super.addChild(child)
    return this.emitEvent(new DataNodeEvent({ child, origin: this, type: 'addChild' }))
  }

  addSuccessorNode(path: string, node: IDataNode): this {
    if (path.trimLeft().charAt(0) === DataNode.pathSeparator) {
      throw new Error(`DN0001: Path for successor of data node must be relative: "${path}"`)
    }
    this.makePath(path).addChild(node)
    return this
  }

  dispose() {
    super.dispose()
    if (this.isRoot) {
      this.removeAllListeners()
    }
  }

  findChildNode(name: string): IDataNode | null {
    const node = this.findChild((x: INStructChild) => (x as IDataNode).name === name)
    return node ? (node as IDataNode) : null
  }

  getBoolean(): boolean {
    let v = this.$value
    const t = typeof v
    if (t === 'boolean') {
      return v as boolean
    } else if (t === 'string') {
      if (v === 'false') {
        return false
      } else if (v === 'true') {
        return true
      } else {
        v = this.getInt()
      }
    }
    return Boolean(v)
  }

  getDate(): Date {
    if (this.$value instanceof Date) {
      return this.$value
    } else {
      const d = new Date(this.getInt())
      if (isNaN(d.getTime())) {
        throw new Error(
          `DN0002: The data node '${this.fullPath}' does not contain a value of type Date`
        )
      }
      return d
    }
  }

  getExistingNode(path: string) {
    const dn = this.getNodeByPath(path)
    if (!dn) {
      throw new Error(`DN0003: Data node '${this.fullPath}' has no child in the path '${path}'`)
    }
    return dn
  }

  getFloat(): number {
    let v = this.$value
    if (typeof v === 'number') {
      return v
    } else if (v === null) {
      throw new Error('DN0004: Cannot convert null to number')
    } else if (v instanceof Date) {
      return v.getTime()
    } else {
      const n = parseFloat(v as string)
      if (isNaN(n)) {
        throw new Error(
          `DN0005: The data node '${this.fullPath}' does not contain a value of type Number`
        )
      }
      return n
    }
  }

  getInt(): number {
    return Math.trunc(this.getFloat())
  }

  getNodeByPath(path: string): IDataNode | null {
    try {
      return this.walkPath(path, x => x)
    } catch (e) {
      return null
    }
  }

  getRelativePath(node: IDataNode, target: IDataNode): string {
    if (node.root !== target.root) {
      throw new Error(
        `DN0006: Date nodes must belong to one tree: '${node.fullPath}', '${target.fullPath}'`
      )
    }
    throw new Error('Not implemented')
  }

  getString(): string {
    const d = this.$value
    if (d === null) {
      throw new Error('DN0007: Cannot convert null to string')
    } else {
      return d.toString()
    }
  }

  /**
   * Creates all data tree nodes according to the specified path.
   * The path may contain relative components.
   */
  makePath(path: string, createNode?: DataNodeCreator): IDataNode {
    return this.walkPath(
      path,
      (node: IDataNode | null, pathParts?: string[]): IDataNode => {
        if (node) {
          return node
        }
        const pp = pathParts!
        const name = pp[pp.length - 1]
        if (createNode) {
          const newNode = createNode(name, pathParts)
          if (!newNode) {
            throw new Error(
              `DN0008: Data node builder returns null: ${pp.join(DataNode.pathSeparator)}`
            )
          }
          return newNode
        } else {
          const p: IDataNodeOpts = { name }
          return new (this.constructor as typeof DataNode)(p) as IDataNode
        }
      }
    )!
  }

  removeChild(child: IDataNode): this {
    this.emitEvent(new DataNodeEvent({ child, origin: this, type: 'removeChild' }))
    return super.removeChild(child)
  }

  setEventTrap(value: boolean): this {
    this.flags.setFlagValue('IsEventTrap', value)
    return this
  }

  setValue(value: DataNodeValue) {
    this.value = value
    return this
  }

  toJSON() {
    const { childCount: cc, name, value } = this
    const json: DataNodeJson = {}
    const v = value instanceof Date ? `@date:${value.toISOString()}` : value
    if (cc) {
      const node: DataNodeJson = { ...(value !== null ? { '@value': v } : {}) }
      this.enumChildren(c => {
        node[c.name] = (c.toJSON() as DataNodeJson)[c.name]
      })
      json[name] = node
    } else {
      json[name] = v
    }
    return json
  }

  toString(): string {
    const parts: string[] = []
    ;(function dump(node: IDataNode, indent: number = 0) {
      const path = `${node.fullPath}${node.isLink ? ` ~ @${node.realPath}` : ''}`
      parts.push(
        `${' '.repeat(indent)}${path}${node.isLeaf && !node.isLink ? ` = [${node.value}]` : ''}`
      )
      node.enumChildren(c => dump(c as IDataNode, indent + 2))
    })(this)
    return parts.join('\n')
  }

  triggerChanges(_?: string[]): this {
    throw new Error('Not implemented')
  }

  /**
   * Walks through the nodes of the data tree in the specified path.
   * The path may contain relative components, such as relative components
   * in the file system path.
   */
  walkPath(path: string, visit: DataNodeVisitor): IDataNode | null {
    if (path.charAt(0) === ' ' || path.charAt(path.length - 1) === ' ') {
      throw new Error(`DN0009: Path to data node must not be enclosed in spaces: "${path}"`)
    }
    let node: IDataNode | null = this
    if (path.length > 0) {
      const p = path.split(DataNode.pathSeparator)
      const fp: string[] = this.chain.map(x => (x as IDataNode).name)
      for (let i = 0; i < p.length; i++) {
        const name = p[i]
        if (name === '') {
          if (i > 0) {
            throw new Error(`DN0010: Data element path cannot end with "/": "${path}"`)
          }
          fp.length = 0
          node = visit(this.root as IDataNode, fp)
        } else if (name === '.') {
          node = visit(node, fp)
        } else if (name === '..') {
          if (!node.parent) {
            throw new Error(`DN0011: Invalid data node path: "${path}"`)
          }
          fp.pop()
          node = visit(node.parent, fp)
        } else {
          DataNode.verifyName(name)
          fp.push(name)
          let child = node!.findChildNode(name)
          const newChild = visit(child, fp)
          if (!child && newChild) {
            node!.addChild(newChild)
          }
          node = newChild
        }
        if (!node) {
          break
        }
      }
    }
    return node
  }

  protected emitEvent(event: IDataNodeEvent): this {
    if (!this.isChanging || event.type !== 'change') {
      this.flags.setFlag('IsChanging')
      let p = this.parent
      while (p) {
        const dn = p as IDataNode
        if (dn.isEventTrap) {
          dn.emit(event.type, event)
        }
        p = p.parent
      }
      super.emit(event.type, event)
      this.flags.unset('IsChanging')
    }
    return this
  }

  static verifyName(name?: string): string {
    if (!name || !DataNode.nodeNameRegexp.test(name)) {
      throw new Error(`DN0012: Invalid name for data node: "${name}"`)
    }
    return name
  }
}
