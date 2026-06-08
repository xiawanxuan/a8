import pandas as pd
import numpy as np
import os
from io import StringIO
from backend.utils.helpers import detect_date_columns, detect_numeric_columns, detect_categorical_columns, generate_summary


class DataLoader:
    def __init__(self):
        self.data = None
        self.file_path = None
        self.summary = None

    def load_csv(self, file_path, encoding='utf-8'):
        try:
            self.data = pd.read_csv(file_path, encoding=encoding)
            self.file_path = file_path
            self._post_load_processing()
            return True, "数据加载成功"
        except UnicodeDecodeError:
            try:
                self.data = pd.read_csv(file_path, encoding='gbk')
                self.file_path = file_path
                self._post_load_processing()
                return True, "数据加载成功(GBK编码)"
            except Exception as e:
                return False, f"加载失败: {str(e)}"
        except Exception as e:
            return False, f"加载失败: {str(e)}"

    def load_json(self, file_path):
        try:
            self.data = pd.read_json(file_path)
            self.file_path = file_path
            self._post_load_processing()
            return True, "数据加载成功"
        except Exception as e:
            return False, f"加载失败: {str(e)}"

    def load_from_string(self, data_str, format='csv'):
        try:
            if format == 'csv':
                self.data = pd.read_csv(StringIO(data_str))
            elif format == 'json':
                self.data = pd.read_json(StringIO(data_str))
            else:
                return False, f"不支持的格式: {format}"
            self._post_load_processing()
            return True, "数据加载成功"
        except Exception as e:
            return False, f"加载失败: {str(e)}"

    def _post_load_processing(self):
        self.summary = generate_summary(self.data)
        self._detect_column_roles()

    def _detect_column_roles(self):
        self.date_columns = detect_date_columns(self.data)
        self.numeric_columns = detect_numeric_columns(self.data)
        self.categorical_columns = detect_categorical_columns(self.data)
        self.spatial_columns = self._detect_spatial_columns()

    def _detect_spatial_columns(self):
        spatial_keywords = ['lon', 'lng', 'longitude', '经度', 'lat', 'latitude', '纬度', 'city', '城市', 'region', '地区', 'province', '省份', 'district', '区域', 'location', '位置']
        spatial_cols = []
        for col in self.data.columns:
            col_lower = col.lower()
            if any(keyword in col_lower for keyword in spatial_keywords):
                spatial_cols.append(col)
        return spatial_cols

    def get_data(self):
        if self.data is None:
            return None
        return self.data

    def get_preview(self, rows=100):
        if self.data is None:
            return None
        preview = self.data.head(rows).copy()
        for col in preview.columns:
            if pd.api.types.is_datetime64_any_dtype(preview[col]):
                preview[col] = preview[col].astype(str)
        return preview.to_dict('records')

    def get_summary(self):
        if self.summary is None:
            return None
        return self.summary

    def get_column_info(self):
        if self.data is None:
            return None
        return {
            'columns': self.data.columns.tolist(),
            'date_columns': self.date_columns,
            'numeric_columns': self.numeric_columns,
            'categorical_columns': self.categorical_columns,
            'spatial_columns': self.spatial_columns
        }
