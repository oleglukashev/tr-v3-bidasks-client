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

export function nowTs() {
  return moment().utc().valueOf();
}

export function startOfMinuteTs(ts: number | null) {
  return moment(ts).utc().startOf('minute').valueOf();
}

export function startOfHourTs() {
  return moment().utc().startOf('hour').valueOf();
}

export function startOfHourAgoTs() {
  return moment().utc().subtract(1, 'hour').startOf('hour').valueOf();
}

export function startOfMonthTs() {
  return moment().utc().startOf('month').valueOf();
}
