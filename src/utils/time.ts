import moment from 'moment';

export const msInMinute = 60000;
export const msInHour = 60 * msInMinute;

export function getStartTsByTf(ts: number, tf: number) {
  if (!ts) {
    return null;
  }
  const time = moment(ts);
  return moment(time)
    .minutes(Math.floor(time.minutes() / tf) * tf)
    .seconds(0)
    .milliseconds(0)
    .utc()
    .valueOf();
}
