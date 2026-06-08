import os
import sys
import tempfile
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.modules.data_loader import DataLoader
from backend.modules.data_cleaner import DataCleaner
from backend.modules.data_filter import DataFilter
from backend.modules.data_aggregator import DataAggregator
from backend.modules.trend_analyzer import TrendAnalyzer
from backend.modules.correlation_analyzer import CorrelationAnalyzer
from backend.modules.forecast_analyzer import ForecastAnalyzer
from backend.modules.anomaly_detector import AnomalyDetector
from backend.utils.helpers import safe_json_serialize

app = Flask(__name__, 
            static_folder='../frontend',
            static_url_path='')
CORS(app)

data_loader = DataLoader()
data_cleaner = DataCleaner(data_loader)
data_filter = DataFilter(data_loader)
data_aggregator = DataAggregator(data_loader)
trend_analyzer = TrendAnalyzer(data_loader)
correlation_analyzer = CorrelationAnalyzer(data_loader)
forecast_analyzer = ForecastAnalyzer(data_loader)
anomaly_detector = AnomalyDetector(data_loader)


@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': '服务运行正常'})


@app.route('/api/data/upload', methods=['POST'])
def upload_data():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '未找到文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': '未选择文件'}), 400
    
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    try:
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f'upload_{filename}')
        file.save(temp_path)
        
        if ext == '.csv':
            success, message = data_loader.load_csv(temp_path)
        elif ext == '.json':
            success, message = data_loader.load_json(temp_path)
        else:
            return jsonify({'success': False, 'message': '不支持的文件格式，请上传CSV或JSON文件'}), 400
        
        if success:
            summary = data_loader.get_summary()
            column_info = data_loader.get_column_info()
            preview = data_loader.get_preview(20)
            return jsonify({
                'success': True,
                'message': message,
                'summary': summary,
                'column_info': column_info,
                'preview': preview
            })
        else:
            return jsonify({'success': False, 'message': message}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': f'上传失败: {str(e)}'}), 500


@app.route('/api/data/summary', methods=['GET'])
def get_summary():
    summary = data_loader.get_summary()
    if summary is None:
        return jsonify({'success': False, 'message': '暂无数据，请先上传数据'}), 400
    return jsonify({'success': True, 'data': summary})


@app.route('/api/data/preview', methods=['GET'])
def get_preview():
    rows = request.args.get('rows', 100, type=int)
    preview = data_loader.get_preview(rows)
    if preview is None:
        return jsonify({'success': False, 'message': '暂无数据，请先上传数据'}), 400
    return jsonify({'success': True, 'data': preview})


@app.route('/api/data/columns', methods=['GET'])
def get_columns():
    column_info = data_loader.get_column_info()
    if column_info is None:
        return jsonify({'success': False, 'message': '暂无数据，请先上传数据'}), 400
    return jsonify({'success': True, 'data': column_info})


@app.route('/api/data/unique-values', methods=['GET'])
def get_unique_values():
    column = request.args.get('column')
    limit = request.args.get('limit', 100, type=int)
    if not column:
        return jsonify({'success': False, 'message': '缺少column参数'}), 400
    values = data_filter.get_unique_values(column, limit)
    return jsonify({'success': True, 'data': values})


@app.route('/api/data/value-range', methods=['GET'])
def get_value_range():
    column = request.args.get('column')
    if not column:
        return jsonify({'success': False, 'message': '缺少column参数'}), 400
    result = data_filter.get_value_range(column)
    if result is None:
        return jsonify({'success': False, 'message': '列不存在或无数据'}), 400
    return jsonify({'success': True, 'data': result})


@app.route('/api/data/clean', methods=['POST'])
def clean_data():
    options = request.json.get('options', {})
    report = data_cleaner.clean_all(options)
    summary = data_loader.get_summary()
    preview = data_loader.get_preview(20)
    return jsonify({
        'success': True,
        'report': report,
        'summary': summary,
        'preview': preview
    })


@app.route('/api/data/filter', methods=['POST'])
def filter_data():
    filters = request.json.get('filters', [])
    filtered_data = data_filter.filter(filters)
    if filtered_data is None:
        return jsonify({'success': False, 'message': '暂无数据'}), 400
    result = safe_json_serialize(filtered_data.to_dict('records'))
    return jsonify({
        'success': True,
        'count': len(filtered_data),
        'data': result
    })


@app.route('/api/data/aggregate', methods=['POST'])
def aggregate_data():
    data = request.json
    group_by = data.get('group_by', [])
    aggregations = data.get('aggregations', [])
    filters = data.get('filters', [])
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = data_aggregator.aggregate(group_by, aggregations, filtered_data)
    if result is None:
        return jsonify({'success': False, 'message': '聚合失败'}), 400
    
    return jsonify({
        'success': True,
        'data': safe_json_serialize(result.to_dict('records'))
    })


@app.route('/api/chart/line', methods=['POST'])
def line_chart_data():
    data = request.json
    time_column = data.get('time_column')
    value_column = data.get('value_column')
    freq = data.get('freq', 'D')
    func = data.get('func', 'sum')
    filters = data.get('filters', [])
    
    if not time_column or not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = data_aggregator.time_series_aggregate(time_column, value_column, freq, func, filtered_data)
    
    if result is None:
        return jsonify({'success': False, 'message': '生成数据失败'}), 400
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/chart/bar', methods=['POST'])
def bar_chart_data():
    data = request.json
    category_column = data.get('category_column')
    value_column = data.get('value_column')
    func = data.get('func', 'sum')
    filters = data.get('filters', [])
    top_n = data.get('top_n', 20)
    
    if not category_column or not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = data_aggregator.aggregate(
        [category_column],
        [{'column': value_column, 'function': func, 'alias': 'value'}],
        filtered_data
    )
    
    if result is None:
        return jsonify({'success': False, 'message': '生成数据失败'}), 400
    
    result = result.sort_values('value', ascending=False).head(top_n)
    
    return jsonify({
        'success': True,
        'data': safe_json_serialize(result.to_dict('records'))
    })


@app.route('/api/chart/scatter', methods=['POST'])
def scatter_chart_data():
    data = request.json
    x_column = data.get('x_column')
    y_column = data.get('y_column')
    category_column = data.get('category_column')
    filters = data.get('filters', [])
    
    if not x_column or not y_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = correlation_analyzer.scatter_data(x_column, y_column, category_column, filtered_data)
    
    if result is None:
        return jsonify({'success': False, 'message': '生成数据失败'}), 400
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/chart/heatmap', methods=['POST'])
def heatmap_data():
    data = request.json
    x_column = data.get('x_column')
    y_column = data.get('y_column')
    value_column = data.get('value_column')
    aggfunc = data.get('aggfunc', 'mean')
    filters = data.get('filters', [])
    
    if not x_column or not y_column or not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = data_aggregator.heatmap_data(x_column, y_column, value_column, aggfunc, filtered_data)
    
    if result is None:
        return jsonify({'success': False, 'message': '生成数据失败'}), 400
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/analysis/trend', methods=['POST'])
def trend_analysis():
    data = request.json
    time_column = data.get('time_column')
    value_column = data.get('value_column')
    filters = data.get('filters', [])
    
    if not time_column or not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    trend = trend_analyzer.time_series_trend(time_column, value_column, filtered_data)
    
    if trend is None:
        return jsonify({'success': False, 'message': '趋势分析失败'}), 400
    
    return jsonify({'success': True, 'data': trend})


@app.route('/api/analysis/rolling', methods=['POST'])
def rolling_analysis():
    data = request.json
    time_column = data.get('time_column')
    value_column = data.get('value_column')
    window = data.get('window', 7)
    filters = data.get('filters', [])
    
    if not time_column or not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = trend_analyzer.rolling_average(time_column, value_column, window, filtered_data)
    
    if result is None:
        return jsonify({'success': False, 'message': '计算失败'}), 400
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/analysis/seasonal', methods=['POST'])
def seasonal_analysis():
    data = request.json
    time_column = data.get('time_column')
    value_column = data.get('value_column')
    period = data.get('period', 12)
    filters = data.get('filters', [])
    
    if not time_column or not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = trend_analyzer.seasonal_decompose(time_column, value_column, period, filtered_data)
    
    if result is None:
        return jsonify({'success': False, 'message': '季节性分解失败'}), 400
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/analysis/correlation-matrix', methods=['POST'])
def correlation_matrix():
    data = request.json
    columns = data.get('columns')
    method = data.get('method', 'pearson')
    filters = data.get('filters', [])
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = correlation_analyzer.correlation_matrix(columns, method, filtered_data)
    
    if result is None:
        return jsonify({'success': False, 'message': '相关矩阵计算失败'}), 400
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/analysis/pairwise-correlation', methods=['POST'])
def pairwise_correlation():
    data = request.json
    col1 = data.get('col1')
    col2 = data.get('col2')
    method = data.get('method', 'pearson')
    filters = data.get('filters', [])
    
    if not col1 or not col2:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = correlation_analyzer.pairwise_correlation(col1, col2, method, filtered_data)
    
    if result is None:
        return jsonify({'success': False, 'message': '相关性计算失败'}), 400
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/analysis/top-correlations', methods=['POST'])
def top_correlations():
    data = request.json
    target_column = data.get('target_column')
    top_n = data.get('top_n', 10)
    method = data.get('method', 'pearson')
    filters = data.get('filters', [])
    
    if not target_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = correlation_analyzer.top_correlations(target_column, top_n, method, filtered_data)
    
    if result is None:
        return jsonify({'success': False, 'message': '计算失败'}), 400
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/analysis/anova', methods=['POST'])
def anova_test():
    data = request.json
    group_column = data.get('group_column')
    value_column = data.get('value_column')
    filters = data.get('filters', [])
    
    if not group_column or not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = correlation_analyzer.anova_test(group_column, value_column, filtered_data)
    
    if result is None:
        return jsonify({'success': False, 'message': '方差分析失败'}), 400
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/analysis/spatial-distribution', methods=['POST'])
def spatial_distribution():
    data = request.json
    location_column = data.get('location_column')
    value_column = data.get('value_column')
    filters = data.get('filters', [])
    
    if not location_column or not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    filtered_data = data_filter.filter(filters) if filters else None
    
    result = trend_analyzer.spatial_distribution(location_column, value_column, filtered_data)
    
    if result is None:
        return jsonify({'success': False, 'message': '空间分布分析失败'}), 400
    
    return jsonify({'success': True, 'data': result})


@app.route('/api/analysis/forecast', methods=['POST'])
def forecast_analysis():
    data = request.json
    time_column = data.get('time_column')
    value_column = data.get('value_column')
    method = data.get('method', 'linear')
    periods = data.get('periods', 30)
    window = data.get('window', 7)
    alpha = data.get('alpha', 0.3)
    freq = data.get('freq', 'D')
    filters = data.get('filters', [])

    if not time_column or not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400

    filtered_data = data_filter.filter(filters) if filters else None

    result = forecast_analyzer.forecast(
        time_column, value_column, method, periods, window, alpha, freq, filtered_data
    )

    if result is None:
        return jsonify({'success': False, 'message': '预测分析失败'}), 400

    return jsonify({'success': True, 'data': result})


@app.route('/api/analysis/anomaly', methods=['POST'])
def anomaly_detection():
    data = request.json
    value_column = data.get('value_column')
    time_column = data.get('time_column')
    method = data.get('method', 'z_score')
    threshold = data.get('threshold', 3)
    k = data.get('k', 1.5)
    window = data.get('window', 7)
    filters = data.get('filters', [])

    if not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400

    filtered_data = data_filter.filter(filters) if filters else None

    result = anomaly_detector.detect_anomalies(
        value_column, method, time_column, threshold, k, window, filtered_data
    )

    if result is None:
        return jsonify({'success': False, 'message': '异常检测失败'}), 400

    return jsonify({'success': True, 'data': result})


@app.route('/api/analysis/anomaly-summary', methods=['POST'])
def anomaly_summary():
    data = request.json
    value_column = data.get('value_column')
    time_column = data.get('time_column')
    filters = data.get('filters', [])

    if not value_column:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400

    filtered_data = data_filter.filter(filters) if filters else None

    result = anomaly_detector.get_anomaly_summary(value_column, time_column, filtered_data)

    if result is None:
        return jsonify({'success': False, 'message': '异常检测摘要生成失败'}), 400

    return jsonify({'success': True, 'data': result})


@app.route('/api/sample/load', methods=['POST'])
def load_sample_data():
    sample_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'sample_data.csv')
    
    if not os.path.exists(sample_path):
        return jsonify({'success': False, 'message': '示例数据文件不存在'}), 404
    
    success, message = data_loader.load_csv(sample_path)
    
    if success:
        summary = data_loader.get_summary()
        column_info = data_loader.get_column_info()
        preview = data_loader.get_preview(20)
        return jsonify({
            'success': True,
            'message': message,
            'summary': summary,
            'column_info': column_info,
            'preview': preview
        })
    else:
        return jsonify({'success': False, 'message': message}), 400


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
