/*
 * TODO: Cleanup event listeners on dispose.
 */
import { BaseClass, ClassName, IBaseClass, IBaseClassOpts } from '@aperos/essentials'
import { IDataNode } from '@aperos/datanode'

export interface IDataNodeBehavior extends IBaseClass {
  readonly dnRoot: IDataNode
  readonly dataNode: IDataNode
}

export interface IDataNodeBehaviorOpts extends IBaseClassOpts {
  dataNode: IDataNode
  dataPath?: string
}

interface IBehaviorCtor {
  new (opts: IDataNodeBehaviorOpts): IDataNodeBehavior
  readonly className: string
  readonly requiredPaths: Array<string>
  isAssignedTo(dataNode: IDataNode): boolean
}

const dnMap = new Map<string, WeakSet<IDataNode>>()

@ClassName('DataNodeBehavior')
export class DataNodeBehavior extends BaseClass implements IDataNodeBehavior {
  readonly dnRoot: IDataNode
  readonly dataNode: IDataNode

  constructor(opts: IDataNodeBehaviorOpts) {
    super(opts)
    if (!this.className) {
      throw new Error('UI0012: Data model behavior must have an explicit class name')
    }
    const { dataNode: root, dataPath: dp } = opts
    this.dnRoot = root
    this.dataNode = dp ? root.getExistingNode(dp) : root
    this.validate()
    this.prepare()
    this.initBehavior()
  }

  protected initBehavior() {}

  protected prepare() {
    const { className, dataNode } = this
    if ((this.constructor as IBehaviorCtor).isAssignedTo(dataNode)) {
      throw new Error(`UI0013: Behavior '${className} already assigned to '${dataNode.fullPath}'`)
    }
    const cn = className
    let xs = dnMap.get(cn)
    if (!xs) {
      xs = new WeakSet<IDataNode>()
      dnMap.set(cn, xs)
    }
    xs.add(dataNode)
  }

  protected validate() {
    const ctor = this.constructor as IBehaviorCtor
    const paths = ctor.requiredPaths
    const dn = this.dataNode
    for (const path of paths) {
      if (!dn.getNodeByPath(path)) {
        throw new Error(`UI0015: Data node '${dn.fullPath}' has no child '${path}'`)
      }
    }
  }

  static get requiredPaths(): Array<string> {
    return []
  }

  static isAssignedTo(dataNode: IDataNode) {
    const xs = dnMap.get(((this as unknown) as IBehaviorCtor).className)
    return xs && xs.has(dataNode)
  }
}
