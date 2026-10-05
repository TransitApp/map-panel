// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),

  // Jest 29 cannot write inline snapshots through Prettier 3 (it needs Prettier's
  // removed sync API). Opting out lets `jest -u` update them unformatted.
  // https://jestjs.io/docs/configuration/#prettierpath-string
  prettierPath: null,
};
