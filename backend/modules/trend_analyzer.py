import pandas as pd
import numpy as np
from scipy import stats
from scipy.stats import linregress
from backend.utils.helpers import safe_json_serialize


class TrendAnalyzer:
    def __init__(self, data_loader=None):
        self.data_loader = data_loader

    def _get_data(self):
        if self.data_loader and self.data_loader.data is not None:
            return self.data_loader.data.copy()
        return None

    def time_series_trend(self, time_column, value_column, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if time_column not in data.columns or value_column not in data.columns:
            return None
        
        df = data.copy()
        df[time_column] = pd.to_datetime(df[time_column], errors='coerce')
        df = df.dropna(subset=[time_column, value_column])
        df = df.sort_values(time_column)
        
        if len(df) < 2:
            return None
        
        df['timestamp'] = df[time_column].astype(np.int64) // 10**9
        
        x = df['timestamp'].values
        y = df[value_column].values
        
        try:
            slope, intercept, r_value, p_value, std_err = linregress(x, y)
        except Exception:
            return None
        
        trend = {
            'slope': float(slope),
            'intercept': float(intercept),
            'r_squared': float(r_value ** 2),
            'p_value': float(p_value),
            'std_error': float(std_err),
            'direction': 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'stable',
            'significance': 'high' if p_value < 0.01 else 'medium' if p_value < 0.05 else 'low'
        }
        
        return safe_json_serialize(trend)

    def rolling_average(self, time_column, value_column, window=7, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if time_column not in data.columns or value_column not in data.columns:
            return None
        
        df = data.copy()
        df[time_column] = pd.to_datetime(df[time_column], errors='coerce')
        df = df.dropna(subset=[time_column])
        df = df.sort_values(time_column)
        df = df.set_index(time_column)
        
        df['rolling_avg'] = df[value_column].rolling(window=window).mean()
        df['rolling_std'] = df[value_column].rolling(window=window).std()
        df = df.reset_index()
        
        df[time_column] = df[time_column].astype(str)
        result = df[[time_column, value_column, 'rolling_avg', 'rolling_std']].to_dict('records')
        
        return safe_json_serialize(result)

    def seasonal_decompose(self, time_column, value_column, period=12, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if time_column not in data.columns or value_column not in data.columns:
            return None
        
        df = data.copy()
        df[time_column] = pd.to_datetime(df[time_column], errors='coerce')
        df = df.dropna(subset=[time_column, value_column])
        df = df.sort_values(time_column)
        df = df.set_index(time_column)
        
        if len(df) < period * 2:
            return None
        
        values = df[value_column].values
        
        trend = np.convolve(values, np.ones(period)/period, mode='same')
        
        detrended = values / trend
        
        seasonal = np.zeros(period)
        for i in range(period):
            seasonal[i] = np.mean(detrended[i::period])
        
        seasonal_factor = np.tile(seasonal, len(values) // period + 1)[:len(values)]
        
        residual = values / (trend * seasonal_factor)
        
        result = {
            'time': df.index.astype(str).tolist(),
            'observed': values.tolist(),
            'trend': trend.tolist(),
            'seasonal': seasonal_factor.tolist(),
            'residual': residual.tolist()
        }
        
        return safe_json_serialize(result)

    def spatial_distribution(self, location_column, value_column, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if location_column not in data.columns or value_column not in data.columns:
            return None
        
        grouped = data.groupby(location_column).agg({
            value_column: ['sum', 'mean', 'count', 'std']
        }).reset_index()
        
        grouped.columns = [location_column, 'total', 'average', 'count', 'std']
        grouped = grouped.sort_values('total', ascending=False)
        
        return safe_json_serialize(grouped.to_dict('records'))

    def growth_rate(self, time_column, value_column, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if time_column not in data.columns or value_column not in data.columns:
            return None
        
        df = data.copy()
        df[time_column] = pd.to_datetime(df[time_column], errors='coerce')
        df = df.dropna(subset=[time_column, value_column])
        df = df.sort_values(time_column)
        
        df['growth_rate'] = df[value_column].pct_change() * 100
        df[time_column] = df[time_column].astype(str)
        
        result = df[[time_column, value_column, 'growth_rate']].to_dict('records')
        
        return safe_json_serialize(result)
