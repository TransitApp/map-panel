import React, { useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, DraggableProvidedDragHandleProps, Droppable, DropResult } from '@hello-pangea/dnd';
import { DataFrame, GrafanaTheme2, PluginState, StandardEditorProps } from '@grafana/data';
import { Icon, IconButton, Input, ToolbarButton, useStyles2 } from '@grafana/ui';
import { ExtendMapLayerOptions, ExtendMapLayerRegistryItem } from 'extension';
import { GeomapPanelOptions } from 'types';
import { defaultMarkersConfig } from '../layers/data/markersLayer';
import { geomapLayerRegistry } from '../layers/registry';
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
  // it, each row's open/closed state would stay at its position in the list
  // rather than moving with its layer. The keys are never saved.
  const [keys, setKeys] = useState<string[]>(() => layers.map(newLayerKey));
  let layerKeys = keys;
  if (keys.length !== layers.length) {
    // The layers were replaced from outside the editor (undo, JSON edit). Keep
    // whatever keys still line up and mint the rest.
    // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    layerKeys = layers.map((_layer, index) => keys[index] ?? newLayerKey());
    setKeys(layerKeys);
  }

  // The button sits below the list, so the new layer goes at the bottom of the
  // list, next to it. That is the start of render order: drawn under the rest.
  const onAddLayer = () => {
    setKeys([newLayerKey(), ...layerKeys]);
    onChange([_.cloneDeep(defaultMarkersConfig), ...layers]);
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
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="data-layers">
          {(droppable) => (
            <div ref={droppable.innerRef} {...droppable.droppableProps}>
              {topmostFirst.map(({ layer, index, key }, position) => (
                <Draggable key={key} draggableId={key} index={position}>
                  {(draggable, snapshot) => (
                    <div
                      ref={draggable.innerRef}
                      {...draggable.draggableProps}
                      className={cx(styles.row, snapshot.isDragging && styles.rowDragging)}
                    >
                      <LayerRow
                        layer={layer}
                        data={context.data}
                        dragHandleProps={draggable.dragHandleProps}
                        onChange={(cfg) => onLayerChange(index, cfg)}
                        onDelete={() => onDeleteLayer(index)}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {droppable.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <div className="data-layer-add">
        <ToolbarButton icon="plus" tooltip="add new layer" variant="primary" key="Add" onClick={onAddLayer}>
          Add Layer
        </ToolbarButton>
      </div>
    </>
  );
};

interface LayerRowProps {
  layer: ExtendMapLayerOptions;
  data: DataFrame[];
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  onChange: (layer: ExtendMapLayerOptions) => void;
  onDelete: () => void;
}

/**
 * One data layer, laid out like a row of Grafana's query editor: a header with
 * the collapse toggle, the inline-editable name and the layer type, then the
 * row actions and the drag grip on the right; the layer's options below it.
 */
const LayerRow = ({ layer, data, dragHandleProps, onChange, onDelete }: LayerRowProps) => {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const cancelNameEdit = useRef(false);

  const name = layer.name?.trim();
  const displayName = name || 'Unnamed layer';
  const typeName = geomapLayerRegistry.getIfExists(layer.type)?.name ?? layer.type;

  const onNameBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsEditingName(false);
    if (cancelNameEdit.current) {
      cancelNameEdit.current = false;
      return;
    }
    const newName = event.currentTarget.value.trim();
    if (newName !== (name ?? '')) {
      onChange({ ...layer, name: newName || undefined });
    }
  };

  const onNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      // Grafana closes the panel editor on Escape unless an input has focus.
      // This handler blurs the input first, so keep the key from reaching it.
      event.stopPropagation();
      cancelNameEdit.current = true;
      event.currentTarget.blur();
    }
  };

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <IconButton
            name={isOpen ? 'angle-down' : 'angle-right'}
            aria-label={isOpen ? `Collapse ${displayName}` : `Expand ${displayName}`}
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
            className={styles.toggle}
          />
          {isEditingName ? (
            <Input
              autoFocus
              defaultValue={name ?? ''}
              placeholder="Layer name"
              aria-label="Layer name"
              className={styles.nameInput}
              onBlur={onNameBlur}
              onKeyDown={onNameKeyDown}
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : (
            <button
              type="button"
              className={styles.nameButton}
              title="Edit layer name"
              onClick={() => setIsEditingName(true)}
            >
              <span className={cx(styles.name, !name && styles.unnamed)}>{displayName}</span>
              <Icon name="pen" size="sm" className={styles.namePen} />
            </button>
          )}
          <span className={styles.type}>({typeName})</span>
        </div>
        <div className={styles.headerRight}>
          <IconButton name="trash-alt" tooltip={`Remove ${displayName}`} onClick={onDelete} />
          <div
            {...dragHandleProps}
            className={styles.handle}
            aria-label={`Drag to reorder ${displayName}`}
            title="Drag to reorder"
          >
            <Icon name="draggabledots" size="lg" />
          </div>
        </div>
      </div>
      {isOpen && (
        <div className={styles.body}>
          <LayerEditor options={layer} data={data} onChange={onChange} filter={dataLayerFilter} />
        </div>
      )}
    </>
  );
};

// Spacing, colours and type follow Grafana's query editor rows (QueryOperationRow).
const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    marginBottom: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
  }),
  rowDragging: css({
    boxShadow: theme.shadows.z3,
  }),
  header: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    minHeight: theme.spacing(4),
    padding: theme.spacing(0.5),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),
  headerLeft: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  }),
  headerRight: css({
    display: 'flex',
    alignItems: 'center',
    // IconButton adds 4px of its own, making the 12px gap Grafana's rows have
    gap: theme.spacing(1),
    marginLeft: theme.spacing(1),
  }),
  toggle: css({
    margin: theme.spacing(0, 0.5),
  }),
  nameButton: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    height: theme.spacing(3),
    padding: theme.spacing(0, 0, 0, 0.5),
    marginLeft: theme.spacing(0.5),
    color: theme.colors.text.primary,
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: theme.shape.radius.default,
    '&:hover, &:focus-visible': {
      background: theme.colors.action.hover,
      borderColor: theme.colors.border.strong,
    },
    '&:hover > svg, &:focus-visible > svg': {
      visibility: 'visible',
    },
  }),
  nameInput: css({
    // Fill the room the name had, instead of the query editor's fixed width,
    // which crowds the row actions in the narrower options pane.
    flex: '1 1 auto',
    minWidth: theme.spacing(10),
    marginLeft: theme.spacing(0.5),
  }),
  name: css({
    marginLeft: theme.spacing(0.5),
    color: theme.colors.primary.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  unnamed: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  }),
  namePen: css({
    flex: 'none',
    margin: theme.spacing(0, 0.5, 0, 2),
    visibility: 'hidden',
  }),
  type: css({
    flex: 'none',
    paddingLeft: theme.spacing(1.25),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontStyle: 'italic',
  }),
  handle: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(0.25, 0.5),
    color: theme.colors.text.secondary,
    borderRadius: theme.shape.radius.default,
    cursor: 'grab',
    '&:hover': {
      color: theme.colors.text.primary,
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
    margin: theme.spacing(0.5, 0, 0, 3),
  }),
});
