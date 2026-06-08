import pandas as pd
import numpy as np
from backend.utils.helpers import safe_json_serialize


class ForecastAnalyzer:
    def __init__(self, data_loader=None):
        self.data_loader = data_loader

    def _get_data(self):
        if self.data_loader and self.data_loader.data is not None:
            return self.data_loader.data.copy()
        return None

    def linear_regression_forecast(self, time_column, value_column, periods=30, freq='D', data=None):
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

        df = df.set_index(time_column)
        df = df[value_column].resample(freq).sum().reset_index()
        df = df.dropna(subset=[value_column])

        if len(df) < 2:
            return None

        df['timestamp'] = (df[time_column] - df[time_column].min()).dt.days

        x = df['timestamp'].values
        y = df[value_column].values

        n = len(x)
        slope = (n * np.sum(x * y) - np.sum(x) * np.sum(y)) / (n * np.sum(x ** 2) - (np.sum(x)) ** 2)
        intercept = (np.sum(y) - slope * np.sum(x)) / n

        y_pred = slope * x + intercept
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

        std_error = np.sqrt(ss_res / (n - 2)) if n > 2 else 0

        last_date = df[time_column].max()
        future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=periods, freq=freq)
        future_x = np.array([(d - df[time_column].min()).days for d in future_dates])
        future_y = slope * future_x + intercept

        margin_of_error = 1.96 * std_error
        upper_bound = future_y + margin_of_error
        lower_bound = future_y - margin_of_error

        historical = df[[time_column, value_column]].copy()
        historical[time_column] = historical[time_column].astype(str)
        historical_data = historical.to_dict('records')

        forecast_data = []
        for i, date in enumerate(future_dates):
            forecast_data.append({
                time_column: str(date.date()) if freq in ['D', 'W', 'M', 'Q'] else str(date),
                value_column: float(future_y[i]),
                'upper': float(upper_bound[i]),
                'lower': float(lower_bound[i]),
                'type': 'forecast'
            })

        result = {
            'historical': historical_data,
            'forecast': forecast_data,
            'model': {
                'method': 'linear_regression',
                'slope': float(slope),
                'intercept': float(intercept),
                'r_squared': float(r_squared),
                'std_error': float(std_error),
                'periods': periods,
                'freq': freq
            }
        }

        return safe_json_serialize(result)

    def moving_average_forecast(self, time_column, value_column, periods=30, window=7, freq='D', data=None):
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

        if len(df) < window:
            return None

        df = df.set_index(time_column)
        df = df[value_column].resample(freq).sum().reset_index()
        df = df.dropna(subset=[value_column])

        if len(df) < window:
            return None

        df['moving_avg'] = df[value_column].rolling(window=window, min_periods=1).mean()
        df['moving_std'] = df[value_column].rolling(window=window, min_periods=1).std().fillna(0)

        last_date = df[time_column].max()
        last_value = df['moving_avg'].iloc[-1]
        last_std = df['moving_std'].iloc[-1] if df['moving_std'].iloc[-1] > 0 else df[value_column].std()

        future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=periods, freq=freq)

        margin_of_error = 1.96 * last_std
        upper_bound = last_value + margin_of_error
        lower_bound = last_value - margin_of_error

        historical = df[[time_column, value_column, 'moving_avg']].copy()
        historical[time_column] = historical[time_column].astype(str)
        historical_data = historical.to_dict('records')

        forecast_data = []
        for date in future_dates:
            forecast_data.append({
                time_column: str(date.date()) if freq in ['D', 'W', 'M', 'Q'] else str(date),
                value_column: float(last_value),
                'upper': float(upper_bound),
                'lower': float(lower_bound),
                'type': 'forecast'
            })

        result = {
            'historical': historical_data,
            'forecast': forecast_data,
            'model': {
                'method': 'moving_average',
                'window': window,
                'periods': periods,
                'freq': freq,
                'last_value': float(last_value),
                'std': float(last_std)
            }
        }

        return safe_json_serialize(result)

    def exponential_smoothing_forecast(self, time_column, value_column, periods=30, alpha=0.3, freq='D', data=None):
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

        df = df.set_index(time_column)
        df = df[value_column].resample(freq).sum().reset_index()
        df = df.dropna(subset=[value_column])

        if len(df) < 2:
            return None

        values = df[value_column].values
        smoothed = np.zeros(len(values))
        smoothed[0] = values[0]

        for i in range(1, len(values)):
            smoothed[i] = alpha * values[i] + (1 - alpha) * smoothed[i - 1]

        df['exp_smooth'] = smoothed

        errors = values[1:] - smoothed[:-1]
        mse = np.mean(errors ** 2) if len(errors) > 0 else 0
        rmse = np.sqrt(mse)

        last_date = df[time_column].max()
        last_smooth = smoothed[-1]
        future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=periods, freq=freq)

        margin_of_error = 1.96 * rmse
        upper_bound = last_smooth + margin_of_error
        lower_bound = last_smooth - margin_of_error

        historical = df[[time_column, value_column, 'exp_smooth']].copy()
        historical[time_column] = historical[time_column].astype(str)
        historical_data = historical.to_dict('records')

        forecast_data = []
        for date in future_dates:
            forecast_data.append({
                time_column: str(date.date()) if freq in ['D', 'W', 'M', 'Q'] else str(date),
                value_column: float(last_smooth),
                'upper': float(upper_bound),
                'lower': float(lower_bound),
                'type': 'forecast'
            })

        result = {
            'historical': historical_data,
            'forecast': forecast_data,
            'model': {
                'method': 'exponential_smoothing',
                'alpha': float(alpha),
                'periods': periods,
                'freq': freq,
                'rmse': float(rmse),
                'last_value': float(last_smooth)
            }
        }

        return safe_json_serialize(result)

    def forecast(self, time_column, value_column, method='linear', periods=30, window=7, alpha=0.3, freq='D', data=None):
        if method == 'linear':
            return self.linear_regression_forecast(time_column, value_column, periods, freq, data)
        elif method == 'moving_average':
            return self.moving_average_forecast(time_column, value_column, periods, window, freq, data)
        elif method == 'exponential':
            return self.exponential_smoothing_forecast(time_column, value_column, periods, alpha, freq, data)
        else:
            return self.linear_regression_forecast(time_column, value_column, periods, freq, data)
