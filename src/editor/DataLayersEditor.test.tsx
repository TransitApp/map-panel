import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
  const isOpen = (name: string) =>
    screen.getByRole('button', { name: new RegExp(`^(Collapse|Expand) ${name}$`) }).getAttribute('aria-expanded');
  const lastNames = () => changes.at(-1)?.map((l) => l.name);

  beforeEach(() => {
    changes.length = 0;
  });

  it('lists the topmost layer first, with its type', () => {
    render(<Harness initial={[A, B, C]} />);
    expect(listedLabels()).toEqual(['Drag to reorder C', 'Drag to reorder B', 'Drag to reorder A']);
    expect(screen.getAllByText('(Markers)')).toHaveLength(3);
  });

  it('reorders with the keyboard and keeps each row open state with its layer', async () => {
    render(<Harness initial={[A, B, C]} />);

    // Open the row for C, at the top of the list.
    fireEvent.click(screen.getByRole('button', { name: 'Expand C' }));
    expect(isOpen('C')).toBe('true');
    expect(isOpen('B')).toBe('false');

    // Lift C, move it down one place, drop it.
    const handle = screen.getByRole('button', { name: 'Drag to reorder C' });
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

    expect(lastNames()).toEqual(['A', 'C', 'B']);
    expect(listedLabels()).toEqual(['Drag to reorder B', 'Drag to reorder C', 'Drag to reorder A']);
    // C is still the open one, even though it now sits second.
    expect(isOpen('C')).toBe('true');
    expect(isOpen('B')).toBe('false');
    expect(screen.getByText('C editor')).toBeInTheDocument();
    expect(screen.queryByText('B editor')).not.toBeInTheDocument();
  });

  const renameC = (newName: string, key: 'Enter' | 'Escape') => {
    fireEvent.click(screen.getAllByTitle('Edit layer name')[0]);
    const input = screen.getByRole('textbox', { name: 'Layer name' });
    expect(input).toHaveValue('C');
    fireEvent.change(input, { target: { value: newName } });
    fireEvent.keyDown(input, { key });
  };

  it('renames a layer inline, saving on Enter', () => {
    render(<Harness initial={[A, B, C]} />);
    renameC('Corsica', 'Enter');
    expect(lastNames()).toEqual(['A', 'B', 'Corsica']);
    expect(screen.queryByRole('textbox', { name: 'Layer name' })).not.toBeInTheDocument();
    expect(screen.getByText('Corsica')).toBeInTheDocument();
  });

  it('cancels an inline rename on Escape', () => {
    render(<Harness initial={[A, B, C]} />);
    renameC('Corsica', 'Escape');
    expect(changes).toHaveLength(0);
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('keeps the Escape that cancels a rename from reaching Grafana', () => {
    // Grafana's Escape shortcut, which closes the panel editor, listens on the document.
    const grafanaShortcut = jest.fn();
    document.addEventListener('keydown', grafanaShortcut);
    render(<Harness initial={[A, B, C]} />);
    renameC('Corsica', 'Escape');
    document.removeEventListener('keydown', grafanaShortcut);
    expect(grafanaShortcut).not.toHaveBeenCalled();
  });

  it('clears the name when the inline rename is left empty', () => {
    render(<Harness initial={[A, B, C]} />);
    renameC('   ', 'Enter');
    expect(lastNames()).toEqual(['A', 'B', undefined]);
    expect(screen.getByText('Unnamed layer')).toBeInTheDocument();
  });

  it('removes a layer from its row', () => {
    render(<Harness initial={[A, B, C]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove B' }));
    expect(lastNames()).toEqual(['A', 'C']);
  });
});
