// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),

  // OpenLayers and much of its dependency tree only ship ES modules. The
  // scaffold's list covers `ol` itself but none of these, which the `ol/source`
  // barrel export pulls in.
  transformIgnorePatterns: [
    nodeModulesToTransform([
      ...grafanaESModules,
      'ol-ext',
      'rbush',
      'quickselect',
      'earcut',
      'pbf',
      'quick-lru',
      'zarrita',
      '@zarrita/storage',
      'numcodecs',
      'reference-spec-reader',
      'unzipit',
    ]),
  ],

  // Jest 29 cannot write inline snapshots through Prettier 3 (it needs Prettier's
  // removed sync API). Opting out lets `jest -u` update them unformatted.
  // https://jestjs.io/docs/configuration/#prettierpath-string
  prettierPath: null,
};
