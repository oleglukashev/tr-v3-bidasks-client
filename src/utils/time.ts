import moment from 'moment';

export const msInHour = 3600000;

export function nowTs() {
  return moment().utc().valueOf();
}

export function startOfMinuteTs() {
  return moment().utc().startOf('minute').valueOf();
}

export function startOfHourTs() {
  return moment().utc().startOf('hour').valueOf();
}

export function startOfMonthTs() {
  return moment().utc().startOf('month').valueOf();
}
