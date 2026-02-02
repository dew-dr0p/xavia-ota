import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseFactory } from '../../../apiUtils/database/DatabaseFactory';
import { getLogger } from '../../../apiUtils/logger';
import {
  ReleaseDownloadCount,
  TrackingMetrics,
} from '../../../apiUtils/database/DatabaseInterface';

const logger = getLogger('allTrackingHandler');

export interface AllTrackingResponse {
  trackings: TrackingMetrics[];
  totalReleases: number;
  perReleaseCounts: ReleaseDownloadCount[];
  latestReleaseDownloadsByPlatform: { ios: number; android: number };
}

export default async function allTrackingHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  logger.info('Fetching all tracking data for all releases');

  try {
    const database = DatabaseFactory.getDatabase();
    const [trackings, releases, perReleaseCounts] = await Promise.all([
      database.getReleaseTrackingMetricsForAllReleases(),
      database.listReleases(),
      database.getPerReleaseDownloadCounts(),
    ]);

    const countByReleaseId = new Map(perReleaseCounts.map((r) => [r.releaseId, r.count]));
    const byTimestampDesc = [...releases].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const latestIosRelease = byTimestampDesc.find(
      (r) => r.platform === 'ios' || r.platform === 'all'
    );
    const latestAndroidRelease = byTimestampDesc.find(
      (r) => r.platform === 'android' || r.platform === 'all'
    );
    const latestReleaseDownloadsByPlatform = {
      ios: latestIosRelease ? countByReleaseId.get(latestIosRelease.id) ?? 0 : 0,
      android: latestAndroidRelease ? countByReleaseId.get(latestAndroidRelease.id) ?? 0 : 0,
    };

    res.status(200).json({
      trackings,
      totalReleases: releases.length,
      perReleaseCounts,
      latestReleaseDownloadsByPlatform,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Failed to fetch tracking data' });
  }
}
