import pandas as pd
import numpy as np
from scipy import stats
from scipy.stats import pearsonr, spearmanr, kendalltau
from backend.utils.helpers import safe_json_serialize


class CorrelationAnalyzer:
    def __init__(self, data_loader=None):
        self.data_loader = data_loader

    def _get_data(self):
        if self.data_loader and self.data_loader.data is not None:
            return self.data_loader.data.copy()
        return None

    def correlation_matrix(self, columns=None, method='pearson', data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if columns is None:
            columns = data.select_dtypes(include=[np.number]).columns.tolist()
        
        numeric_data = data[columns].select_dtypes(include=[np.number])
        
        if numeric_data.shape[1] < 2:
            return None
        
        if method == 'pearson':
            corr_matrix = numeric_data.corr(method='pearson')
        elif method == 'spearman':
            corr_matrix = numeric_data.corr(method='spearman')
        elif method == 'kendall':
            corr_matrix = numeric_data.corr(method='kendall')
        else:
            corr_matrix = numeric_data.corr(method='pearson')
        
        result = {
            'columns': corr_matrix.columns.tolist(),
            'matrix': corr_matrix.values.tolist()
        }
        
        return safe_json_serialize(result)

    def pairwise_correlation(self, col1, col2, method='pearson', data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if col1 not in data.columns or col2 not in data.columns:
            return None
        
        df = data[[col1, col2]].dropna()
        
        if len(df) < 3:
            return None
        
        try:
            if method == 'pearson':
                corr, p_value = pearsonr(df[col1], df[col2])
            elif method == 'spearman':
                corr, p_value = spearmanr(df[col1], df[col2])
            elif method == 'kendall':
                corr, p_value = kendalltau(df[col1], df[col2])
            else:
                corr, p_value = pearsonr(df[col1], df[col2])
        except Exception:
            return None
        
        result = {
            'column1': col1,
            'column2': col2,
            'method': method,
            'correlation': float(corr),
            'p_value': float(p_value),
            'strength': 'strong' if abs(corr) > 0.7 else 'moderate' if abs(corr) > 0.4 else 'weak',
            'direction': 'positive' if corr > 0 else 'negative' if corr < 0 else 'none',
            'significant': p_value < 0.05
        }
        
        return safe_json_serialize(result)

    def top_correlations(self, target_column, top_n=10, method='pearson', data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if target_column not in data.columns:
            return None
        
        numeric_cols = data.select_dtypes(include=[np.number]).columns.tolist()
        if target_column not in numeric_cols:
            return None
        
        correlations = []
        for col in numeric_cols:
            if col == target_column:
                continue
            
            df = data[[target_column, col]].dropna()
            if len(df) < 3:
                continue
            
            try:
                if method == 'pearson':
                    corr, p_value = pearsonr(df[target_column], df[col])
                elif method == 'spearman':
                    corr, p_value = spearmanr(df[target_column], df[col])
                else:
                    corr, p_value = pearsonr(df[target_column], df[col])
                
                correlations.append({
                    'column': col,
                    'correlation': float(corr),
                    'p_value': float(p_value),
                    'abs_correlation': abs(float(corr))
                })
            except Exception:
                continue
        
        correlations.sort(key=lambda x: x['abs_correlation'], reverse=True)
        top = correlations[:top_n]
        
        return safe_json_serialize(top)

    def scatter_data(self, x_column, y_column, category_column=None, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if x_column not in data.columns or y_column not in data.columns:
            return None
        
        cols = [x_column, y_column]
        if category_column and category_column in data.columns:
            cols.append(category_column)
        
        df = data[cols].dropna()
        
        return safe_json_serialize(df.to_dict('records'))

    def anova_test(self, group_column, value_column, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if group_column not in data.columns or value_column not in data.columns:
            return None
        
        groups = []
        group_names = []
        
        for name, group in data.groupby(group_column):
            if len(group) > 1:
                groups.append(group[value_column].dropna().values)
                group_names.append(str(name))
        
        if len(groups) < 2:
            return None
        
        try:
            f_stat, p_value = stats.f_oneway(*groups)
        except Exception:
            return None
        
        result = {
            'group_column': group_column,
            'value_column': value_column,
            'f_statistic': float(f_stat),
            'p_value': float(p_value),
            'significant': p_value < 0.05,
            'group_count': len(groups),
            'group_names': group_names
        }
        
        return safe_json_serialize(result)

    def covariance_matrix(self, columns=None, data=None):
        if data is None:
            data = self._get_data()
        if data is None:
            return None
        
        if columns is None:
            columns = data.select_dtypes(include=[np.number]).columns.tolist()
        
        numeric_data = data[columns].select_dtypes(include=[np.number])
        
        if numeric_data.shape[1] < 2:
            return None
        
        cov_matrix = numeric_data.cov()
        
        result = {
            'columns': cov_matrix.columns.tolist(),
            'matrix': cov_matrix.values.tolist()
        }
        
        return safe_json_serialize(result)
