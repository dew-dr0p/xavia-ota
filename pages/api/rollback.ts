import moment from 'moment';
import { NextApiRequest, NextApiResponse } from 'next';

import { DatabaseFactory } from '../../apiUtils/database/DatabaseFactory';
import { StorageFactory } from '../../apiUtils/storage/StorageFactory';

export default async function rollbackHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { path, runtimeVersion, platform, commitHash, commitMessage } = req.body;

  if (!path) {
    res.status(400).json({ error: 'Missing path' });
    return;
  }

  if (!runtimeVersion) {
    res.status(400).json({ error: 'Missing runtimeVersion' });
    return;
  }

  if (!platform) {
    res.status(400).json({ error: 'Missing platform' });
    return;
  }

  if (platform !== 'ios' && platform !== 'android' && platform !== 'all') {
    res.status(400).json({ error: 'Platform must be either ios, android, or all' });
    return;
  }

  if (!commitHash) {
    res.status(400).json({ error: 'Missing commitHash' });
    return;
  }

  try {
    const storage = StorageFactory.getStorage();

    const timestamp = moment().utc().format('YYYYMMDDHHmmss');
    const newPath = `updates/${runtimeVersion}/${platform}/${timestamp}.zip`;

    await storage.copyFile(path, newPath);

    await DatabaseFactory.getDatabase().createRelease({
      path: newPath,
      runtimeVersion,
      platform,
      timestamp: moment().utc().toString(),
      commitHash,
      commitMessage,
    });

    res.status(200).json({ success: true, newPath });
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: 'Rollback failed' });
  }
}
