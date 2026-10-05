import React, { useState } from 'react';
import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { GrafanaTheme2, PluginState, StandardEditorProps } from '@grafana/data';
import { CollapsableSection, Icon, ToolbarButton, useStyles2 } from '@grafana/ui';
import { ExtendMapLayerOptions, ExtendMapLayerRegistryItem } from 'extension';
import { GeomapPanelOptions } from 'types';
import { defaultMarkersConfig } from '../layers/data/markersLayer';
import { hasAlphaPanels } from 'config';
import { LayerEditor } from './LayerEditor';
import _ from 'lodash';

function dataLayerFilter(layer: ExtendMapLayerRegistryItem): boolean {
  if (layer.isBaseMap) {
    return false;
  }
  if (layer.state === PluginState.alpha) {
    return hasAlphaPanels;
  }
  return true;
}

let nextLayerKey = 0;
const newLayerKey = () => `layer-${nextLayerKey++}`;

/**
 * Moves an item between two positions of the topmost-first list.
 *
 * `items` is in render order, so list position 0 is the last item. Returns a new
 * array, still in render order.
 */
export function moveByListPosition<T>(items: T[], fromPosition: number, toPosition: number): T[] {
  const last = items.length - 1;
  const result = [...items];
  const [item] = result.splice(last - fromPosition, 1);
  result.splice(last - toPosition, 0, item);
  return result;
}

/**
 * Lists the data layers and lets them be reordered by dragging the grip.
 *
 * `value` is in render order: the map draws value[0] first, so the last layer
 * ends up on top. The list shows that reversed, topmost layer first, the same
 * way the core Geomap panel does.
 */
export const DataLayersEditor: React.FC<StandardEditorProps<ExtendMapLayerOptions[], any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const styles = useStyles2(getStyles);
  const layers = value ?? [];

  // Layers have no id of their own and `name` is optional and not unique, so
  // the editor keeps a key per layer to give React a stable identity. Without
  // it, each section's open/closed state would stay at its position in the
  // list rather than moving with its layer. The keys are never saved.
  const [keys, setKeys] = useState<string[]>(() => layers.map(newLayerKey));
  let layerKeys = keys;
  if (keys.length !== layers.length) {
    // The layers were replaced from outside the editor (undo, JSON edit). Keep
    // whatever keys still line up and mint the rest.
    // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    layerKeys = layers.map((_layer, index) => keys[index] ?? newLayerKey());
    setKeys(layerKeys);
  }

  const onAddLayer = () => {
    setKeys([...layerKeys, newLayerKey()]);
    onChange([...layers, _.cloneDeep(defaultMarkersConfig)]);
  };

  const onDeleteLayer = (index: number) => {
    setKeys(layerKeys.filter((_key, i) => i !== index));
    onChange(layers.filter((_layer, i) => i !== index));
  };

  const onLayerChange = (index: number, cfg: ExtendMapLayerOptions) => {
    const newData = _.cloneDeep(layers);
    newData[index] = cfg;
    onChange(newData);
  };

  const onDragEnd = ({ source, destination }: DropResult) => {
    if (!destination || destination.index === source.index) {
      return;
    }
    setKeys(moveByListPosition(layerKeys, source.index, destination.index));
    onChange(moveByListPosition(layers, source.index, destination.index));
  };

  const topmostFirst = layers.map((layer, index) => ({ layer, index, key: layerKeys[index] })).reverse();

  return (
    <>
      <div className="data-layer-add">
        <ToolbarButton icon="plus" tooltip="add new layer" variant="primary" key="Add" onClick={onAddLayer}>
          Add Layer
        </ToolbarButton>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="data-layers">
          {(droppable) => (
            <div ref={droppable.innerRef} {...droppable.droppableProps}>
              {topmostFirst.map(({ layer, index, key }, position) => {
                const label = layer.name ? `${layer.name} layer` : 'unnamed layer';
                return (
                  <Draggable key={key} draggableId={key} index={position}>
                    {(draggable, snapshot) => (
                      <div
                        ref={draggable.innerRef}
                        {...draggable.draggableProps}
                        className={cx(styles.row, snapshot.isDragging && styles.rowDragging)}
                      >
                        <div
                          {...draggable.dragHandleProps}
                          className={styles.handle}
                          aria-label={`Drag to reorder ${label}`}
                          title="Drag to reorder"
                        >
                          <Icon name="draggabledots" />
                        </div>
                        <div className={styles.body}>
                          <CollapsableSection label={label} isOpen={false}>
                            <LayerEditor
                              options={layer}
                              data={context.data}
                              onChange={(cfg) => onLayerChange(index, cfg)}
                              filter={dataLayerFilter}
                            />
                            <div className="data-layer-remove">
                              <ToolbarButton
                                icon="trash-alt"
                                tooltip="delete"
                                variant="destructive"
                                key="Delete"
                                onClick={() => onDeleteLayer(index)}
                              >
                                Delete
                              </ToolbarButton>
                            </div>
                          </CollapsableSection>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {droppable.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
  }),
  rowDragging: css({
    background: theme.colors.background.secondary,
    boxShadow: theme.shadows.z3,
  }),
  handle: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
    width: theme.spacing(3),
    height: theme.spacing(4.5),
    color: theme.colors.text.secondary,
    borderRadius: theme.shape.radius.default,
    cursor: 'grab',
    '&:hover': {
      color: theme.colors.text.primary,
      background: theme.colors.action.hover,
    },
    '&:active': {
      cursor: 'grabbing',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
    },
  }),
  body: css({
    flex: 1,
    minWidth: 0,
  }),
});
