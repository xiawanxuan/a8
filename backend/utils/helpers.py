import pandas as pd
import numpy as np
from datetime import datetime


def parse_datetime(date_str, format=None):
    try:
        if format:
            return pd.to_datetime(date_str, format=format)
        return pd.to_datetime(date_str)
    except Exception:
        return pd.NaT


def detect_date_columns(df):
    date_cols = []
    for col in df.columns:
        if df[col].dtype == 'object':
            try:
                parsed = pd.to_datetime(df[col].head(100), errors='coerce')
                if parsed.notna().sum() > len(parsed) * 0.7:
                    date_cols.append(col)
            except Exception:
                continue
    return date_cols


def detect_numeric_columns(df):
    return df.select_dtypes(include=[np.number]).columns.tolist()


def detect_categorical_columns(df, threshold=0.05):
    categorical_cols = []
    for col in df.columns:
        if df[col].dtype == 'object' or df[col].dtype.name == 'category':
            categorical_cols.append(col)
        elif df[col].dtype in [np.int64, np.int32, np.int16, np.int8]:
            unique_ratio = df[col].nunique() / len(df)
            if unique_ratio < threshold:
                categorical_cols.append(col)
    return categorical_cols


def generate_summary(df):
    summary = {
        'rows': len(df),
        'columns': len(df.columns),
        'column_types': {},
        'null_counts': df.isnull().sum().to_dict(),
        'numeric_stats': {}
    }
    
    for col in df.columns:
        summary['column_types'][col] = str(df[col].dtype)
    
    numeric_cols = detect_numeric_columns(df)
    for col in numeric_cols:
        summary['numeric_stats'][col] = {
            'min': float(df[col].min()),
            'max': float(df[col].max()),
            'mean': float(df[col].mean()),
            'median': float(df[col].median()),
            'std': float(df[col].std()) if df[col].std() is not np.nan else 0
        }
    
    return summary


def safe_json_serialize(data):
    if isinstance(data, dict):
        return {k: safe_json_serialize(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [safe_json_serialize(item) for item in data]
    elif isinstance(data, (np.integer,)):
        return int(data)
    elif isinstance(data, (np.floating,)):
        if np.isnan(data):
            return None
        return float(data)
    elif isinstance(data, np.ndarray):
        return data.tolist()
    elif pd.isna(data):
        return None
    elif isinstance(data, (pd.Timestamp, datetime)):
        return data.isoformat()
    return data
