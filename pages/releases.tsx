import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Heading,
  Button,
  Tag,
  HStack,
  IconButton,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  Flex,
  Tooltip,
} from '@chakra-ui/react';
import moment from 'moment';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SlRefresh } from 'react-icons/sl';
import { MdDelete } from 'react-icons/md';

import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { showToast } from '../components/toast';

interface Release {
  id: string | null;
  path: string;
  runtimeVersion: string;
  platform: string;
  timestamp: string;
  size: number;
  commitHash: string | null;
  commitMessage: string | null;
  downloadCount?: number;
}

export default function ReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [releaseToDelete, setReleaseToDelete] = useState<Release | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetchReleases();
  }, []);

  const fetchReleases = async () => {
    try {
      const response = await fetch('/api/releases');
      if (!response.ok) {
        throw new Error('Failed to fetch releases');
      }
      const data = await response.json();
      setReleases(data.releases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch releases');
    } finally {
      setLoading(false);
    }
  };

  // Determine which releases are active (most recent per platform + runtime version)
  // "all" platform releases are active when they serve as fallback (no platform-specific release exists)
  const activeReleases = useMemo(() => {
    const activeSet = new Set<string>();
    const grouped = new Map<string, Release[]>();

    // Group releases by runtimeVersion + platform
    releases.forEach((release) => {
      const key = `${release.runtimeVersion}:${release.platform}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(release);
    });

    // Find the most recent release for each platform + runtime version combination
    const runtimeVersions = new Set(releases.map((r) => r.runtimeVersion));

    runtimeVersions.forEach((runtimeVersion) => {
      const iosReleases = grouped.get(`${runtimeVersion}:ios`) || [];
      const androidReleases = grouped.get(`${runtimeVersion}:android`) || [];
      const allReleases = grouped.get(`${runtimeVersion}:all`) || [];

      // Mark most recent iOS release as active
      if (iosReleases.length > 0) {
        const sorted = [...iosReleases].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        activeSet.add(sorted[0].path);
      } else if (allReleases.length > 0) {
        // If no iOS-specific release, "all" serves as fallback for iOS
        const sorted = [...allReleases].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        activeSet.add(sorted[0].path);
      }

      // Mark most recent Android release as active
      if (androidReleases.length > 0) {
        const sorted = [...androidReleases].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        activeSet.add(sorted[0].path);
      } else if (allReleases.length > 0) {
        // If no Android-specific release, "all" serves as fallback for Android
        const sorted = [...allReleases].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        activeSet.add(sorted[0].path);
      }
    });

    return activeSet;
  }, [releases]);

  const sortedReleases = useMemo(() => {
    return [...releases].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [releases]);

  return (
    <ProtectedRoute>
      <Layout>
        <Box mx={4}>
          <Flex className="flex-col">
            <HStack>
              <Heading size="lg">Releases</Heading>
              <IconButton
                aria-label="Refresh"
                onClick={fetchReleases}
                variant="solid"
                // colorScheme="blue"
                size="md"
                icon={<SlRefresh />}
              />
            </HStack>

            {loading && <Text>Loading...</Text>}
            {error && <Text color="red.500">{error}</Text>}

            {!loading && !error && (
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Runtime Version</Th>
                    <Th>Platform</Th>
                    <Th>Downloads</Th>
                    <Th>Commit Hash</Th>
                    <Th>Commit Message</Th>
                    <Th>Timestamp (UTC)</Th>
                    <Th>File Size</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {sortedReleases.map((release, index) => (
                    <Tr key={index}>
                      <Td>{release.path}</Td>
                      <Td>{release.runtimeVersion}</Td>
                      <Td>
                        <Tag
                          colorScheme={
                            release.platform === 'ios'
                              ? 'blue'
                              : release.platform === 'android'
                              ? 'green'
                              : 'gray'
                          }>
                          {release.platform.toUpperCase()}
                        </Tag>
                      </Td>
                      <Td>{release.downloadCount ?? '-'}</Td>
                      <Td>
                        <Tooltip label={release.commitHash}>
                          <Text isTruncated w="10rem">
                            {release.commitHash}
                          </Text>
                        </Tooltip>
                      </Td>
                      <Td>
                        <Tooltip label={release.commitMessage}>
                          <Text isTruncated w="10rem">
                            {release.commitMessage}
                          </Text>
                        </Tooltip>
                      </Td>
                      <Td className="min-w-[14rem]">
                        {moment(release.timestamp).utc().format('MMM, Do  HH:mm')}
                      </Td>
                      <Td>{formatFileSize(release.size)}</Td>
                      <Td justifyItems="center">
                        <HStack spacing={2} wrap="wrap">
                          {activeReleases.has(release.path) ? (
                            <Tag size="lg" colorScheme="green">
                              Active Release
                            </Tag>
                          ) : (
                            <Button
                              variant="solid"
                              colorScheme="orange"
                              size="sm"
                              onClick={() => {
                                setIsOpen(true);
                                setSelectedRelease(release);
                              }}>
                              Rollback to this release
                            </Button>
                          )}
                          {release.id && (
                            <Tooltip label="Delete this update">
                              <IconButton
                                aria-label="Delete release"
                                icon={<MdDelete />}
                                size="sm"
                                colorScheme="red"
                                variant="outline"
                                onClick={() => {
                                  setReleaseToDelete(release);
                                  setDeleteDialogOpen(true);
                                }}
                              />
                            </Tooltip>
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Flex>

          <AlertDialog
            isOpen={isOpen}
            leastDestructiveRef={cancelRef}
            onClose={() => setIsOpen(false)}
            isCentered>
            <AlertDialogOverlay>
              <AlertDialogContent>
                <AlertDialogHeader fontSize="lg" fontWeight="bold">
                  Rollback Release
                </AlertDialogHeader>
                <AlertDialogBody>
                  Are you sure you want to rollback to this release?
                  <Tag size="lg" colorScheme="green" mt={4} padding={4} className="w-full">
                    <Text fontSize="sm">Commit Hash: {selectedRelease?.commitHash}</Text>
                  </Tag>
                  <Tag size="lg" colorScheme="orange" mt={4} padding={4}>
                    <Text fontSize="sm">
                      This will promote this release to be the active release with a new timestamp.
                    </Text>
                  </Tag>
                </AlertDialogBody>
                <AlertDialogFooter>
                  <Button ref={cancelRef} onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    colorScheme="red"
                    onClick={async () => {
                      if (!selectedRelease) return;
                      const response = await fetch('/api/rollback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          path: selectedRelease.path,
                          runtimeVersion: selectedRelease.runtimeVersion,
                          platform: selectedRelease.platform,
                          commitHash: selectedRelease.commitHash,
                          commitMessage: selectedRelease.commitMessage,
                        }),
                      });
                      if (!response.ok) throw new Error('Rollback failed');
                      showToast('Rollback successful', 'success');
                      fetchReleases();
                      setIsOpen(false);
                    }}
                    ml={3}>
                    Rollback
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>

          <AlertDialog
            isOpen={deleteDialogOpen}
            leastDestructiveRef={deleteCancelRef}
            onClose={() => setDeleteDialogOpen(false)}
            isCentered>
            <AlertDialogOverlay>
              <AlertDialogContent>
                <AlertDialogHeader fontSize="lg" fontWeight="bold">
                  Delete Update
                </AlertDialogHeader>
                <AlertDialogBody>
                  Are you sure you want to delete this update? This will remove the release from
                  storage and the database. Download tracking for this release will also be removed.
                  <Tag size="lg" colorScheme="red" mt={4} padding={4} className="w-full">
                    <Text fontSize="sm" noOfLines={2}>
                      {releaseToDelete?.path}
                    </Text>
                  </Tag>
                </AlertDialogBody>
                <AlertDialogFooter>
                  <Button ref={deleteCancelRef} onClick={() => setDeleteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    colorScheme="red"
                    onClick={async () => {
                      if (!releaseToDelete?.path) return;
                      try {
                        const response = await fetch('/api/releases', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ path: releaseToDelete.path }),
                        });
                        if (!response.ok) {
                          const err = await response.json();
                          throw new Error(err.error ?? 'Delete failed');
                        }
                        showToast('Update deleted successfully', 'success');
                        fetchReleases();
                        setDeleteDialogOpen(false);
                        setReleaseToDelete(null);
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
                      }
                    }}
                    ml={3}>
                    Delete
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>
        </Box>
      </Layout>
    </ProtectedRoute>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
