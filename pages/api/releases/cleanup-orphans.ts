import { NextApiRequest, NextApiResponse } from 'next';

import { DatabaseFactory } from '../../../apiUtils/database/DatabaseFactory';
import { StorageFactory } from '../../../apiUtils/storage/StorageFactory';
import { getLogger } from '../../../apiUtils/logger';

const logger = getLogger('cleanupOrphanReleases');

export default async function cleanupOrphansHandler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const database = DatabaseFactory.getDatabase();
    const storage = StorageFactory.getStorage();

    const allReleases = await database.listReleases();
    const knownPaths = new Set(allReleases.map((r) => r.path));

    const removed: string[] = [];
    const kept: string[] = [];
    const errors: { path: string; error: string }[] = [];

    const runtimeVersionDirs = await storage.listDirectories('updates/');

    for (const runtimeVersion of runtimeVersionDirs) {
      const platformDirs = await storage.listDirectories(`updates/${runtimeVersion}/`);

      for (const platform of platformDirs) {
        const folderPath = `updates/${runtimeVersion}/${platform}`;
        const files = await storage.listFiles(folderPath);

        for (const file of files) {
          // Only consider update bundles
          if (!file.name.endsWith('.zip')) {
            continue;
          }

          const fullPath = `${folderPath}/${file.name}`;

          if (knownPaths.has(fullPath)) {
            kept.push(fullPath);
            continue;
          }

          try {
            await storage.deleteFile(fullPath);
            removed.push(fullPath);
          } catch (err: any) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn('Failed to delete orphaned release file', { path: fullPath, error: msg });
            errors.push({ path: fullPath, error: msg });
          }
        }
      }
    }

    res.status(200).json({
      removedCount: removed.length,
      keptCount: kept.length,
      removed,
      errors,
    });
  } catch (error) {
    logger.error('Failed to cleanup orphan releases', { error });
    res.status(500).json({ error: 'Failed to cleanup orphan releases' });
  }
}

