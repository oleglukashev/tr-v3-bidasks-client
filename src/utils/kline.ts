function sortByPrice(array: any[], asc = true): any {
  return [...array].sort((a: any, b: any) => {
    return asc
      ? parseFloat(a.p) - parseFloat(b.p)
      : parseFloat(b.p) - parseFloat(a.p);
  });
}

export function direction(kline: any) {
  return parseFloat(kline.close) > parseFloat(kline.open) ? 'up' : 'down';
}

export function bodySizeByDiv(div: number, kline: any) {
  return Math.abs(parseFloat(kline.close) - parseFloat(kline.open) / div);
}

export function pocFromCluster(cluster: any) {
  return Object.entries(cluster.data).reduce((max, entry) => {
    const [, current]: any = entry;
    const [, maxValue]: any = max;
    return parseFloat(current.v) > parseFloat(maxValue.v) ? entry : max;
  })[1];
}

export function sortedClusterData(cluster: any, asc = true) {
  return sortByPrice(Object.values(cluster.data), asc);
}

export function delta(clusterPrice: any) {
  return (parseFloat(clusterPrice.bv) - parseFloat(clusterPrice.sv)).toString();
}
