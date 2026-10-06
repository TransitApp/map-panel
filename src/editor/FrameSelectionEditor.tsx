import React, { FC, useCallback, useMemo } from 'react';

import {
  FrameMatcherID,
  getFieldDisplayName,
  MatcherConfig,
  SelectableValue,
  StandardEditorProps,
} from '@grafana/data';
import { Select } from '@grafana/ui';
import { getSelectedRefId } from '../layers/data/utils';

export const FrameSelectionEditor: FC<StandardEditorProps<MatcherConfig>> = ({ value, context, onChange }) => {
  const listOfRefId = useMemo(() => {
    return context.data.map((f) => ({
      value: f.refId,
      label: `Query: ${f.refId} (size: ${f.length})`,
      description: f.fields.map((f) => getFieldDisplayName(f)).join(', '),
    }));
  }, [context.data]);

  const selectedRefId = getSelectedRefId(value);

  const currentValue = useMemo<SelectableValue<string> | undefined>(() => {
    if (!selectedRefId) {
      return undefined;
    }
    return (
      listOfRefId.find((refId) => refId.value === selectedRefId) ?? {
        // The selected query returned no frame: it failed, or was renamed or
        // removed. Keep showing it, since the layer still uses it, and never
        // swap in another query.
        value: selectedRefId,
        label: `Query: ${selectedRefId} (no data)`,
      }
    );
  }, [selectedRefId, listOfRefId]);

  const onFilterChange = useCallback(
    (v: SelectableValue<string>) => {
      onChange(
        v?.value
          ? {
              id: FrameMatcherID.byRefId,
              options: v.value,
            }
          : undefined
      );
    },
    [onChange]
  );

  return (
    <Select
      options={listOfRefId}
      onChange={onFilterChange}
      isClearable={true}
      placeholder="Change filter"
      value={currentValue}
    />
  );
};
