/**
 * Argon2id password hashing.
 *
 * Prefers @node-rs/argon2 (napi-rs, ships abi-neutral prebuilds for every
 * Electron/Node target — no node-gyp at install time, so cross-building the
 * Windows installer from a Mac works). Falls back to node-argon2 if the
 * @node-rs variant isn't installed yet, so existing dev machines keep
 * working until the next `npm install`.
 *
 * Both libraries produce and consume the standard argon2 PHC string, so
 * hashes made by one verify correctly under the other.
 */

const OPTIONS = {
  memoryCost: 2 ** 16, // 64 MiB
  timeCost: 3,
  parallelism: 1,
} as const;

interface ArgonImpl {
  hash: (plain: string) => Promise<string>;
  verify: (hash: string, plain: string) => Promise<boolean>;
}

function loadImpl(): ArgonImpl {
  // 1. Try the Rust implementation first (preferred, cross-build friendly).
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ns: any = require('@node-rs/argon2');
    const algorithm = ns.Algorithm?.Argon2id ?? 2;
    return {
      hash: (plain) => ns.hash(plain, { ...OPTIONS, algorithm }),
      verify: (hash, plain) => ns.verify(hash, plain),
    };
  } catch {
    // fall through
  }

  // 2. Fall back to node-argon2 (C-based, needs node-gyp for rebuilds).
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ns: any = require('argon2');
    return {
      hash: (plain) =>
        ns.hash(plain, {
          type: ns.argon2id,
          memoryCost: OPTIONS.memoryCost,
          timeCost: OPTIONS.timeCost,
          parallelism: OPTIONS.parallelism,
        }),
      verify: (hash, plain) => ns.verify(hash, plain),
    };
  } catch {
    throw new Error(
      'No argon2 implementation found. Install either @node-rs/argon2 (recommended) or argon2.',
    );
  }
}

let cached: ArgonImpl | null = null;
function impl(): ArgonImpl {
  if (!cached) cached = loadImpl();
  return cached;
}

export async function hashPassword(plain: string): Promise<string> {
  return impl().hash(plain);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await impl().verify(hash, plain);
  } catch {
    return false;
  }
}
