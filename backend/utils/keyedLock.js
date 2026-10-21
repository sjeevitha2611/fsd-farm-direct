const lockTails = new Map()

export async function withKeyedLock(key, operation) {
  const previous = lockTails.get(key) ?? Promise.resolve()
  let release
  const current = new Promise((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => current)
  lockTails.set(key, tail)

  await previous
  try {
    return await operation()
  } finally {
    release()
    if (lockTails.get(key) === tail) {
      lockTails.delete(key)
    }
  }
}
