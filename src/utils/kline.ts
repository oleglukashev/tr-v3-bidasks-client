export function direction(kline: any) {
  return parseFloat(kline.close) > parseFloat(kline.open) ? 'up' : 'down';
}

export function bodySizeByDiv(div: number, kline: any) {
  return Math.abs(parseFloat(kline.close) - parseFloat(kline.open) / div);
}
