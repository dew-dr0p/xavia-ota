import { createMocks } from 'node-mocks-http';

import { DatabaseFactory } from '../apiUtils/database/DatabaseFactory';
import { StorageFactory } from '../apiUtils/storage/StorageFactory';
import releasesHandler from '../pages/api/releases';

jest.mock('../apiUtils/database/DatabaseFactory');
jest.mock('../apiUtils/storage/StorageFactory');

describe('Releases API DELETE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 405 for non-GET, non-DELETE requests', async () => {
    const { req, res } = createMocks({ method: 'PATCH' });
    await releasesHandler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('should return 400 for DELETE with missing path', async () => {
    const mockDatabase = { getReleaseByPath: jest.fn() };
    (DatabaseFactory.getDatabase as jest.Mock).mockReturnValue(mockDatabase);

    const { req, res } = createMocks({
      method: 'DELETE',
      body: {},
    });
    await releasesHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Missing or invalid path' });
    expect(mockDatabase.getReleaseByPath).not.toHaveBeenCalled();
  });

  it('should return 404 when release not found', async () => {
    const mockDatabase = {
      getReleaseByPath: jest.fn().mockResolvedValue(null),
    };
    (DatabaseFactory.getDatabase as jest.Mock).mockReturnValue(mockDatabase);

    const { req, res } = createMocks({
      method: 'DELETE',
      body: { path: 'updates/1.0.0/ios/missing.zip' },
    });
    await releasesHandler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });

  it('should delete release successfully', async () => {
    const mockStorage = {
      fileExists: jest.fn().mockResolvedValue(true),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const mockDatabase = {
      getReleaseByPath: jest.fn().mockResolvedValue({
        id: 'release-uuid',
        path: 'updates/1.0.0/ios/update.zip',
      }),
      deleteRelease: jest.fn().mockResolvedValue(undefined),
    };
    (StorageFactory.getStorage as jest.Mock).mockReturnValue(mockStorage);
    (DatabaseFactory.getDatabase as jest.Mock).mockReturnValue(mockDatabase);

    const { req, res } = createMocks({
      method: 'DELETE',
      body: { path: 'updates/1.0.0/ios/update.zip' },
    });
    await releasesHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ success: true });
    expect(mockStorage.deleteFile).toHaveBeenCalledWith('updates/1.0.0/ios/update.zip');
    expect(mockDatabase.deleteRelease).toHaveBeenCalledWith('release-uuid');
  });

  it('should succeed when file does not exist in storage', async () => {
    const mockStorage = {
      fileExists: jest.fn().mockResolvedValue(false),
      deleteFile: jest.fn(),
    };
    const mockDatabase = {
      getReleaseByPath: jest.fn().mockResolvedValue({
        id: 'release-uuid',
        path: 'updates/1.0.0/ios/update.zip',
      }),
      deleteRelease: jest.fn().mockResolvedValue(undefined),
    };
    (StorageFactory.getStorage as jest.Mock).mockReturnValue(mockStorage);
    (DatabaseFactory.getDatabase as jest.Mock).mockReturnValue(mockDatabase);

    const { req, res } = createMocks({
      method: 'DELETE',
      body: { path: 'updates/1.0.0/ios/update.zip' },
    });
    await releasesHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockStorage.deleteFile).not.toHaveBeenCalled();
    expect(mockDatabase.deleteRelease).toHaveBeenCalledWith('release-uuid');
  });
});
