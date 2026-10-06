import React, { FC, useMemo } from 'react';
import { Select } from '@grafana/ui';
import {
  DataFrame,
  PanelOptionsEditorBuilder,
  StandardEditorContext,
  FieldOverrideContext,
  getFieldDisplayName,
  FieldType,
  Field,
  SelectableValue,
} from '@grafana/data';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from '../layers/registry';
import { OptionsPaneCategoryDescriptor } from './PanelEditor/OptionsPaneCategoryDescriptor';
import { setOptionImmutably } from './PanelEditor/utils';
import { fillOptionsPaneItems } from './PanelEditor/getVizualizationOptions';
import { GazetteerPathEditor } from './GazetteerPathEditor';
import { ExtendMapLayerRegistryItem, ExtendMapLayerOptions, ExtendFrameGeometrySourceMode } from '../extension';
import { FrameSelectionEditor } from './FrameSelectionEditor';
import { getLayerFrame } from '../layers/data/utils';

export interface LayerEditorProps<TConfig = any> {
  options?: ExtendMapLayerOptions<TConfig>;
  data: DataFrame[]; // All results
  onChange: (options: ExtendMapLayerOptions<TConfig>) => void;
  filter: (item: ExtendMapLayerRegistryItem) => boolean;
}

export const LayerEditor: FC<LayerEditorProps> = ({ options, onChange, data, filter }) => {
  // all basemaps
  const layerTypes = useMemo(() => {
    return geomapLayerRegistry.selectOptions(
      options?.type // the selected value
        ? [options.type] // as an array
        : [DEFAULT_BASEMAP_CONFIG.type],
      filter
    );
  }, [options, filter]);

  // The options change with each layer type
  const optionsEditorBuilder = useMemo(() => {
    const layer = geomapLayerRegistry.getIfExists(options?.type);
    if (!layer || !(layer.registerOptionsUI || layer.showLocation || layer.showOpacity || layer.id === 'nextzen')) {
      return null;
    }

    const builder = new PanelOptionsEditorBuilder<ExtendMapLayerOptions>();
    if (layer.id === 'nextzen') {
      builder.addTextInput({
        path: 'apiKey',
        name: 'API key',
        description: 'API key for nextzen',
        settings: {},
      });
    }

    if (layer.showLocation) {
      // The name is edited inline in the layer's row (DataLayersEditor).
      builder
        .addCustomEditor({
          id: 'query',
          path: 'query',
          name: 'Query',
          editor: FrameSelectionEditor,
          defaultValue: undefined,
        })
        .addRadio({
          path: 'location.mode',
          name: 'Location',
          description: '',
          defaultValue: ExtendFrameGeometrySourceMode.Auto,
          settings: {
            options: [
              { value: ExtendFrameGeometrySourceMode.Auto, label: 'Auto' },
              { value: ExtendFrameGeometrySourceMode.Coords, label: 'Coords' },
              { value: ExtendFrameGeometrySourceMode.Geohash, label: 'Geohash' },
              { value: ExtendFrameGeometrySourceMode.Lookup, label: 'Lookup' },
              { value: ExtendFrameGeometrySourceMode.Geojson, label: 'Geojson' },
            ],
          },
        })
        .addFieldNamePicker({
          path: 'location.geojson',
          name: 'Geojson field',
          // settings: {
          //   filter: (f: Field) => f.type === FieldType.other,
          //   noFieldsMessage: 'No strings fields found',
          // },
          showIf: (opts) => opts.location?.mode === ExtendFrameGeometrySourceMode.Geojson,
        })
        .addFieldNamePicker({
          path: 'location.latitude',
          name: 'Latitude field',
          settings: {
            filter: (f: Field) => f.type === FieldType.number,
            noFieldsMessage: 'No numeric fields found',
          },
          showIf: (opts) => opts.location?.mode === ExtendFrameGeometrySourceMode.Coords,
        })
        .addFieldNamePicker({
          path: 'location.longitude',
          name: 'Longitude field',
          settings: {
            filter: (f: Field) => f.type === FieldType.number,
            noFieldsMessage: 'No numeric fields found',
          },
          showIf: (opts) => opts.location?.mode === ExtendFrameGeometrySourceMode.Coords,
        })
        .addFieldNamePicker({
          path: 'location.geohash',
          name: 'Geohash field',
          settings: {
            filter: (f: Field) => f.type === FieldType.string,
            noFieldsMessage: 'No strings fields found',
          },
          showIf: (opts) => opts.location?.mode === ExtendFrameGeometrySourceMode.Geohash,

          // info: (props) => <div>HELLO</div>,
        })
        .addFieldNamePicker({
          path: 'location.lookup',
          name: 'Lookup field',
          settings: {
            filter: (f: Field) => f.type === FieldType.string,
            noFieldsMessage: 'No strings fields found',
          },
          showIf: (opts) => opts.location?.mode === ExtendFrameGeometrySourceMode.Lookup,
        })
        .addCustomEditor({
          id: 'gazetteer',
          path: 'location.gazetteer',
          name: 'Gazetteer',
          editor: GazetteerPathEditor,
          showIf: (opts) => opts.location?.mode === ExtendFrameGeometrySourceMode.Lookup,
        })
        .addFieldNamePicker({
          path: 'titleField',
          name: 'Pop up title',
          settings: {
            filter: (f: Field) => f.type === FieldType.string,
            noFieldsMessage: 'No string fields found',
          },
        })
        .addFieldNamePicker({
          path: 'timeField',
          name: 'Pop up Time',
          settings: {
            filter: (f: Field) => f.type === FieldType.time,
            noFieldsMessage: 'No time fields found',
          },
        })
        .addMultiSelect({
          path: 'displayProperties',
          name: 'Properties',
          description: 'Select properties to be displayed',
          settings: {
            allowCustomValue: false,
            options: [],
            placeholder: 'All Properties',
            getOptions: async (context: FieldOverrideContext) => {
              // context.data only holds the frame this layer draws, see below
              const options: Array<SelectableValue<string>> = [];
              for (const frame of context.data) {
                for (const field of frame.fields) {
                  if (!options.some((option) => option.value === field.name)) {
                    options.push({ value: field.name, label: getFieldDisplayName(field, frame, context.data) });
                  }
                }
              }
              return options;
            },
          },
          //showIf: (opts) => typeof opts.query !== 'undefined',
          defaultValue: '',
        });
    }
    if (layer.registerOptionsUI) {
      layer.registerOptionsUI(builder);
    }
    if (layer.showOpacity) {
      // TODO -- add opacity check
    }
    return builder;
  }, [options?.type]);

  // The react componnets
  const layerOptions = useMemo(() => {
    const layer = geomapLayerRegistry.getIfExists(options?.type);
    if (!optionsEditorBuilder || !layer) {
      return null;
    }

    const category = new OptionsPaneCategoryDescriptor({
      id: 'Layer config',
      title: 'Layer config',
    });

    // Field pickers offer only the fields of the frame this layer draws, so a
    // layer cannot be set up with another query's fields. The query picker is
    // the exception: it lists every query.
    const allQueriesContext: StandardEditorContext<any> = { data, options };
    const layerFrame = getLayerFrame(data, options?.query);
    const layerContext: StandardEditorContext<any> = { data: layerFrame ? [layerFrame] : [], options };

    const currentOptions = { ...options, type: layer.id, config: { ...layer.defaultOptions, ...options?.config } };

    // Update the panel options if not set
    if (!options || (layer.defaultOptions && !options.config)) {
      onChange(currentOptions as any);
    }

    const reg = optionsEditorBuilder.getRegistry();

    // Load the options into categories
    fillOptionsPaneItems(
      reg.list(),

      // Always use the same category
      (categoryNames) => category,

      // Custom upate function
      (path: string, value: any) => {
        onChange(setOptionImmutably(currentOptions, path, value) as any);
      },
      (item) => (item.id === 'query' ? allQueriesContext : layerContext)
    );

    return (
      <>
        <br />
        {category.items.map((item) => item.render())}
      </>
    );
  }, [optionsEditorBuilder, onChange, data, options]);

  return (
    <div>
      <Select
        menuShouldPortal
        options={layerTypes.options}
        value={layerTypes.current}
        onChange={(v) => {
          const layer = geomapLayerRegistry.getIfExists(v.value);
          if (!layer) {
            console.warn('layer does not exist', v);
            return;
          }

          onChange({
            ...options, // keep current options
            type: layer.id,
            config: { ...layer.defaultOptions }, // clone?
          });
        }}
      />

      {layerOptions}
    </div>
  );
};
