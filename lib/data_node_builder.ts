/*
 * TODO: Add support for docs and cross-references.
 * Documents can be represented using the option of the type of object,
 * the keys of which are the names of documents, and the values are
 * trees of nodes.
 */
import { StringUtils, Memoize } from '@aperos/ts-goodies'
import { DataNode, IDataNode } from './data_node'
import { DataNodeLink } from './data_node_link'

export interface IDataNodeBuilderOpts {
  camelCaseToKebab?: boolean
}

export interface IDataNodeBuilder {
  build(source: object, rootNodeName?: string): IDataNode
  getLastIdentifiedPaths(): Record<string, string>
}

export class DataNodeBuilder implements IDataNodeBuilder {
  static readonly regexpNodeRef = /^@ref:\s*([^:]+)(?::\/(.*))?$/

  readonly identifiedNodes = new Map<string, IDataNode>()

  protected readonly camelCaseToKebab: boolean

  constructor(opts?: IDataNodeBuilderOpts) {
    this.camelCaseToKebab = opts?.camelCaseToKebab || false
  }

  build(source: object, rootNodeName?: string) {
    this.identifiedNodes.clear()
    const root = new DataNode({ name: rootNodeName || 'data' })
    this.createChildren(root, source)
    return root
  }

  getLastIdentifiedPaths() {
    const xs: Record<string, string> = {}
    for (const [id, node] of this.identifiedNodes.entries()) {
      xs[id] = node.fullPath
    }
    return xs
  }

  private createChildren(dn: IDataNode, nodeObjects: object) {
    Object.entries(nodeObjects).forEach(([key, value]) => {
      const name = this.camelCaseToKebab ? StringUtils.camelCaseToKebab(key) : key
      if (name === 'default' || this.addProperty(dn, name, value)) {
        return
      }
      DataNode.verifyName(name)
      if (Array.isArray(value)) {
        const node = this.addChildNode(dn, name)
        const xs: Record<string, object> = {}
        value.forEach((v, i) => (xs[`${i}`] = v))
        this.createChildren(node, xs)
      } else {
        const t = typeof value
        switch (t) {
          case 'object':
            this.createChildren(this.addChildNode(dn, name), value)
            break

          case 'string':
            dn.addChild(
              this.createDate(name, value) ||
                this.createLink(dn, name, value) ||
                this.createRef(name, value) ||
                this.createTimestamp(name, value) ||
                new DataNode({ name, value })
            )
            break

          default:
            this.addValue(this.addChildNode(dn, name), value)
        }
      }
    })
  }

  private addChildNode(dn: IDataNode, name: string, value?: string) {
    const childNode = new DataNode({ name, value })
    dn.addChild(childNode)
    return childNode
  }

  private addProperty(dn: IDataNode, name: string, value: string): boolean {
    const xs = this.identifiedNodes
    if (name === '@id') {
      if (xs.has(value)) {
        throw new Error(`Node already has an id: ${value}`)
      }
      if (value.charAt(0) !== '#') {
        throw new Error(`Node id must begin with '#': ${value}`)
      }
      xs.set(value, dn)
      return true
    } else if (name === '@value') {
      this.addValue(dn, value)
      return true
    }
    return false
  }

  private addValue(dn: IDataNode, value: any) {
    const t = typeof value
    if (t === 'boolean' || t === 'number' || t === 'string') {
      dn.value = value
    } else {
      throw new Error(`Unknown data node value type: ${t}`)
    }
  }

  private createDate(name: string, value: string): IDataNode | null {
    const m = value.match(/^@date:\s*(.*)$/)
    if (m) {
      const timestamp = new Date(m[1])
      if (isNaN(timestamp.valueOf())) {
        throw new Error(`Invalid date string: ${m[1]}`)
      }
      new DataNode({ name, value: new Date(timestamp) })
    }
    return null
  }

  private createLink(dn: IDataNode, name: string, value: string): IDataNode | null {
    const m = value.match(/^@link:\s*(.*)$/)
    if (m) {
      const path = m[1]
      const target = dn.getNodeByPath(path)
      if (!target) {
        throw new Error(`Target node does not exist: '${path}`)
      }
      return new DataNodeLink({ name, target })
    }
    return null
  }

  private createRef(name: string, value: string): IDataNode | null {
    const m = value.match(DataNodeBuilder.regexpNodeRef)
    if (m) {
      const [, id, path] = m
      let target = this.identifiedNodes.get(id)
      if (!target) {
        throw new Error(`Node with id '${id}' does not exist`)
      }
      if (path) {
        const c = target.getNodeByPath(path)
        if (!c) {
          throw new Error(`Child node '${path}' of node '${target.fullPath}' does not exist`)
        }
        target = c
      }
      return new DataNodeLink({ name, target })
    }
    return null
  }

  private createTimestamp(name: string, value: string): IDataNode | null {
    const m = value.match(/^@timestamp:\s*(.*)$/)
    return m ? new DataNode({ name, value: new Date(parseInt(m[1])) }) : null
  }

  @Memoize()
  static get standard(): IDataNodeBuilder {
    return new DataNodeBuilder({
      camelCaseToKebab: true
    })
  }
}
