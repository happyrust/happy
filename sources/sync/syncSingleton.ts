/**
 * 提供从其它模块懒加载 sync 单例的工具，避免形成循环依赖。
 */

type SyncInstance = typeof import('./sync')['sync'];

let cachedSync: SyncInstance | null = null;
let syncPromise: Promise<SyncInstance> | null = null;

/**
 * 获取 sync 单例，必要时使用动态导入。
 */
export function getSync(): Promise<SyncInstance> {
    if (cachedSync) {
        return Promise.resolve(cachedSync);
    }
    if (!syncPromise) {
        syncPromise = import('./sync').then((module) => {
            cachedSync = module.sync;
            return cachedSync;
        });
    }
    return syncPromise;
}

/**
 * 获取已缓存的 sync，如果尚未加载则返回 null。
 */
export function getSyncSync(): SyncInstance | null {
    return cachedSync;
}
