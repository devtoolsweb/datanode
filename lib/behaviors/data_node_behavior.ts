/*
 * TODO: Cleanup event listeners on dispose.
 */
import { IConstructor } from '@aperos/ts-goodies'
import { BaseClass, BaseClassFlags, ClassName } from '@aperos/essentials'
import { IDataNode } from '../data_node'
import {
  DataComponentMixin,
  IDataComponent,
  IDataComponentConstructor,
  IDataComponentOpts
} from '../data_component'

export interface IDataNodeBehavior extends IDataComponent {}

export interface IDataNodeBehaviorOpts extends IDataComponentOpts {}

export type DataNodeBehaviorFlags = BaseClassFlags

interface IBehaviorCtor extends IConstructor<IDataNodeBehavior> {
  readonly className?: string
  readonly requiredPaths: Array<string>
  isAssignedTo(dataNode: IDataNode): boolean
}

export const MixinDataNodeBehaviorDataComponent = (
  base: IConstructor<BaseClass>
): IDataComponentConstructor => DataComponentMixin<IConstructor<BaseClass>>(base)

export const BaseDataNodeBehaviorConstructor = MixinDataNodeBehaviorDataComponent(BaseClass)

@ClassName('DataNodeBehavior')
export class DataNodeBehavior extends BaseDataNodeBehaviorConstructor implements IDataNodeBehavior {
  static behaviorMap = new Map<string, WeakMap<IDataNode, IDataNodeBehavior>>()

  constructor(opts: IDataNodeBehaviorOpts) {
    super(opts)
    if (!this.className) {
      throw new Error('DN0021: Data node behavior must have an explicit class name')
    }
    this.validate()
    this.initComponent(opts)
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

  static getAssignedBehavior(dataNode: IDataNode): IDataNodeBehavior | undefined {
    const xs = this.behaviorMap.get((this as IBehaviorCtor).className!)
    return xs ? xs.get(dataNode) : undefined
  }

  static isAssignedTo(dataNode: IDataNode): boolean {
    return !!this.getAssignedBehavior(dataNode)
  }
}
