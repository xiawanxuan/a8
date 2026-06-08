import pandas as pd
import numpy as np
from backend.utils.helpers import safe_json_serialize


class DataFilter:
    def __init__(self, data_loader=None):
        self.data_loader = data_loader

    def _get_data(self):
        if self.data_loader and self.data_loader.data is not None:
            return self.data_loader.data.copy()
        return None

    def filter(self, filters=None):
        data = self._get_data()
        if data is None:
            return None
        
        if not filters:
            return data
        
        for f in filters:
            col = f.get('column')
            op = f.get('operator')
            value = f.get('value')
            
            if col not in data.columns:
                continue
            
            if op == 'equals':
                data = data[data[col] == value]
            elif op == 'not_equals':
                data = data[data[col] != value]
            elif op == 'greater':
                data = data[data[col] > value]
            elif op == 'less':
                data = data[data[col] < value]
            elif op == 'greater_equal':
                data = data[data[col] >= value]
            elif op == 'less_equal':
                data = data[data[col] <= value]
            elif op == 'contains':
                data = data[data[col].astype(str).str.contains(str(value), case=False, na=False)]
            elif op == 'in':
                data = data[data[col].isin(value)]
            elif op == 'between':
                if isinstance(value, list) and len(value) == 2:
                    data = data[(data[col] >= value[0]) & (data[col] <= value[1])]
            elif op == 'date_between':
                if isinstance(value, list) and len(value) == 2:
                    data[col] = pd.to_datetime(data[col], errors='coerce')
                    start = pd.to_datetime(value[0])
                    end = pd.to_datetime(value[1])
                    data = data[(data[col] >= start) & (data[col] <= end)]
            elif op == 'starts_with':
                data = data[data[col].astype(str).str.startswith(str(value), na=False)]
            elif op == 'ends_with':
                data = data[data[col].astype(str).str.endswith(str(value), na=False)]
        
        return data

    def get_unique_values(self, column, limit=100):
        data = self._get_data()
        if data is None or column not in data.columns:
            return []
        
        unique_vals = data[column].dropna().unique().tolist()
        if len(unique_vals) > limit:
            unique_vals = unique_vals[:limit]
        
        return safe_json_serialize(unique_vals)

    def get_value_range(self, column):
        data = self._get_data()
        if data is None or column not in data.columns:
            return None
        
        col_data = data[column].dropna()
        if col_data.empty:
            return None
        
        if pd.api.types.is_numeric_dtype(col_data):
            return {
                'min': float(col_data.min()),
                'max': float(col_data.max())
            }
        elif pd.api.types.is_datetime64_any_dtype(col_data):
            return {
                'min': col_data.min().isoformat(),
                'max': col_data.max().isoformat()
            }
        return None
