import mime from 'mime';
import { NextApiRequest, NextApiResponse } from 'next';

import { UpdateHelper } from '../../apiUtils/helpers/UpdateHelper';
import { ZipHelper } from '../../apiUtils/helpers/ZipHelper';

export default async function assetsEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const { asset: assetPath, runtimeVersion, platform } = req.query;

  if (!assetPath || typeof assetPath !== 'string') {
    res.statusCode = 400;
    res.json({ error: 'No asset path provided.' });
    return;
  }

  if (platform !== 'ios' && platform !== 'android') {
    res.statusCode = 400;
    res.json({ error: 'No platform provided. Expected "ios" or "android".' });
    return;
  }

  if (!runtimeVersion || typeof runtimeVersion !== 'string') {
    res.statusCode = 400;
    res.json({ error: 'No runtimeVersion provided.' });
    return;
  }

  try {
    const updateBundlePath = await UpdateHelper.getLatestUpdateBundlePathForRuntimeVersionAsync(
      runtimeVersion as string,
      platform as string
    );
    const zip = await ZipHelper.getZipFromStorage(updateBundlePath);

    const { metadataJson } = await UpdateHelper.getMetadataAsync({
      updateBundlePath,
      runtimeVersion: runtimeVersion as string,
    });

    const isLaunchAsset = metadataJson.fileMetadata[platform].bundle === assetPath;
    const assetMetadata = metadataJson.fileMetadata[platform].assets?.find(
      (asset: any) => asset.path === assetPath
    );

    const asset = await ZipHelper.getFileFromZip(zip, assetPath as string);

    // Resolve MIME type with a safe fallback
    const ext = assetMetadata?.ext || assetPath.split('.').pop() || '';
    const contentType = isLaunchAsset
      ? 'application/javascript'
      : mime.getType(ext) || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('content-type', contentType);
    res.end(asset);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.json({ error: (error as Error).message });
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
};