import { DataNode, DataNodeCreator, DataNodeValue, DataNodeVisitor, IDataNode, IDataNodeEvents } from './data_node'
import { EventEmitArgs } from '@devtoolsweb/event-emitter'
import { IBaseClassOpts } from '@devtoolsweb/essentials'

export interface IDataNodeLink extends IDataNode {
    readonly target: IDataNode
}

export interface IDataNodeLinkOpts extends IBaseClassOpts {
    readonly target: IDataNode
    readonly targetPath?: string
}

export class DataNodeLink extends DataNode implements IDataNodeLink {

    constructor (p: IDataNodeLinkOpts) {
        let t: IDataNode | null = p.target
        const path = p.targetPath
        if (path) {
            t = t.getNodeByPath(path)
            if (!t) {
                throw new Error(`DN0013: Target node has no child in path '${path}'`)
            }
        }
        super({
            ...p,
            name: p.name || t.name
        })
        this.$value = t
    }

    get isLink (): boolean {
        return true
    }

    get realPath (): string {
        return this.target.fullPath
    }

    get target (): IDataNode {
        return this.$value as IDataNode
    }

    get value (): DataNodeValue {
        return this.target.value
    }

    set value (v: DataNodeValue) {
        this.target.value = v
    }

    [Symbol.iterator] () {
        return this.target[Symbol.iterator]()
    }

    addChild (child: IDataNode): this {
        this.target.addChild(child)
        return this
    }

    addListener<E extends keyof IDataNodeEvents> (
        event: E,
        listener: IDataNodeEvents[E],
        counter = Infinity
    ) {
        this.target.addListener(event, listener, counter)
        return this
    }

    addSuccessorNode (path: string, node: IDataNode): this {
        this.target.addSuccessorNode(path, node)
        return this
    }

    emit<E extends keyof IDataNodeEvents> (event: E, ...args: EventEmitArgs<IDataNodeEvents[E]>) {
        return this.target.emit(event, ...args)
    }

    findChildNode (name: string): IDataNode | null {
        return this.target.findChildNode(name)
    }

    getBoolean (): boolean {
        return this.target.getBoolean()
    }

    getDate (): Date {
        return this.target.getDate()
    }

    getFloat (): number {
        return this.target.getFloat()
    }

    getInt (): number {
        return this.target.getInt()
    }

    getNodeByPath (path: string): IDataNode | null {
        return this.target.getNodeByPath(path)
    }

    getString (): string {
        return this.target.getString()
    }

    listenerCount<E extends keyof IDataNodeEvents> (event: E) {
        return this.target.listenerCount(event)
    }

    listeners<E extends keyof IDataNodeEvents> (event: E) {
        return this.target.listeners(event)
    }

    makePath (path: string, createNode?: DataNodeCreator) {
        return this.target.makePath(path, createNode)
    }

    removeAllListeners<E extends keyof IDataNodeEvents> (event?: E) {
        this.target.removeAllListeners(event)
        return this
    }

    removeChild (child: IDataNode): this {
        this.target.removeChild(child)
        return this
    }

    removeListener<E extends keyof IDataNodeEvents> (event: E, listener: IDataNodeEvents[E]) {
        this.target.removeListener(event, listener)
        return this
    }

    toJSON () {
        const json: Record<string, string> = {}
        json[this.name] = `@link:${this.realPath}`
        return json
    }

    walkPath (path: string, visit: DataNodeVisitor): IDataNode | null {
        return this.target.walkPath(path, visit)
    }

}
