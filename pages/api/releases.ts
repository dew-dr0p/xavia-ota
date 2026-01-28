import { NextApiRequest, NextApiResponse } from 'next';

import { DatabaseFactory } from '../../apiUtils/database/DatabaseFactory';
import { StorageFactory } from '../../apiUtils/storage/StorageFactory';

export default async function releasesHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const storage = StorageFactory.getStorage();
    const runtimeVersionDirs = await storage.listDirectories('updates/');

    const releasesWithCommitHash = await DatabaseFactory.getDatabase().listReleases();

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
          releases.push({
            path: release?.path || `${folderPath}/${file.name}`,
            runtimeVersion,
            platform,
            // FIX: Use database timestamp instead of storage file timestamp
            timestamp: release?.timestamp || file.created_at,
            size: file.metadata.size,
            commitHash,
            commitMessage: release?.commitMessage,
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