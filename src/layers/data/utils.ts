import {
  DataFrame,
  FieldConfig,
  formattedValueToString,
  getValueFormat,
  GrafanaTheme2,
  MatcherConfig,
  ThresholdsMode,
} from '@grafana/data';
import { VizLegendItem } from '@grafana/ui';

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
  // Dashboards saved before v1.4.5 stored the selected query as a bare refId.
  query: MatcherConfig | string | undefined
): DataFrame | undefined {
  const refId = typeof query === 'string' ? query : query?.options;
  if (refId) {
    return series?.find((frame) => frame.refId === refId);
  }
  return series?.[0];
}
