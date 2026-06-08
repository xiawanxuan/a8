import pandas as pd
import numpy as np
from backend.utils.helpers import safe_json_serialize


class DataAggregator:
    def __init__(self, data_loader=None):
        self.data_loader = data_loader

    def _get_data(self):
        if self.data_loader and self.data_loader.data is not None:
            return self.data_loader.data.copy()
        return None

    def aggregate(self, group_by, aggregations, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if not isinstance(group_by, list):
            group_by = [group_by]
        
        agg_dict = {}
        for agg in aggregations:
            col = agg.get('column')
            func = agg.get('function', 'sum')
            alias = agg.get('alias', f'{col}_{func}')
            
            if col not in data.columns:
                continue
            
            if func == 'sum':
                agg_dict[alias] = (col, 'sum')
            elif func == 'mean':
                agg_dict[alias] = (col, 'mean')
            elif func == 'count':
                agg_dict[alias] = (col, 'count')
            elif func == 'min':
                agg_dict[alias] = (col, 'min')
            elif func == 'max':
                agg_dict[alias] = (col, 'max')
            elif func == 'median':
                agg_dict[alias] = (col, 'median')
            elif func == 'std':
                agg_dict[alias] = (col, 'std')
            elif func == 'nunique':
                agg_dict[alias] = (col, 'nunique')
        
        if not agg_dict:
            return None
        
        result = data.groupby(group_by).agg(**agg_dict).reset_index()
        
        return result

    def time_series_aggregate(self, time_column, value_column, freq='D', func='sum', data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if time_column not in data.columns or value_column not in data.columns:
            return None
        
        df = data.copy()
        df[time_column] = pd.to_datetime(df[time_column], errors='coerce')
        df = df.dropna(subset=[time_column, value_column])
        
        df = df.set_index(time_column)
        
        if func == 'sum':
            result = df[value_column].resample(freq).sum()
        elif func == 'mean':
            result = df[value_column].resample(freq).mean()
        elif func == 'count':
            result = df[value_column].resample(freq).count()
        elif func == 'min':
            result = df[value_column].resample(freq).min()
        elif func == 'max':
            result = df[value_column].resample(freq).max()
        else:
            result = df[value_column].resample(freq).sum()
        
        result = result.reset_index()
        result.columns = [time_column, value_column]
        result[time_column] = result[time_column].astype(str)
        
        return result.to_dict('records')

    def pivot_table(self, index, columns, values, aggfunc='sum', data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        try:
            pivot = pd.pivot_table(
                data,
                index=index,
                columns=columns,
                values=values,
                aggfunc=aggfunc,
                fill_value=0
            )
            return pivot
        except Exception:
            return None

    def heatmap_data(self, x_column, y_column, value_column, aggfunc='mean', data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        pivot = self.pivot_table(x_column, y_column, value_column, aggfunc, data)
        if pivot is None:
            return None
        
        result = {
            'x_labels': pivot.columns.tolist(),
            'y_labels': pivot.index.tolist(),
            'values': pivot.values.tolist()
        }
        
        return safe_json_serialize(result)

    def histogram_data(self, column, bins=20, data=None):
        if data is None:
            data = self._get_data()
        if data is None or column not in data.columns:
            return None
        
        values = data[column].dropna()
        if values.empty:
            return None
        
        counts, bin_edges = np.histogram(values, bins=bins)
        
        result = []
        for i in range(len(counts)):
            result.append({
                'bin_start': float(bin_edges[i]),
                'bin_end': float(bin_edges[i+1]),
                'count': int(counts[i])
            })
        
        return result

    def to_dict_records(self, df):
        if df is None:
            return None
        result = df.to_dict('records')
        return safe_json_serialize(result)
