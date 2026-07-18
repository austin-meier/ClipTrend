export const identity = <T>(arg: T): T => arg;
export const defined = <T>(x: T | undefined | null): x is T => x != null;

export const memoize = <Args extends unknown[], Result>(
   fn: (...args: Args) => Result
): ((...args: Args) => Result) => {
   const cache = new Map<string, Result>();

   return (...args: Args): Result => {
      const key = JSON.stringify(args);

      const cached = cache.get(key);
      if (cached) return cached;

      const result = fn(...args);
      cache.set(key, result);
      return result;
   };
};

export function* repeat<T>(value: T): Generator<T> {
   while (true) {
      yield value;
   }
}

export function* repeatedly<T>(fn: () => T): Generator<T> {
   while (true) {
      yield fn();
   }
}

export const take = <T>(iterable: Iterable<T>, n: number): T[] => {
   if (n < 0) return [];

   const result: T[] = [];
   const iterator = iterable[Symbol.iterator]();
   for (let i = 0; i < n; i++) {
      const next = iterator.next();
      if (next.done) {
         break;
      }
      result.push(next.value);
   }
   return result;
};

export const isEmpty = <T>(
   n: T[] | Record<string, T> | string | undefined | null
): boolean => {
   if (n === undefined || n === null) return true;
   if (typeof n === 'string') return n.length === 0;
   if (Array.isArray(n)) return n.length === 0;
   return Object.keys(n).length === 0;
};
