import pandas as pd
import numpy as np
from backend.utils.helpers import detect_date_columns, detect_numeric_columns, generate_summary


class DataCleaner:
    def __init__(self, data_loader=None):
        self.data_loader = data_loader
        self.cleaning_report = {}

    def _get_data(self):
        if self.data_loader and self.data_loader.data is not None:
            return self.data_loader.data.copy()
        return None

    def _set_data(self, data):
        if self.data_loader:
            self.data_loader.data = data
            self.data_loader.summary = generate_summary(data)
            self.data_loader._detect_column_roles()

    def clean_all(self, options=None):
        if options is None:
            options = {
                'remove_duplicates': True,
                'handle_missing': 'drop',
                'convert_dates': True,
                'standardize_text': True
            }
        
        report = {}
        
        if options.get('remove_duplicates', True):
            dup_count = self.remove_duplicates()
            report['duplicates_removed'] = dup_count
        
        handle_missing = options.get('handle_missing', 'drop')
        if handle_missing != 'none':
            missing_result = self.handle_missing_values(handle_missing)
            report['missing_handled'] = missing_result
        
        if options.get('convert_dates', True):
            converted = self.convert_date_columns()
            report['dates_converted'] = converted
        
        if options.get('standardize_text', False):
            standardized = self.standardize_text_columns()
            report['text_standardized'] = standardized
        
        self.cleaning_report = report
        return report

    def remove_duplicates(self):
        data = self._get_data()
        if data is None:
            return 0
        
        before = len(data)
        data = data.drop_duplicates()
        after = len(data)
        self._set_data(data)
        return before - after

    def handle_missing_values(self, strategy='drop'):
        data = self._get_data()
        if data is None:
            return {'rows_affected': 0, 'strategy': strategy}
        
        before = data.isnull().sum().sum()
        result = {'strategy': strategy, 'before': int(before)}
        
        if strategy == 'drop':
            data = data.dropna()
        elif strategy == 'mean':
            numeric_cols = detect_numeric_columns(data)
            for col in numeric_cols:
                data[col] = data[col].fillna(data[col].mean())
        elif strategy == 'median':
            numeric_cols = detect_numeric_columns(data)
            for col in numeric_cols:
                data[col] = data[col].fillna(data[col].median())
        elif strategy == 'ffill':
            data = data.ffill()
        elif strategy == 'bfill':
            data = data.bfill()
        
        after = data.isnull().sum().sum()
        result['after'] = int(after)
        result['filled'] = int(before - after)
        
        self._set_data(data)
        return result

    def convert_date_columns(self, columns=None):
        data = self._get_data()
        if data is None:
            return []
        
        if columns is None:
            columns = detect_date_columns(data)
        
        converted = []
        for col in columns:
            try:
                data[col] = pd.to_datetime(data[col], errors='coerce')
                converted.append(col)
            except Exception:
                continue
        
        self._set_data(data)
        return converted

    def standardize_text_columns(self, columns=None):
        data = self._get_data()
        if data is None:
            return []
        
        if columns is None:
            columns = data.select_dtypes(include=['object']).columns.tolist()
        
        standardized = []
        for col in columns:
            try:
                data[col] = data[col].astype(str).str.strip()
                standardized.append(col)
            except Exception:
                continue
        
        self._set_data(data)
        return standardized

    def filter_rows(self, conditions):
        data = self._get_data()
        if data is None:
            return None
        
        for condition in conditions:
            col = condition.get('column')
            op = condition.get('operator')
            value = condition.get('value')
            
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
                data = data[(data[col] >= value[0]) & (data[col] <= value[1])]
        
        return data

    def get_cleaning_report(self):
        return self.cleaning_report
