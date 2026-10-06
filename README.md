# Multi-Layer Map

> **A fork of the [Orchestra Cities Map Panel](https://github.com/orchestracities/map-panel).**
> The original plugin was written by Orchestra Cities, and all credit for it goes
> to its authors. That project is no longer maintained. TransitApp has modified
> this fork since October 2026: it runs on current Grafana (12.3 and later) and
> adds layer reordering, per-layer query handling and other fixes; see the
> [changelog](https://github.com/TransitApp/map-panel/blob/main/CHANGELOG.md). It remains licensed under the [AGPL-3.0](https://github.com/TransitApp/map-panel/blob/main/LICENSE).
>
> **Maintenance:** TransitApp maintains this fork for its own use. Issues and pull
> requests are welcome and handled on a best-effort basis.

This plugin extends [Grafana Geomap](https://grafana.com/docs/grafana/latest/visualizations/geomap/)
panel with several functionalities:

* Support for GeoJSON shapes
* Support for icons (icons supported are from [FontAwesome](https://fontawesome.com/))
* Support for pop up visualizations of data from a specific point
* Multiple layers for the different queries
* A new map layer leveraging [Inverse distance weighting](https://en.wikipedia.org/wiki/Inverse_distance_weighting)
  (IDW) interpolation for scattered data points using Shepard's method.

![Marker layer](https://github.com/TransitApp/map-panel/raw/main/example.png)

![IDW layer](https://github.com/TransitApp/map-panel/raw/main/example4.png)


New customization options available for the markers layer:

* Cluster support with a lot of customization like distance and value to display
* A fully customizable pin with the possibility to change colors, shapes and sizes
* The possibility to select which properties to be displayed on the popup

![Marker layer options](https://github.com/TransitApp/map-panel/raw/main/example2.png)

Cluster options:

* Distance
* Min distance

Pin Options:

* Shape
* Size
* Customizable icon
* Shadow
* Gradient

Popup Options:

* Display a title
* Display the Timestamp
* Selectable properties

![Marker layer options](https://github.com/TransitApp/map-panel/raw/main/example3.png)

Options available for the IDW layer:

IDW options:

* Weight value to be used to create the interpolation,
  including min and max range
* Scale factor of the precision of the interpolation
* Show data values over the map

Pupup Options:

* Display a title
* Display the Timestamp
* Selectable properties


![Marker layer options](https://github.com/TransitApp/map-panel/raw/main/example5.png)

It requires Grafana 12.3 or later.

## Installation

The plugin is not in Grafana's plugin catalog and is not signed. Grafana
installs it from the zip attached to each
[GitHub release](https://github.com/TransitApp/map-panel/releases), and has to be
told to allow it. With the
[Grafana Helm chart](https://github.com/grafana-community/helm-charts/tree/main/charts/grafana):

```yaml
plugins:
  - transitapp-map-panel@2.0.0@https://github.com/TransitApp/map-panel/releases/download/v2.0.0/transitapp-map-panel-2.0.0.zip
grafana.ini:
  plugins:
    allow_loading_unsigned_plugins: transitapp-map-panel
```

The version in the entry decides which release is installed; change it to
upgrade. Without Helm, set `GF_PLUGINS_PREINSTALL_SYNC` to the same
`id@version@url` value and `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` to the
plugin ID.

## Migrating from the Orchestra Cities Map Panel

The plugin ID changed from `orchestracities-map-panel` to `transitapp-map-panel`.
Panel options are unchanged, so migrating a dashboard means changing the `type`
of each map panel in its JSON:

```diff
-  "type": "orchestracities-map-panel",
+  "type": "transitapp-map-panel",
```

Until a dashboard is migrated, its map panels stay blank, with a red error badge
that reads "Plugin orchestracities-map-panel not found".

## Usage with PostGis

To use the plugin with PostGis, you need either to query longitude and latitude from a stored `Point`, e.g.:
* `ST_X(ST_GeomFromEWKT(location_centroid)) AS \"longitude\"`
* `ST_Y(ST_GeomFromEWKT(location_centroid)) AS \"latitude\"`

Or query the GeoJSON shape, e.g.:
* `ST_AsGeoJSON(ST_GeomFromEWKT(location)) AS \"geojson\"`

## Usage with CrateDB

To use the plugin with CrateDB, you need either to query longitude and latitude from a stored `Point`, e.g.:
* `longitude(location_centroid) AS \"longitude\"`
* `latitude(location_centroid) AS \"latitude\"`

Or query the GeoJSON field, e.g.:
* `location AS \"geojson\"`

## What is a Grafana Panel Plugin?

Panels are the building blocks of Grafana. They allow you to visualize data in different ways. While Grafana has several types of panels already built-in, you can also build your own panel, to add support for other visualizations.

For more information about panels, refer to the documentation on [Panels](https://grafana.com/docs/grafana/latest/features/panels/panels/)

## Set up dev environment

See [Contributing](https://github.com/TransitApp/map-panel/blob/main/CONTRIBUTING.md).
