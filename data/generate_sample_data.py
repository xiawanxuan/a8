import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

np.random.seed(42)

cities = [
    {'city': '北京', 'province': '北京', 'region': '华北', 'lat': 39.9042, 'lon': 116.4074, 'base_sales': 150},
    {'city': '上海', 'province': '上海', 'region': '华东', 'lat': 31.2304, 'lon': 121.4737, 'base_sales': 180},
    {'city': '广州', 'province': '广东', 'region': '华南', 'lat': 23.1291, 'lon': 113.2644, 'base_sales': 140},
    {'city': '深圳', 'province': '广东', 'region': '华南', 'lat': 22.5431, 'lon': 114.0579, 'base_sales': 160},
    {'city': '成都', 'province': '四川', 'region': '西南', 'lat': 30.5728, 'lon': 104.0668, 'base_sales': 110},
    {'city': '杭州', 'province': '浙江', 'region': '华东', 'lat': 30.2741, 'lon': 120.1551, 'base_sales': 130},
    {'city': '武汉', 'province': '湖北', 'region': '华中', 'lat': 30.5928, 'lon': 114.3055, 'base_sales': 100},
    {'city': '西安', 'province': '陕西', 'region': '西北', 'lat': 34.3416, 'lon': 108.9398, 'base_sales': 90},
    {'city': '南京', 'province': '江苏', 'region': '华东', 'lat': 32.0603, 'lon': 118.7969, 'base_sales': 120},
    {'city': '重庆', 'province': '重庆', 'region': '西南', 'lat': 29.4316, 'lon': 106.9123, 'base_sales': 115},
    {'city': '天津', 'province': '天津', 'region': '华北', 'lat': 39.3434, 'lon': 117.3616, 'base_sales': 95},
    {'city': '苏州', 'province': '江苏', 'region': '华东', 'lat': 31.2989, 'lon': 120.5853, 'base_sales': 105},
    {'city': '郑州', 'province': '河南', 'region': '华中', 'lat': 34.7466, 'lon': 113.6254, 'base_sales': 85},
    {'city': '长沙', 'province': '湖南', 'region': '华中', 'lat': 28.2282, 'lon': 112.9388, 'base_sales': 80},
    {'city': '青岛', 'province': '山东', 'region': '华东', 'lat': 36.0671, 'lon': 120.3826, 'base_sales': 90},
]

categories = [
    {'category': '电子产品', 'avg_price': 2500, 'seasonal_factor': 1.0},
    {'category': '服装鞋帽', 'avg_price': 300, 'seasonal_factor': 1.0},
    {'category': '食品饮料', 'avg_price': 80, 'seasonal_factor': 0.8},
    {'category': '家居用品', 'avg_price': 500, 'seasonal_factor': 0.9},
    {'category': '美妆护肤', 'avg_price': 400, 'seasonal_factor': 1.1},
    {'category': '图书文具', 'avg_price': 60, 'seasonal_factor': 0.7},
]

channels = ['线上', '线下']
payment_methods = ['支付宝', '微信支付', '银行卡', '现金']

start_date = datetime(2023, 1, 1)
end_date = datetime(2023, 12, 31)
days = (end_date - start_date).days + 1

records = []

for day in range(days):
    current_date = start_date + timedelta(days=day)
    date_str = current_date.strftime('%Y-%m-%d')
    month = current_date.month
    day_of_week = current_date.weekday()
    
    seasonal_index = np.sin(2 * np.pi * (month - 1) / 12) * 0.3 + 1
    weekend_factor = 1.3 if day_of_week >= 5 else 1.0
    
    for city_info in cities:
        for cat_info in categories:
            base_sales = city_info['base_sales'] * cat_info['seasonal_factor']
            noise = np.random.normal(1, 0.15)
            
            sales_amount = base_sales * seasonal_index * weekend_factor * noise * cat_info['avg_price']
            order_count = int(base_sales * seasonal_index * weekend_factor * noise / 3)
            customer_count = int(order_count * np.random.uniform(0.6, 0.9))
            
            if order_count < 1:
                order_count = 1
            if customer_count < 1:
                customer_count = 1
            
            avg_order_value = sales_amount / order_count if order_count > 0 else 0
            
            channel = np.random.choice(channels, p=[0.6, 0.4])
            payment = np.random.choice(payment_methods, p=[0.4, 0.35, 0.2, 0.05])
            
            records.append({
                'date': date_str,
                'year': current_date.year,
                'month': month,
                'quarter': (month - 1) // 3 + 1,
                'city': city_info['city'],
                'province': city_info['province'],
                'region': city_info['region'],
                'latitude': city_info['lat'],
                'longitude': city_info['lon'],
                'category': cat_info['category'],
                'channel': channel,
                'payment_method': payment,
                'sales_amount': round(sales_amount, 2),
                'order_count': order_count,
                'customer_count': customer_count,
                'avg_order_value': round(avg_order_value, 2),
                'avg_price': cat_info['avg_price']
            })

df = pd.DataFrame(records)

output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sample_data.csv')
df.to_csv(output_path, index=False, encoding='utf-8')

print(f"示例数据生成完成，共 {len(df)} 条记录")
print(f"保存路径: {output_path}")
print(f"\n数据概览:")
print(f"  时间范围: 2023-01-01 至 2023-12-31")
print(f"  城市数量: {len(cities)}")
print(f"  产品类别: {len(categories)}")
print(f"  数据字段: {', '.join(df.columns.tolist())}")
