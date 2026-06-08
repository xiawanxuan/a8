import pandas as pd
import numpy as np
from backend.utils.helpers import safe_json_serialize


class AnomalyDetector:
    def __init__(self, data_loader=None):
        self.data_loader = data_loader

    def _get_data(self):
        if self.data_loader and self.data_loader.data is not None:
            return self.data_loader.data.copy()
        return None

    def z_score_detection(self, value_column, threshold=3, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None

        if value_column not in data.columns:
            return None

        df = data.copy()
        df = df.dropna(subset=[value_column])

        if len(df) == 0:
            return None

        values = df[value_column].values
        mean = np.mean(values)
        std = np.std(values)

        if std == 0:
            return {
                'anomalies': [],
                'normal_count': len(df),
                'anomaly_count': 0,
                'mean': float(mean),
                'std': 0.0,
                'threshold': threshold,
                'method': 'z_score'
            }

        z_scores = np.abs((values - mean) / std)
        anomaly_mask = z_scores > threshold

        df['z_score'] = (values - mean) / std
        df['is_anomaly'] = anomaly_mask

        anomalies_df = df[anomaly_mask].copy()
        anomalies = anomalies_df.to_dict('records')

        result = {
            'anomalies': safe_json_serialize(anomalies),
            'normal_count': int(len(df) - len(anomalies_df)),
            'anomaly_count': int(len(anomalies_df)),
            'mean': float(mean),
            'std': float(std),
            'threshold': threshold,
            'method': 'z_score'
        }

        return safe_json_serialize(result)

    def iqr_detection(self, value_column, k=1.5, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None

        if value_column not in data.columns:
            return None

        df = data.copy()
        df = df.dropna(subset=[value_column])

        if len(df) == 0:
            return None

        values = df[value_column].values

        q1 = np.percentile(values, 25)
        q3 = np.percentile(values, 75)
        iqr = q3 - q1

        lower_bound = q1 - k * iqr
        upper_bound = q3 + k * iqr

        anomaly_mask = (values < lower_bound) | (values > upper_bound)

        df['is_anomaly'] = anomaly_mask

        anomalies_df = df[anomaly_mask].copy()
        anomalies = anomalies_df.to_dict('records')

        result = {
            'anomalies': safe_json_serialize(anomalies),
            'normal_count': int(len(df) - len(anomalies_df)),
            'anomaly_count': int(len(anomalies_df)),
            'q1': float(q1),
            'q3': float(q3),
            'iqr': float(iqr),
            'lower_bound': float(lower_bound),
            'upper_bound': float(upper_bound),
            'k': k,
            'method': 'iqr'
        }

        return safe_json_serialize(result)

    def time_series_anomaly(self, time_column, value_column, method='z_score', window=7, threshold=3, data=None):
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

        if len(df) < window * 2:
            return None

        df = df.set_index(time_column)
        daily = df[value_column].resample('D').sum().reset_index()
        daily = daily.rename(columns={0: value_column})

        if method == 'z_score':
            values = daily[value_column].values
            mean = np.mean(values)
            std = np.std(values)

            if std == 0:
                anomalies = []
            else:
                z_scores = np.abs((values - mean) / std)
                anomaly_mask = z_scores > threshold
                anomalies_df = daily[anomaly_mask].copy()
                anomalies = anomalies_df.to_dict('records')

            result = {
                'anomalies': safe_json_serialize(anomalies),
                'normal_count': int(len(daily) - len(anomalies)) if std > 0 else int(len(daily)),
                'anomaly_count': int(len(anomalies)) if std > 0 else 0,
                'mean': float(mean),
                'std': float(std),
                'threshold': threshold,
                'method': 'time_series_z_score'
            }

        elif method == 'rolling':
            daily['rolling_mean'] = daily[value_column].rolling(window=window, min_periods=1).mean()
            daily['rolling_std'] = daily[value_column].rolling(window=window, min_periods=1).std().fillna(0)

            anomaly_mask = np.zeros(len(daily), dtype=bool)
            for i in range(len(daily)):
                if daily['rolling_std'].iloc[i] > 0:
                    z = abs(daily[value_column].iloc[i] - daily['rolling_mean'].iloc[i]) / daily['rolling_std'].iloc[i]
                    anomaly_mask[i] = z > threshold

            anomalies_df = daily[anomaly_mask].copy()
            anomalies = anomalies_df.to_dict('records')

            result = {
                'anomalies': safe_json_serialize(anomalies),
                'normal_count': int(len(daily) - len(anomalies_df)),
                'anomaly_count': int(len(anomalies_df)),
                'window': window,
                'threshold': threshold,
                'method': 'time_series_rolling'
            }

        else:
            return None

        return safe_json_serialize(result)

    def detect_anomalies(self, value_column, method='z_score', time_column=None, threshold=3, k=1.5, window=7, data=None):
        if method == 'z_score':
            return self.z_score_detection(value_column, threshold, data)
        elif method == 'iqr':
            return self.iqr_detection(value_column, k, data)
        elif method == 'time_series' and time_column:
            return self.time_series_anomaly(time_column, value_column, 'z_score', window, threshold, data)
        elif method == 'time_series_rolling' and time_column:
            return self.time_series_anomaly(time_column, value_column, 'rolling', window, threshold, data)
        else:
            return self.z_score_detection(value_column, threshold, data)

    def get_anomaly_summary(self, value_column, time_column=None, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None

        if value_column not in data.columns:
            return None

        z_result = self.z_score_detection(value_column, 3, data)
        iqr_result = self.iqr_detection(value_column, 1.5, data)

        result = {
            'value_column': value_column,
            'z_score': {
                'anomaly_count': z_result['anomaly_count'] if z_result else 0,
                'normal_count': z_result['normal_count'] if z_result else 0,
                'mean': z_result['mean'] if z_result else 0,
                'std': z_result['std'] if z_result else 0
            },
            'iqr': {
                'anomaly_count': iqr_result['anomaly_count'] if iqr_result else 0,
                'normal_count': iqr_result['normal_count'] if iqr_result else 0,
                'q1': iqr_result['q1'] if iqr_result else 0,
                'q3': iqr_result['q3'] if iqr_result else 0,
                'lower_bound': iqr_result['lower_bound'] if iqr_result else 0,
                'upper_bound': iqr_result['upper_bound'] if iqr_result else 0
            }
        }

        return safe_json_serialize(result)
