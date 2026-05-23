declare module 'flow-remove-types' {
  export interface FlowRemoveTypesOptions {
    pretty?: boolean
  }

  export interface FlowRemoveTypesResult {
    toString(): string
  }

  export default function flowRemoveTypes(
    source: string,
    options?: FlowRemoveTypesOptions,
  ): FlowRemoveTypesResult
}
