import moment from 'moment';
import { NextApiRequest, NextApiResponse } from 'next';

import { DatabaseFactory } from '../../apiUtils/database/DatabaseFactory';
import { StorageFactory } from '../../apiUtils/storage/StorageFactory';
import AdmZip from 'adm-zip';
import { ZipHelper } from '../../apiUtils/helpers/ZipHelper';
import { HashHelper } from '../../apiUtils/helpers/HashHelper';

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
    const database = DatabaseFactory.getDatabase();

    // Get the original release to extract updateId
    const originalRelease = await database.getReleaseByPath(path);
    let updateId: string | undefined;

    if (originalRelease?.updateId) {
      // Use the updateId from the database if available
      updateId = originalRelease.updateId;
    } else {
      // Fallback: extract updateId from the zip file metadata
      try {
        const zipContent = await storage.downloadFile(path);
        const zipFolder = new AdmZip(zipContent);
        const metadataJsonFile = await ZipHelper.getFileFromZip(zipFolder, 'metadata.json');
        const updateHash = HashHelper.createHash(metadataJsonFile, 'sha256', 'hex');
        updateId = HashHelper.convertSHA256HashToUUID(updateHash);
      } catch (error) {
        console.warn('Could not extract updateId from zip file:', error);
        // Continue without updateId if extraction fails
      }
    }

    const timestamp = moment().utc().format('YYYYMMDDHHmmss');
    const newPath = `updates/${runtimeVersion}/${platform}/${timestamp}.zip`;

    await storage.copyFile(path, newPath);

    await database.createRelease({
      path: newPath,
      runtimeVersion,
      platform,
      timestamp: moment().utc().toString(),
      commitHash,
      commitMessage,
      updateId,
    });

    res.status(200).json({ success: true, newPath });
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: 'Rollback failed' });
  }
}
