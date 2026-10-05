import React, { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ExtendMapLayerOptions } from 'extension';
import { DataLayersEditor, moveByListPosition } from './DataLayersEditor';

// The per-layer form needs Grafana's option editor registry, which only exists
// inside a running Grafana. These tests are about the list around it.
jest.mock('./LayerEditor', () => ({
  LayerEditor: ({ options }: { options: { name: string } }) => <div>{options.name} editor</div>,
}));

// Render order: A is drawn first, so C ends up on top of the map.
const A = { type: 'markers', name: 'A' };
const B = { type: 'markers', name: 'B' };
const C = { type: 'markers', name: 'C' };

describe('moveByListPosition', () => {
  // The list shows the topmost layer first: C, B, A.
  it('moves the top of the list to the bottom', () => {
    expect(moveByListPosition([A, B, C], 0, 2)).toEqual([C, A, B]);
  });

  it('moves the bottom of the list to the top', () => {
    expect(moveByListPosition([A, B, C], 2, 0)).toEqual([B, C, A]);
  });

  it('swaps neighbours', () => {
    expect(moveByListPosition([A, B, C], 1, 0)).toEqual([A, C, B]);
    expect(moveByListPosition([A, B, C], 1, 2)).toEqual([B, A, C]);
  });

  it('leaves the input untouched', () => {
    const layers = [A, B, C];
    moveByListPosition(layers, 0, 2);
    expect(layers).toEqual([A, B, C]);
  });
});

describe('DataLayersEditor', () => {
  const changes: ExtendMapLayerOptions[][] = [];

  function Harness({ initial }: { initial: ExtendMapLayerOptions[] }) {
    const [layers, setLayers] = useState(initial);
    return (
      <DataLayersEditor
        value={layers}
        onChange={(next) => {
          changes.push(next!);
          setLayers(next!);
        }}
        context={{ data: [] }}
        item={{} as any}
      />
    );
  }

  const listedLabels = () =>
    screen.getAllByRole('button', { name: /^Drag to reorder/ }).map((h) => h.getAttribute('aria-label'));

  beforeEach(() => {
    changes.length = 0;
  });

  it('lists the topmost layer first', () => {
    render(<Harness initial={[A, B, C]} />);
    expect(listedLabels()).toEqual(['Drag to reorder C layer', 'Drag to reorder B layer', 'Drag to reorder A layer']);
  });

  it('reorders with the keyboard and keeps each section open state with its layer', async () => {
    render(<Harness initial={[A, B, C]} />);

    // Open the section for C, at the top of the list.
    fireEvent.click(screen.getByText('C layer'));
    const sectionOpen = (label: string) =>
      within(screen.getByText(label).parentElement!)
        .getByRole('button', { hidden: true })
        .getAttribute('aria-expanded');
    expect(sectionOpen('C layer')).toBe('true');
    expect(sectionOpen('B layer')).toBe('false');

    // Lift C, move it down one place, drop it.
    const handle = screen.getByRole('button', { name: 'Drag to reorder C layer' });
    handle.focus();
    await act(async () => {
      fireEvent.keyDown(handle, { key: ' ', code: 'Space', keyCode: 32 });
    });
    await act(async () => {
      fireEvent.keyDown(handle, { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 });
    });
    await act(async () => {
      fireEvent.keyDown(handle, { key: ' ', code: 'Space', keyCode: 32 });
    });

    expect(changes.at(-1)?.map((l) => l.name)).toEqual(['A', 'C', 'B']);
    expect(listedLabels()).toEqual(['Drag to reorder B layer', 'Drag to reorder C layer', 'Drag to reorder A layer']);
    // C is still the open one, even though it now sits second.
    expect(sectionOpen('C layer')).toBe('true');
    expect(sectionOpen('B layer')).toBe('false');
    expect(screen.getByText('C editor')).toBeInTheDocument();
    expect(screen.queryByText('B editor')).not.toBeInTheDocument();
  });
});
