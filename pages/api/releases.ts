import { NextApiRequest, NextApiResponse } from 'next';

import { DatabaseFactory } from '../../apiUtils/database/DatabaseFactory';
import { StorageFactory } from '../../apiUtils/storage/StorageFactory';

export default async function releasesHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'DELETE') {
    const { path: releasePath } = typeof req.body === 'object' && req.body !== null ? req.body : {};
    if (!releasePath || typeof releasePath !== 'string') {
      res.status(400).json({ error: 'Missing or invalid path' });
      return;
    }
    try {
      const database = DatabaseFactory.getDatabase();
      const release = await database.getReleaseByPath(releasePath);
      if (!release) {
        res.status(404).json({ error: 'Release not found' });
        return;
      }
      const storage = StorageFactory.getStorage();
      if (await storage.fileExists(releasePath)) {
        await storage.deleteFile(releasePath);
      }
      await database.deleteRelease(release.id);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to delete release:', error);
      res.status(500).json({ error: 'Failed to delete release' });
    }
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const database = DatabaseFactory.getDatabase();
    const storage = StorageFactory.getStorage();
    const runtimeVersionDirs = await storage.listDirectories('updates/');

    const [releasesWithCommitHash, perReleaseCounts] = await Promise.all([
      database.listReleases(),
      database.getPerReleaseDownloadCounts(),
    ]);
    const countByReleaseId = new Map(perReleaseCounts.map((r) => [r.releaseId, r.count]));

    const releases = [];
    for (const runtimeVersion of runtimeVersionDirs) {
      const platformDirs = await storage.listDirectories(`updates/${runtimeVersion}/`);

      for (const platform of platformDirs) {
        const folderPath = `updates/${runtimeVersion}/${platform}`;
        const files = await storage.listFiles(folderPath);

        for (const file of files) {
          const release = releasesWithCommitHash.find(
            (r) => r.path === `${folderPath}/${file.name}`
          );
          const commitHash = release ? release.commitHash : null;
          const id = release?.id ?? null;
          releases.push({
            id,
            path: release?.path || `${folderPath}/${file.name}`,
            runtimeVersion,
            platform,
            // FIX: Use database timestamp instead of storage file timestamp
            timestamp: release?.timestamp || file.created_at,
            size: file.metadata.size,
            commitHash,
            commitMessage: release?.commitMessage,
            downloadCount: id ? countByReleaseId.get(id) ?? 0 : 0,
          });
        }
      }
    }

    res.status(200).json({ releases });
  } catch (error) {
    console.error('Failed to fetch releases:', error);
    res.status(500).json({ error: 'Failed to fetch releases' });
  }
}