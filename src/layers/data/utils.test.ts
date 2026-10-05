import { DataFrame, FrameMatcherID, toDataFrame } from '@grafana/data';
import { findRenamedQueries, getLayerFrame, retargetRenamedQueries } from './utils';

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

describe('findRenamedQueries', () => {
  const query = (refId: string, rawSql: string) => ({ refId, rawSql, datasource: { uid: 'pg' } });

  it('detects a query renamed in place', () => {
    const renames = findRenamedQueries([query('A', 'a'), query('B', 'b')], [query('A', 'a'), query('D', 'b')]);
    expect([...renames]).toEqual([['B', 'D']]);
  });

  it('does not mistake removing a query and adding another for a rename', () => {
    const renames = findRenamedQueries([query('A', 'a'), query('B', 'b')], [query('A', 'a'), query('C', 'new')]);
    expect(renames.size).toBe(0);
  });

  it('does not mistake reordering for renaming', () => {
    const renames = findRenamedQueries([query('A', 'a'), query('B', 'b')], [query('B', 'b'), query('A', 'a')]);
    expect(renames.size).toBe(0);
  });

  it('ignores added or removed queries', () => {
    expect(findRenamedQueries([query('A', 'a')], [query('A', 'a'), query('B', 'b')]).size).toBe(0);
    expect(findRenamedQueries(undefined, [query('A', 'a')]).size).toBe(0);
  });
});

describe('retargetRenamedQueries', () => {
  const renames = new Map([['B', 'D']]);
  const italy = { type: 'markers', name: 'Italy', query: byRefId('A') };
  const france = { type: 'markers', name: 'France', query: byRefId('B') };

  it('points layers at the renamed query and leaves the others alone', () => {
    const result = retargetRenamedQueries([italy, france], renames)!;
    expect(result[0]).toBe(italy);
    expect(result[1]).toEqual({ ...france, query: byRefId('D') });
  });

  it('upgrades a bare refId from dashboards saved before v1.4.5', () => {
    const legacy = { type: 'markers', query: 'B' as any };
    expect(retargetRenamedQueries([legacy], renames)![0].query).toEqual(byRefId('D'));
  });

  it('returns undefined when no layer used the renamed query', () => {
    expect(retargetRenamedQueries([italy], renames)).toBeUndefined();
    expect(retargetRenamedQueries([italy, france], new Map())).toBeUndefined();
  });
});
