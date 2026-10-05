import { DataFrame, FrameMatcherID, toDataFrame } from '@grafana/data';
import { getLayerFrame } from './utils';

// SQL data sources put `meta` on every frame. The layers used to treat any
// frame with `meta` as matching, so every layer drew the first query.
const frame = (refId: string): DataFrame =>
  toDataFrame({ refId, meta: { executedQueryString: `select ${refId}` }, fields: [{ name: 'lat', values: [1] }] });

const A = frame('A');
const B = frame('B');
const byRefId = (refId: string) => ({ id: FrameMatcherID.byRefId, options: refId });

describe('getLayerFrame', () => {
  it('returns the selected query even when it is not the first frame', () => {
    expect(getLayerFrame([A, B], byRefId('B'))).toBe(B);
  });

  it('never substitutes another query when the selected one has no frame', () => {
    expect(getLayerFrame([A], byRefId('B'))).toBeUndefined();
  });

  it('uses the first frame when no query is selected', () => {
    expect(getLayerFrame([A, B], undefined)).toBe(A);
  });

  it('accepts the bare refId stored by dashboards from before v1.4.5', () => {
    expect(getLayerFrame([A, B], 'B')).toBe(B);
  });

  it('handles missing series', () => {
    expect(getLayerFrame(undefined, byRefId('A'))).toBeUndefined();
    expect(getLayerFrame([], undefined)).toBeUndefined();
  });
});
