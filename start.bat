@echo off
echo ========================================
echo  时空数据分析可视化系统 - 启动脚本
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查Python环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Python，请先安装Python 3.8+
    pause
    exit /b 1
)
python --version
echo.

echo [2/3] 安装依赖包...
pip install -r backend/requirements.txt
if %errorlevel% neq 0 (
    echo 警告: 部分依赖安装可能失败，请手动检查
)
echo.

echo [3/3] 生成示例数据...
python data/generate_sample_data.py
echo.

echo ========================================
echo  启动服务中...
echo  服务地址: http://localhost:5000
echo  按 Ctrl+C 停止服务
echo ========================================
echo.

python backend/app.py

pause
