import SunCalc from 'suncalc';

export interface SunTimes {
  dawn: Date;
  sunrise: Date;
  goldenHourMorningEnd: Date;
  goldenHourEveningStart: Date;
  sunset: Date;
  dusk: Date;
}

export function getSunTimes(date: Date, lat: number, lon: number): SunTimes {
  const times = SunCalc.getTimes(date, lat, lon);
  return {
    dawn: times.dawn,
    sunrise: times.sunrise,
    goldenHourMorningEnd: times.goldenHourEnd,
    goldenHourEveningStart: times.goldenHour,
    sunset: times.sunset,
    dusk: times.dusk,
  };
}
