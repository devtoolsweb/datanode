/*
 * TODO: Cleanup event listeners on dispose.
 */
import { IConstructor, IBitFlags } from '@aperos/ts-goodies'
import {
  BaseClass,
  BaseClassFlags,
  ClassName,
  IBaseClass,
  IBaseClassOpts
} from '@aperos/essentials'
import { IDataNode } from '../data_node'

export interface IDataNodeBehavior extends IBaseClass {
  readonly dnRoot: IDataNode
  readonly dataNode: IDataNode
}

export interface IDataNodeBehaviorOpts extends IBaseClassOpts {
  dataNode: IDataNode
  dataPath?: string
}

export type DataNodeBehaviorFlags = BaseClassFlags

interface IBehaviorCtor extends IConstructor<IDataNodeBehavior> {
  readonly className?: string
  readonly requiredPaths: Array<string>
  isAssignedTo(dataNode: IDataNode): boolean
}

@ClassName('DataNodeBehavior')
export class DataNodeBehavior extends BaseClass implements IDataNodeBehavior {
  static behaviorMap = new Map<string, WeakMap<IDataNode, IDataNodeBehavior>>()

  readonly flags!: IBitFlags<DataNodeBehaviorFlags>
  readonly dnRoot: IDataNode
  readonly dataNode: IDataNode

  constructor(opts: IDataNodeBehaviorOpts) {
    super(opts)
    if (!this.className) {
      throw new Error('DN0021: Data node behavior must have an explicit class name')
    }
    const { dataNode: root, dataPath: dp } = opts
    this.dnRoot = root
    this.dataNode = dp ? root.getExistingNode(dp) : root
    this.validate()
    this.prepare()
    this.initBehavior(opts)
  }

  protected get behaviorMap() {
    return DataNodeBehavior.behaviorMap
  }

  protected initBehavior(_: IDataNodeBehaviorOpts) {}

  protected prepare() {
    const { behaviorMap: bm, className: cn, dataNode: dn } = this
    if ((this.constructor as IBehaviorCtor).isAssignedTo(dn)) {
      throw new Error(`DN0022: Behavior '${cn}' already assigned to '${dn.fullPath}'`)
    }
    let xs = bm.get(cn)
    if (!xs) {
      xs = new WeakMap<IDataNode, IDataNodeBehavior>()
      bm.set(cn, xs)
    }
    xs.set(dn, this)
  }

  protected validate() {
    const ctor = this.constructor as IBehaviorCtor
    const paths = ctor.requiredPaths
    const dn = this.dataNode
    for (const path of paths) {
      if (!dn.getNodeByPath(path)) {
        throw new Error(`DN0023: Data node '${dn.fullPath}' has no child '${path}'`)
      }
    }
  }

  static get requiredPaths(): Array<string> {
    return []
  }

  static findBehavior(name: string, dataNode: IDataNode) {
    const xs = this.behaviorMap.get(name)
    return xs ? xs.get(dataNode) : undefined
  }

  static isAssignedTo(dataNode: IDataNode) {
    const xs = this.behaviorMap.get((this as IBehaviorCtor).className!)
    return xs && xs.has(dataNode)
  }
}
