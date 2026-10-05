import {
  DataFrame,
  FieldConfig,
  FrameMatcherID,
  formattedValueToString,
  getValueFormat,
  GrafanaTheme2,
  MatcherConfig,
  ThresholdsMode,
} from '@grafana/data';
import { VizLegendItem } from '@grafana/ui';
import type { DataQuery } from '@grafana/schema';
import { isEqual, omit } from 'lodash';
import { ExtendMapLayerOptions } from '../../extension';

export function getThresholdItems(fieldConfig: FieldConfig, theme: GrafanaTheme2): VizLegendItem[] {
  const items: VizLegendItem[] = [];
  const thresholds = fieldConfig.thresholds;
  if (!thresholds || !thresholds.steps.length) {
    return items;
  }

  const steps = thresholds.steps;
  const disp = getValueFormat(thresholds.mode === ThresholdsMode.Percentage ? 'percent' : (fieldConfig.unit ?? ''));

  const fmt = (v: number) => formattedValueToString(disp(v));

  for (let i = 1; i <= steps.length; i++) {
    const step = steps[i - 1];
    items.push({
      label: i === 1 ? `< ${fmt(step.value)}` : `${fmt(step.value)}+`,
      color: theme.visualization.getColorByName(step.color),
      yAxis: 1,
    });
  }

  return items;
}

/** The refId of the query a data layer has selected, if any. */
export function getSelectedRefId(query: MatcherConfig | string | undefined): string | undefined {
  // Dashboards saved before v1.4.5 stored the selected query as a bare refId.
  return typeof query === 'string' ? query : query?.options;
}

/**
 * Picks the frame a data layer draws.
 *
 * With a query selected that is the selected query's frame, or nothing when
 * that query returned no frame. Other queries are never substituted. With no
 * query selected it is the first frame, which also covers transformations such
 * as Merge that combine queries into one frame.
 */
export function getLayerFrame(
  series: DataFrame[] | undefined,
  query: MatcherConfig | string | undefined
): DataFrame | undefined {
  const refId = getSelectedRefId(query);
  if (refId) {
    return series?.find((frame) => frame.refId === refId);
  }
  return series?.[0];
}

/**
 * Maps each query renamed between two runs from its old refId to its new one.
 *
 * A query counts as renamed when it is at the same position and nothing but
 * its refId changed. That tells a rename apart from removing one query and
 * adding another, which also swaps a refId at the same position. A rename that
 * is combined with other edits to the query before it runs is not detected.
 */
export function findRenamedQueries(
  previous: DataQuery[] | undefined,
  current: DataQuery[] | undefined
): Map<string, string> {
  const renames = new Map<string, string>();
  if (!previous || !current || previous === current || previous.length !== current.length) {
    return renames;
  }
  previous.forEach((before, index) => {
    const after = current[index];
    if (before.refId !== after.refId && isEqual(omit(before, 'refId'), omit(after, 'refId'))) {
      renames.set(before.refId, after.refId);
    }
  });
  return renames;
}

/**
 * Points layers whose selected query was renamed at the new refId. Returns
 * undefined when no layer needed changing.
 */
export function retargetRenamedQueries(
  layers: ExtendMapLayerOptions[] | undefined,
  renames: Map<string, string>
): ExtendMapLayerOptions[] | undefined {
  if (!layers || !renames.size) {
    return undefined;
  }
  let changed = false;
  const result = layers.map((layer) => {
    const renamedTo = renames.get(getSelectedRefId(layer.query) ?? '');
    if (!renamedTo) {
      return layer;
    }
    changed = true;
    return { ...layer, query: { id: FrameMatcherID.byRefId, options: renamedTo } };
  });
  return changed ? result : undefined;
}
