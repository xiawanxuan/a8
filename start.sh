#!/bin/bash
echo "========================================"
echo " 时空数据分析可视化系统 - 启动脚本"
echo "========================================"
echo ""

cd "$(dirname "$0")"

echo "[1/3] 检查Python环境..."
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python 3.8+"
    exit 1
fi
python3 --version
echo ""

echo "[2/3] 安装依赖包..."
pip3 install -r backend/requirements.txt
echo ""

echo "[3/3] 生成示例数据..."
python3 data/generate_sample_data.py
echo ""

echo "========================================"
echo " 启动服务中..."
echo " 服务地址: http://localhost:5000"
echo " 按 Ctrl+C 停止服务"
echo "========================================"
echo ""

python3 backend/app.py
