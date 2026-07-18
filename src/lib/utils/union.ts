/**
 * Helper to create a discriminated union type from a mapping interface.
 *
 * @example
 * type Shape = Union<{
 *   circle: { radius: number };
 *   rect: { width: number; height: number };
 * }>;
 *
 * // Resulting type:
 * // | { tag: 'circle'; value: { radius: number } }
 * // | { tag: 'rect'; value: { width: number; height: number } }
 */
export type Union<Mappings> = {
   [K in keyof Mappings]: {
      tag: K;
      value: Mappings[K];
   };
}[keyof Mappings];
