import { Union } from './union';

export interface ResultMethods<T, E> {
   isOk(): this is Ok<T, E>;
   isErr(): this is Err<E, T>;
   map<U>(fn: (value: T) => U): Result<U, E>;
   orElse(defaultValue: T): T;
   orElseCall(fn: () => T): T;
   orElseMaybe(defaultValue: T | undefined): T | undefined;
}

/**
 * Result is a discriminated union of Ok and Err, with method chaining support.
 * It uses the Union helper to ensure consistent { tag, value } shape.
 */
export type Result<T, E> = Union<{
   ok: T;
   err: E;
}> &
   ResultMethods<T, E>;

export type Ok<T, E = never> = { tag: 'ok'; value: T } & ResultMethods<T, E>;
export type Err<E, T = never> = { tag: 'err'; value: E } & ResultMethods<T, E>;

class ResultImpl<T, E> implements ResultMethods<T, E> {
   constructor(
      public readonly tag: 'ok' | 'err',
      public readonly value: T | E
   ) {}

   isOk(): this is Ok<T, E> {
      return this.tag === 'ok';
   }

   isErr(): this is Err<E, T> {
      return this.tag === 'err';
   }

   map<U>(fn: (value: T) => U): Result<U, E> {
      if (this.isOk()) {
         return Ok(fn(this.value as T));
      }
      return Err(this.value as E) as unknown as Result<U, E>;
   }

   orElse(defaultValue: T): T {
      return this.isOk() ? (this.value as T) : defaultValue;
   }

   orElseCall(fn: () => T): T {
      return this.isOk() ? (this.value as T) : fn();
   }

   orElseMaybe(defaultValue: T | undefined): T | undefined {
      return this.isOk() ? (this.value as T) : defaultValue;
   }
}

/* --- Constructors --- */

export const Ok = <T>(value: T): Result<T, never> =>
   new ResultImpl<T, never>('ok', value) as Result<T, never>;

export const Err = <E>(error: E): Result<never, E> =>
   new ResultImpl<never, E>('err', error) as Result<never, E>;

/* --- Functional API (delegates to methods) --- */

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T, E> => r.isOk();
export const isErr = <T, E>(r: Result<T, E>): r is Err<E, T> => r.isErr();

export const map = <T, E, U>(
   r: Result<T, E>,
   fn: (value: T) => U
): Result<U, E> => r.map(fn);

export const orElse = <T, E>(r: Result<T, E>, defaultValue: T): T =>
   r.orElse(defaultValue);

export const orElseCall = <T, E>(r: Result<T, E>, fn: () => T): T =>
   r.orElseCall(fn);

export const orElseMaybe = <T, E>(
   r: Result<T, E>,
   defaultValue: T | undefined
): T | undefined => r.orElseMaybe(defaultValue);

export const tryCatch = <T, E = Error>(fn: () => T): Result<T, E> => {
   try {
      return Ok(fn());
   } catch (e) {
      return Err(e as E);
   }
};

export const tryCatchAsync = async <T, E = Error>(
   fn: () => Promise<T>
): Promise<Result<T, E>> => {
   try {
      const v = await fn();
      return Ok(v);
   } catch (e) {
      return Err(e as E);
   }
};

export const collectOk = <T, E>(results: Result<T, E>[]): T[] =>
   results.filter((r): r is Ok<T, E> => r.isOk()).map((r) => r.value);

export default {
   Ok,
   Err,
   isOk,
   isErr,
   map,
   orElse,
};
