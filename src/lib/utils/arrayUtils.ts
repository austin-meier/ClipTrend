import { identity } from './functionUtils';

export const first = <T>(arr: T[]): T | undefined => arr[0];
export const last = <T>(arr: T[]): T | undefined => arr[arr.length - 1];

export const butFirst = <T>(arr: T[]): T[] => arr.slice(1);
export const butLast = <T>(arr: T[]): T[] => arr.slice(0, -1);

export const count = <T>(arr: T[] | undefined): number => {
   if (!arr) return 0;
   return arr.length;
};

/** Common functions to pass as a sorting algorithm to .sort or .toSorted */
export const Sorting = {
   increasingNumber: (a: number, b: number) => a - b,
   decreasingNumber: (a: number, b: number) => b - a,
};

export const intersect = <T>(sets: T[][]): T[] => intersectBy(identity, sets);
export const intersectBy = <T>(fn: (arg: T) => unknown, sets: T[][]): T[] => {
   if (sets.length === 0) return [];
   const mappedSets = sets.map((set) => new Set(set.map(fn)));
   return sets[0].filter((item) =>
      mappedSets.every((set) => set.has(fn(item)))
   );
};

export const indexBy = <T, K extends string | number | symbol>(
   input: T[] | Record<PropertyKey, T>,
   fn: (item: T) => K | undefined
): Record<K, T> => {
   const items = Array.isArray(input) ? input : Object.values(input);
   return items.reduce(
      (acc, item) => {
         const key = fn(item);
         if (key) acc[key] = item;
         return acc;
      },
      {} as Record<K, T>
   );
};

/* Small wrapper just for clarity sake, some prefer keyBy over indexBy */
export const keyBy = <T extends object, K extends keyof T>(
   array: T[],
   key: K
): Record<T[K] & PropertyKey, T> => {
   return indexBy(array, (i) => i[key] as T[K] & PropertyKey);
};

/* groupBy operates similar to indexBy, but all values are a collection of results matching the key fn.
   use this if you expect multiple things to contain the key. */
export const groupBy = <T, K extends string | number | symbol>(
   arr: T[],
   fn: (item: T) => K | undefined
): Record<K, T[]> => {
   return arr.reduce(
      (acc, item) => {
         const key = fn(item);
         if (key) {
            if (acc[key]) {
               acc[key].push(item);
            } else {
               acc[key] = [item];
            }
         }
         return acc;
      },
      {} as Record<K, T[]>
   );
};

export const unique = <T>(array: T[]): T[] => {
   return [...new Set(array)];
};

export const uniqueBy = <T, R>(array: T[], f: (t: T) => R) =>
   array.filter((a, idx, self) => self.findIndex((b) => f(a) === f(b)) === idx);

export const keep = <T, R>(xs: T[], f: (t: T) => R | null | undefined): R[] =>
   xs.flatMap((x) => {
      const r = f(x);
      return r == null ? [] : [r];
   });

export const range = (start: number, end?: number): number[] => {
   const result: number[] = [];
   if (end === undefined) {
      end = start;
      start = 0;
   }
   for (let i = start; i < end; i++) {
      result.push(i);
   }
   return result;
};

export const rangeInclusive = (start: number, end?: number): number[] => {
   const result: number[] = [];
   if (end === undefined) {
      end = start;
      start = 0;
   }
   for (let i = start; i <= end; i++) {
      result.push(i);
   }
   return result;
};
