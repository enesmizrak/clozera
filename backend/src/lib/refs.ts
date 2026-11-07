import { Types } from 'mongoose'

/** A Mongoose reference that may or may not be populated. */
export type Ref<T> = Types.ObjectId | (T & { _id: Types.ObjectId }) | null | undefined

export function isPopulated<T>(ref: Ref<T>): ref is T & { _id: Types.ObjectId } {
  return ref != null && !(ref instanceof Types.ObjectId)
}

export function refId(ref: Ref<unknown> | string): string | null {
  if (ref == null) return null
  if (typeof ref === 'string') return ref
  return String(ref instanceof Types.ObjectId ? ref : ref._id)
}
