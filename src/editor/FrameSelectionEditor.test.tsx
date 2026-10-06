import React from 'react';
import { render, screen } from '@testing-library/react';
import { DataFrame, FrameMatcherID, MatcherConfig, toDataFrame } from '@grafana/data';
import { FrameSelectionEditor } from './FrameSelectionEditor';

const frame = (refId: string): DataFrame => toDataFrame({ refId, fields: [{ name: 'lat', values: [1] }] });
const byRefId = (refId: string): MatcherConfig => ({ id: FrameMatcherID.byRefId, options: refId });

function setup(value: MatcherConfig | undefined, data: DataFrame[]) {
  const onChange = jest.fn();
  const ui = (v: MatcherConfig | undefined, d: DataFrame[]) => (
    <FrameSelectionEditor value={v!} onChange={onChange} context={{ data: d }} item={{} as any} />
  );
  const { rerender } = render(ui(value, data));
  return { onChange, rerender: (d: DataFrame[], v = value) => rerender(ui(v, d)) };
}

describe('FrameSelectionEditor', () => {
  it('keeps a renamed query selected and flags it, rather than picking another', () => {
    const { onChange, rerender } = setup(byRefId('B'), [frame('A'), frame('B')]);
    rerender([frame('A'), frame('D')]);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Query: B (no data)')).toBeInTheDocument();
  });

  it('keeps the selection when its query returns no frame', () => {
    const { onChange, rerender } = setup(byRefId('B'), [frame('A'), frame('B')]);
    rerender([frame('A')]);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Query: B (no data)')).toBeInTheDocument();
  });

  it('shows a bare refId from dashboards saved before v1.4.5', () => {
    setup('B' as unknown as MatcherConfig, [frame('A'), frame('B')]);
    expect(screen.getByText('Query: B (size: 1)')).toBeInTheDocument();
  });
});
