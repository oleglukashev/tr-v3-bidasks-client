export function getClusterKeyByPairIdTsTf(
  pairId: number,
  tf: number,
  ts: number,
) {
  return `clusters:pairId_${pairId}:tf_${tf}:startTs_${ts}`;
}

export async function getCluster(key: string, redis: any) {
  const res: any = await redis.get(key);
  if (res) {
    return JSON.parse(res);
  } else {
    return null;
  }
}

export async function saveCluster(key: string, cluster: any, redis: any) {
  return redis.set(key, JSON.stringify(cluster));
}
