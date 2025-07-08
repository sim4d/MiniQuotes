// pages/bp-monitor/bp-monitor.js
import * as echarts from '../../components/ec-canvas/echarts';

const app = getApp();

// 格式化数字，用于补零
function formatNumber(n) {
  n = n.toString();
  return n[1] ? n : '0' + n;
}

// 格式化日期为 YYYY-MM-DD 格式
function formatDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return [year, month, day].map(formatNumber).join('-');
}

// 格式化显示日期
function formatDisplayDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  return `${year}年${month}月${day}日 星期${weekDay}`;
}


// 计算血压颜色
function calculateColor(systolic, diastolic) {
  // 定义血压级别阈值 (示例，请根据医学标准调整)
  const normalSysMax = 129;
  const normalDiaMax = 84;

  const preHyperSysMin = 130;
  const preHyperSysMax = 139;
  const preHyperDiaMin = 85;
  const preHyperDiaMax = 89;

  const hyper1SysMin = 140;
  const hyper1SysMax = 159;
  const hyper1DiaMin = 90;
  const hyper1DiaMax = 99;

  // 默认颜色 (例如，灰色表示数据可能不完整或异常)
  let color = '#B0B0B0'; // Light Grey

  if (systolic > 0 && diastolic > 0 && systolic > diastolic) {
    if (systolic <= normalSysMax && diastolic <= normalDiaMax) {
      color = '#90EE90'; // 正常: Light Green
    } else if ((systolic >= preHyperSysMin && systolic <= preHyperSysMax) || (diastolic >= preHyperDiaMin && diastolic <= preHyperDiaMax)) {
      color = '#FFD700'; // 偏高/高血压前期: Gold/Light Orange
    } else if ((systolic >= hyper1SysMin && systolic <= hyper1SysMax) || (diastolic >= hyper1DiaMin && diastolic <= hyper1DiaMax)) {
      color = '#FFA07A'; // 1级高血压: Light Salmon (偏红)
    } else if (systolic >= (hyper1SysMax + 1) || diastolic >= (hyper1DiaMax + 1)) {
      color = '#FF4500'; // 2级及以上高血压: OrangeRed (更红)
    }
  }
  return color;
}

Page({
  data: {
    currentView: 'day', // day, week, month, year
    currentDate: '',
    displayDate: '',
    bpRecords: [],
    chartData: {},
    ec: {
      lazyLoad: true // 改为延迟加载模式
    },
    showAddDialog: false,
    newRecord: {
      systolic: '',
      diastolic: '',
      heartRate: '',
      time: '',
      date: ''
    },
    forceOldCanvas: true, // 暂时强制使用旧版Canvas API来避免节点获取问题
    // 自定义提示框相关数据
    showCustomTooltip: false,
    tooltipData: {
      timeLabel: '',
      systolic: 0,
      diastolic: 0,
      heartRate: 0
    },
    // 滑动窗口相关数据
    windowStartIndex: 0, // 当前窗口的起始索引
    allChartData: null, // 存储所有处理后的数据
    isSwipeEnabled: true, // 是否启用滑动
    forceRefresh: false // iOS强制刷新标志
  },

  onLoad: function (options) {
    // 初始化触摸相关变量
    this.touchTimer = null;
    this.hideTooltipTimer = null; // New timer for hiding tooltip
    this.touchStartTime = 0;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isLongPressActive = false; // New state to track active long press
    
    // 初始化滑动相关变量
    this.swipeStartX = 0;
    this.swipeThreshold = 50; // 滑动阈值（像素）
    this.isSwipeInProgress = false;

    this.setData({
      currentDate: formatDate(new Date()),
      displayDate: formatDisplayDate(new Date())
    });
    this.loadBPRecords();
  },

  onShow: function () {
    this.loadBPRecords();
    if (this.chart) {
      // 强制调整图表大小并更新数据
      setTimeout(() => {
        this.forceChartResize();
        this.updateChart();
      }, 300);
    } else {
      // 如果图表还未初始化，尝试重新初始化
      console.log('图表未初始化，尝试重新初始化');
      setTimeout(() => {
        this.checkAndInitChart();
      }, 500);
    }
  },

  onResize: function () {
    // 页面尺寸变化时调整图表大小
    if (this.chart) {
      setTimeout(() => {
        this.forceChartResize();
      }, 300);
    }
  },

  onReady: function () {
    // 页面渲染完成后再初始化图表
    console.log('页面onReady，准备初始化图表');

    // 使用更长的延时确保组件已完全渲染
    setTimeout(() => {
      this.initChart();
    }, 500);
  },

  // 初始化图表
  initChart: function () {
    console.log('设置图表初始化回调');

    // 获取组件实例
    const ecComponent = this.selectComponent('#mychart-dom-line');
    console.log('获取到图表组件:', ecComponent);

    if (!ecComponent) {
      console.error('无法获取图表组件，将重试');
      setTimeout(() => this.initChart(), 800);
      return;
    }

    // 设置回调函数并立即初始化
    this.setData({
      ec: {
        onInit: this.initChartComponent.bind(this)
      }
    }, () => {
      // 设置完成后，尝试主动调用组件的init方法
      if (typeof ecComponent.init === 'function') {
        console.log('主动调用组件init方法');
        ecComponent.init((canvas, ctx) => {
          return this.initChartComponent(canvas, ctx);
        });
      }
    });

    console.log('图表初始化回调已设置');
  },

  initChartComponent: function (canvas, ctx, width, height, dpr) {
    console.log('初始化图表组件开始', { canvas: !!canvas, ctx: !!ctx, width, height, dpr });

    if (!canvas) {
      console.error('Canvas对象为空，无法初始化图表');
      return null;
    }

    try {
      // 获取设备信息进行适配
      let systemInfo, windowInfo, deviceInfo;
      try {
        deviceInfo = wx.getDeviceInfo();
        windowInfo = wx.getWindowInfo();
        systemInfo = { ...deviceInfo, ...windowInfo };
      } catch (e) {
        console.warn('获取新版系统信息失败，使用旧版API:', e);
        systemInfo = wx.getSystemInfoSync();
      }

      const isWindows = systemInfo.platform === 'windows' || (systemInfo.system && systemInfo.system.toLowerCase().includes('windows'));
      const isIOS = systemInfo.platform === 'ios';
      const screenWidth = systemInfo.screenWidth;
      const screenHeight = systemInfo.screenHeight;

      console.log('设备信息:', {
        platform: systemInfo.platform,
        system: systemInfo.system,
        isWindows,
        isIOS,
        screenWidth,
        screenHeight
      });

      // 使用传入的参数或默认值
      const canvasWidth = width || 300;
      const canvasHeight = height || 500;
      const pixelRatio = dpr || systemInfo.pixelRatio || 1;

      console.log('使用尺寸:', { canvasWidth, canvasHeight, pixelRatio });

      // 确保canvas上下文存在
      if (!ctx) {
        console.log('没有传入ctx，尝试获取');
        ctx = canvas.getContext('2d');
      }

      if (!ctx) {
        console.error('无法获取canvas上下文');
        return null;
      }

      // 设置canvas尺寸
      if (this.data.forceOldCanvas) {
        // 旧版canvas不需要设置尺寸
        console.log('使用旧版Canvas，不设置像素尺寸');
      } else {
        // 新版canvas需要设置尺寸
        canvas.width = canvasWidth * pixelRatio;
        canvas.height = canvasHeight * pixelRatio;
        ctx.scale(pixelRatio, pixelRatio);
      }

      // 获取容器实际尺寸以确保图表正确缩放
      let containerWidth = canvasWidth;
      let containerHeight = canvasHeight;

      try {
        const query = wx.createSelectorQuery().in(this);
        query.select('.chart-container')
          .boundingClientRect()
          .exec((res) => {
            if (res && res[0]) {
              // 应用更小的尺寸以便图表能够在容器中居中
              containerWidth = Math.floor(res[0].width * 0.9) || canvasWidth; // 使用80%的容器宽度
              containerHeight = Math.floor(res[0].height * 0.9) || canvasHeight; // 使用80%的容器高度
              console.log('容器实际尺寸:', { containerWidth, containerHeight });

              // 重新设置canvas尺寸
              if (!this.data.forceOldCanvas) {
                canvas.width = containerWidth * pixelRatio;
                canvas.height = containerHeight * pixelRatio;
                canvas.style.width = containerWidth + 'px';
                canvas.style.height = containerHeight + 'px';
                ctx.scale(pixelRatio, pixelRatio);
              }

              // 调整后再次初始化图表
              if (this.chart) {
                this.chart.resize({
                  width: containerWidth,
                  height: containerHeight
                });
              }
            }
          });
      } catch (e) {
        console.error('获取容器尺寸失败:', e);
      }

      // 根据设备类型调整缩放比例，确保图表不超出容器
      let scaleFactor = 0.5; // 默认使用85%的容器空间，留出边距
      if (isWindows) {
        scaleFactor = 0.5; // Windows设备稍大一些
      } else if (isIOS) {
        scaleFactor = 0.33; // iOS设备更保守一些
      }

      console.log('使用缩放系数:', scaleFactor, '设备类型:', systemInfo.platform);

      // 使用适当的有效尺寸，确保不超出容器
      const effectiveWidth = containerWidth * scaleFactor;
      const effectiveHeight = containerHeight * scaleFactor;

      const chart = echarts.init(canvas, null, {
        width: effectiveWidth,
        height: effectiveHeight,
        devicePixelRatio: pixelRatio,
        renderer: 'canvas'
      });

      // 根据设备类型调整网格设置，确保图表内容完全显示在容器内
      let gridSettings;
      if (isWindows) {
        // Windows设备使用适中的布局
        gridSettings = {
          left: '10%',
          right: '10%',
          top: '15%',
          bottom: '12%',
          containLabel: true
        };
      } else {
        // 其他设备使用标准布局
        gridSettings = {
          left: '12%',
          right: '12%',
          top: '18%',
          bottom: '15%',
          containLabel: true
        };
      }

      console.log('使用网格设置:', gridSettings);

      chart.setOption({
        animation: false,
        textStyle: {
          fontSize: 12
        },
        backgroundColor: 'transparent',
        grid: gridSettings
      });

      console.log('ECharts初始化结果:', !!chart);

      if (canvas && typeof canvas.setChart === 'function') {
        canvas.setChart(chart);
        console.log('Canvas setChart调用成功');
      }

      this.chart = chart;
      console.log('图表对象已保存到this.chart:', !!this.chart);

      // 立即更新图表数据
      const chartData = this.getChartData();
      const option = this.getChartOption(chartData);

      chart.setOption(option, true, true); // 初始化时也使用完全替换
      console.log('图表初始化时已设置数据');

      // 确保图表能正确响应容器尺寸变化
      setTimeout(() => {
        if (this.chart) {
          console.log('延迟调整图表大小以适应容器');
          this.forceChartResize();
        }
      }, 500);

      // 如果是旧版Canvas，手动触发绘制
      if (this.data.forceOldCanvas && ctx && typeof ctx.draw === 'function') {
        setTimeout(() => {
          console.log('手动触发Canvas绘制');
          ctx.draw(true);
        }, 100);
      }

      return chart;
    } catch (error) {
      console.error('图表初始化失败:', error);
      this.chart = null;
      return null;
    }
  },

  // 微信小程序触摸事件处理
  onChartTouchStart: function (e) {
    console.log('图表触摸开始:', e);

    // Reset long press active state
    this.isLongPressActive = false;

    // Clear any existing hide timer if a new touch starts
    if (this.hideTooltipTimer) {
      clearTimeout(this.hideTooltipTimer);
      this.hideTooltipTimer = null;
    }

    this.touchStartTime = Date.now();
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    
    // 记录滑动起始位置
    this.swipeStartX = e.touches[0].clientX;
    this.isSwipeInProgress = false;

    // Set long press timer
    this.touchTimer = setTimeout(() => {
      console.log('检测到长按');
      this.isLongPressActive = true; // Set long press active
      this.handleTouchPress(e);
    }, 300); // Reduced long press time to 300ms for better responsiveness
  },

  onChartTouchMove: function (e) {
    if (e.touches[0]) {
      const moveX = Math.abs(e.touches[0].clientX - this.touchStartX);
      const moveY = Math.abs(e.touches[0].clientY - this.touchStartY);
      const swipeDeltaX = e.touches[0].clientX - this.swipeStartX;

      // 调试滑动检测
      if (Math.abs(swipeDeltaX) > 10) {
        console.log('滑动检测:', {
          swipeDeltaX: swipeDeltaX,
          moveX: moveX,
          moveY: moveY,
          isSwipeEnabled: this.data.isSwipeEnabled,
          currentView: this.data.currentView,
          hasAllChartData: !!this.data.allChartData,
          dataLength: this.data.allChartData ? this.data.allChartData.xData.length : 0
        });
      }

      // 检测是否为水平滑动（所有视图都启用）
      if (Math.abs(swipeDeltaX) > 20 && // 进一步降低阈值
          moveY < moveX / 2) {
        this.isSwipeInProgress = true;
        
        // 取消长按检测
        if (this.touchTimer) {
          clearTimeout(this.touchTimer);
          this.touchTimer = null;
        }
        
        // 隐藏提示框
        this.hideCustomTooltip();
        return;
      }

      // If long press is not active yet and finger moves significantly, cancel long press timer
      if (!this.isLongPressActive && (moveX > 10 || moveY > 10)) {
        if (this.touchTimer) {
          clearTimeout(this.touchTimer);
          this.touchTimer = null;
        }
        // If tooltip is already shown (e.g., from a previous long press that ended), hide it
        this.hideCustomTooltip();
        return; // Stop further processing for this move event
      }

      // If long press is active, continuously update the tooltip
      if (this.isLongPressActive) {
        this.handleTouchPress(e);
      }
    }
  },

  onChartTouchEnd: function (e) {
    // Store the state before resetting
    const wasLongPressActiveBeforeEnd = this.isLongPressActive;

    // Clear long press timer
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    // Reset long press active state
    this.isLongPressActive = false;

    // 处理滑动手势 - 使用changedTouches获取结束位置
    const endTouch = e.changedTouches ? e.changedTouches[0] : null;
    if (endTouch) {
      const swipeDeltaX = endTouch.clientX - this.swipeStartX;
      
      // 调试滑动结束
      console.log('触摸结束，滑动检测:', {
        swipeDeltaX: swipeDeltaX,
        isSwipeEnabled: this.data.isSwipeEnabled,
        currentView: this.data.currentView,
        hasAllChartData: !!this.data.allChartData,
        dataLength: this.data.allChartData ? this.data.allChartData.xData.length : 0
      });
      
      // 检查是否为有效的滑动手势
      if (Math.abs(swipeDeltaX) > 20) { // 进一步降低阈值
        console.log('检测到有效滑动手势，距离:', swipeDeltaX, '方向:', swipeDeltaX > 0 ? '右' : '左');
        
        // 日视图：滑动切换日期
        if (this.data.currentView === 'day') {
          console.log('日视图滑动，切换日期');
          if (swipeDeltaX > 0) {
            // 向右滑动，显示前一天
            this.prevPeriod();
          } else {
            // 向左滑动，显示后一天
            this.nextPeriod();
          }
          this.isSwipeInProgress = false;
          return;
        }
        
        // 周/月/年视图：滑动窗口
        if (this.data.isSwipeEnabled) {
          console.log('滑动窗口视图');
          
          // 确保有数据可以滑动
          if (!this.data.allChartData || this.data.allChartData.xData.length === 0) {
            console.log('尝试生成连续数据以支持滑动');
            const chartData = this.getContinuousChartData(
              this.data.currentView,
              this.data.currentDate,
              this.data.bpRecords
            );
            
            if (chartData && chartData.xData && chartData.xData.length > 0) {
              console.log('成功生成连续数据，设置并执行滑动');
              this.setData({
                allChartData: chartData,
                windowStartIndex: 0
              }, () => {
                // 重新执行滑动
                if (swipeDeltaX > 0) {
                  this.slideWindow('left');
                } else {
                  this.slideWindow('right');
                }
              });
            } else {
              console.error('无法生成连续数据');
              wx.showToast({
                title: '暂无数据',
                icon: 'none',
                duration: 1500
              });
            }
          } else {
            // 有数据，直接执行滑动
            if (swipeDeltaX > 0) {
              // 向右滑动，显示之前的数据
              console.log('向右滑动，显示之前的数据');
              this.slideWindow('left');
            } else {
              // 向左滑动，显示之后的数据
              console.log('向左滑动，显示之后的数据');
              this.slideWindow('right');
            }
          }
        }
        
        this.isSwipeInProgress = false;
        return;
      }
    }

    // If it was a short press (less than 300ms) AND a long press was NOT active, trigger tooltip display once
    const touchDuration = Date.now() - this.touchStartTime;
    if (touchDuration < 300 && !wasLongPressActiveBeforeEnd && !this.isSwipeInProgress) {
      this.handleTouchPress(e.changedTouches ? { touches: e.changedTouches } : e);
    }

    // Delay hiding tooltip
    if (!this.isSwipeInProgress) {
      this.hideTooltipTimer = setTimeout(() => {
        this.hideCustomTooltip();
      }, 5000); // Tooltip stays for 5 seconds
    }
    
    this.isSwipeInProgress = false;
  },

  onChartTouchCancel: function (e) {
    console.log('图表触摸取消:', e);

    // Clear long press timer
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
    // Clear hide tooltip timer as well
    if (this.hideTooltipTimer) {
      clearTimeout(this.hideTooltipTimer);
      this.hideTooltipTimer = null;
    }

    // Reset long press active state
    this.isLongPressActive = false;

    // Hide tooltip
    this.hideCustomTooltip();
  },

  // 处理触摸按压事件
  handleTouchPress: function (e) {
    // // console.log('处理触摸按压事件:', e); // Commented out for debugging

    if (!e.touches || e.touches.length === 0) {
      // // console.log('无效的触摸事件'); // Commented out for debugging
      return;
    }

    const touch = e.touches[0];
    // // console.log('触摸坐标:', { x: touch.clientX, y: touch.clientY }); // Commented out for debugging

    // 获取图表容器的位置信息
    const query = this.createSelectorQuery();
    query.select('#mychart-dom-line')
      .boundingClientRect()
      .exec((res) => {
        // // console.log('图表容器信息:', res); // Commented out for debugging

        if (res && res[0]) {
          const rect = res[0];
          const relativeX = touch.clientX - rect.left;
          const relativeY = touch.clientY - rect.top;

          // // console.log('相对坐标:', { relativeX, relativeY, rect }); // Commented out for debugging

          // 转换为数据索引
          this.convertTouchToDataIndex(relativeX, relativeY, rect.width, rect.height);
        } else {
          console.error('无法获取图表容器信息');
        }
      });
  },

  // 将触摸坐标转换为数据索引
  convertTouchToDataIndex: function (x, y, width, height) {
    // // console.log('转换触摸坐标到数据索引:', { x, y, width, height }); // Commented out for debugging

    const chartData = this.getChartData();
    if (!chartData.customBpSeriesData || chartData.customBpSeriesData.length === 0) {
      // // console.log('没有图表数据'); // Commented out for debugging
      return;
    }

    // 考虑图表的边距和缩放
    // 图表实际绘制区域通常不是整个canvas，需要考虑margin
    const leftMargin = width * 0.1; // 大约10%的左边距
    const rightMargin = width * 0.1; // 大约10%的右边距
    const topMargin = height * 0.2; // 大约20%的上边距（包含标题和图例）
    const bottomMargin = height * 0.15; // 大约15%的下边距

    const chartAreaX = x - leftMargin;
    const chartAreaWidth = width - leftMargin - rightMargin;
    const chartAreaY = y - topMargin;
    const chartAreaHeight = height - topMargin - bottomMargin;

    // console.log('图表绘制区域:', { // Commented out for debugging
    //   chartAreaX,
    //   chartAreaY,
    //   chartAreaWidth,
    //   chartAreaHeight,
    //   leftMargin,
    //   rightMargin,
    //   topMargin,
    //   bottomMargin
    // });

    // 检查触摸点是否在图表绘制区域内
    if (chartAreaX < 0 || chartAreaX > chartAreaWidth ||
      chartAreaY < 0 || chartAreaY > chartAreaHeight) {
      // // console.log('触摸点不在图表绘制区域内'); // Commented out for debugging
      return;
    }

    // 计算数据索引 - 使用更精确的索引计算
    const dataLength = chartData.customBpSeriesData.length;
    const ratio = chartAreaX / chartAreaWidth;
    
    // 计算每个柱状图的实际宽度区间
    const barInterval = chartAreaWidth / dataLength;
    let estimatedIndex = Math.floor(chartAreaX / barInterval);
    
    // 确保索引在有效范围内
    estimatedIndex = Math.max(0, Math.min(estimatedIndex, dataLength - 1));

    // console.log('计算结果:', { // Commented out for debugging
    //   ratio,
    //   estimatedIndex,
    //   dataLength,
    //   barInterval,
    //   chartAreaX,
    //   chartAreaWidth,
    //   touchInChartArea: true
    // });

    if (estimatedIndex >= 0 && estimatedIndex < dataLength) {
      // // console.log('显示提示框，数据索引:', estimatedIndex); // Commented out for debugging
      this.showCustomTooltip(estimatedIndex);
    } else {
      // // console.log('数据索引超出范围'); // Commented out for debugging
    }
  },

  // 检查并初始化图表
  checkAndInitChart: function () {
    console.log('检查图表初始化状态');
    if (!this.chart) {
      console.log('图表未初始化，重新设置初始化回调');
      this.initChart();
    } else {
      console.log('图表已初始化，更新数据');
      this.updateChart();
    }
  },

  // 强制调整图表大小
  forceChartResize: function () {
    if (!this.chart) {
      console.log('图表未初始化，无法调整大小');
      return;
    }

    try {
      // 获取设备信息进行适配
      let systemInfo;
      try {
        const deviceInfo = wx.getDeviceInfo();
        const windowInfo = wx.getWindowInfo();
        systemInfo = { ...deviceInfo, ...windowInfo };
      } catch (e) {
        console.warn('获取新版系统信息失败，使用旧版API:', e);
        systemInfo = wx.getSystemInfoSync();
      }

      const isWindows = systemInfo.platform === 'windows' || (systemInfo.system && systemInfo.system.toLowerCase().includes('windows'));

      const query = wx.createSelectorQuery().in(this);
      query.select('.chart-container')
        .boundingClientRect()
        .exec((res) => {
          if (res && res[0]) {
            const containerWidth = Math.floor(res[0].width);
            const containerHeight = Math.floor(res[0].height);
            console.log('强制调整图表大小:', { containerWidth, containerHeight });

            // 根据设备类型调整缩放比例，确保不超出容器
            const scaleFactor = isWindows ? 0.5 : 0.33;
            console.log('调整大小时使用缩放系数:', scaleFactor, '设备类型:', systemInfo.platform);

            // 使用适当的有效尺寸，确保不超出容器
            const effectiveWidth = containerWidth * scaleFactor;
            const effectiveHeight = containerHeight * scaleFactor;

            this.chart.resize({
              width: effectiveWidth,
              height: effectiveHeight
            });

            // 重新设置图表选项以确保完整显示
            const chartData = this.getChartData();
            const option = this.getChartOption(chartData);
            this.chart.setOption(option, true);
          }
        });
    } catch (error) {
      console.error('强制调整图表大小失败:', error);
    }
  },

  // 调试方法 - 检查图表状态
  debugChartStatus: function () {
    console.log('=== 图表状态调试信息 ===');
    console.log('this.chart:', !!this.chart);
    console.log('数据记录数量:', this.data.bpRecords.length);
    console.log('当前视图:', this.data.currentView);
    console.log('当前日期:', this.data.currentDate);
    console.log('ec配置:', this.data.ec);
    console.log('========================');
  },

  // 加载血压记录
  loadBPRecords: function () {
    let records = [];

    try {
      records = wx.getStorageSync('bpRecords') || [];
      console.log('从本地存储加载记录，数量:', records.length);
    } catch (e) {
      console.error('加载数据失败:', e);
      records = [];
    }

    // 如果没有数据且未初始化过，创建一些示例数据
    if (records.length === 0 && !wx.getStorageSync('bpInitialized')) {
      console.log('首次使用，创建示例数据');
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

      // 模拟数据
      const mockRecords = [
        {
          id: Date.now() - 1000,
          date: formatDate(today),
          time: '08:30',
          systolic: 120,
          diastolic: 80,
          heartRate: 75,
          timestamp: new Date(`${formatDate(today)} 08:30`).getTime()
        },
        {
          id: Date.now() - 2000,
          date: formatDate(today),
          time: '14:15',
          systolic: 125,
          diastolic: 82,
          heartRate: 78,
          timestamp: new Date(`${formatDate(today)} 14:15`).getTime()
        },
        {
          id: Date.now() - 3000,
          date: formatDate(today),
          time: '20:45',
          systolic: 118,
          diastolic: 79,
          heartRate: 72,
          timestamp: new Date(`${formatDate(today)} 20:45`).getTime()
        },
        {
          id: Date.now() - 4000,
          date: formatDate(yesterday),
          time: '09:00',
          systolic: 130,
          diastolic: 85,
          heartRate: 80,
          timestamp: new Date(`${formatDate(yesterday)} 09:00`).getTime()
        },
        {
          id: Date.now() - 5000,
          date: formatDate(yesterday),
          time: '18:30',
          systolic: 122,
          diastolic: 81,
          heartRate: 76,
          timestamp: new Date(`${formatDate(yesterday)} 18:30`).getTime()
        },
        {
          id: Date.now() - 6000,
          date: formatDate(twoDaysAgo),
          time: '10:15',
          systolic: 115,
          diastolic: 75,
          heartRate: 70,
          timestamp: new Date(`${formatDate(twoDaysAgo)} 10:15`).getTime()
        }
      ];

      // 保存示例数据和初始化标记
      wx.setStorageSync('bpRecords', mockRecords);
      wx.setStorageSync('bpInitialized', true);
      console.log('示例数据已创建并保存');
    }

    this.setData({
      bpRecords: records
    });
  },

  // 保存血压记录
  saveBPRecords: function (records) {
    try {
      wx.setStorageSync('bpRecords', records);
      console.log('数据已保存到本地存储，记录数量:', records.length);
      this.setData({
        bpRecords: records
      });
      console.log('页面数据已更新，当前记录数量:', this.data.bpRecords.length);
    } catch (e) {
      console.error('保存数据失败:', e);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },

  // 切换视图
  switchView: function (e) {
    const view = e.currentTarget.dataset.view;
    console.log('切换视图到:', view);
    
    // 检测是否为iOS设备
    const systemInfo = wx.getSystemInfoSync();
    const isIOS = systemInfo.platform === 'ios';
    
    this.setData({
      currentView: view,
      windowStartIndex: 0, // 重置窗口位置
      allChartData: null,
      isSwipeEnabled: true // 所有视图都启用滑动
    }, () => {
      // 确保状态更新完成后再更新图表
      console.log('视图切换完成，开始更新图表，iOS设备:', isIOS);
      
      // iOS设备需要更长的延迟
      const delay = isIOS ? 300 : 100;
      
      setTimeout(() => {
        if (this.chart) {
          this.forceChartResize();
        }
        this.updateChart();
      }, delay);
    });
  },

  // 前一天/周/月/年
  prevPeriod: function () {
    const { currentView, allChartData, windowStartIndex } = this.data;
    
    console.log('prevPeriod调用，当前视图:', currentView, '有数据:', !!allChartData);
    
    // 如果是周/月/年视图且有数据，使用大步跳跃
    if (currentView !== 'day' && allChartData) {
      // 根据视图类型设置窗口大小
      let windowSize = 7;
      if (currentView === 'week') {
        windowSize = 7;  // 周视图显示7天
      } else if (currentView === 'month') {
        windowSize = 15; // 月视图显示15天
      } else if (currentView === 'year') {
        windowSize = 8; // 年视图显示8个月
      }
      let jumpSize = windowSize; // 默认跳跃一个窗口大小
      
      if (currentView === 'week') {
        jumpSize = 7; // 跳跃7天
      } else if (currentView === 'month') {
        jumpSize = 15; // 跳跃15天
      } else if (currentView === 'year') {
        jumpSize = windowSize; // 年视图：每次移动8个月
      }
      
      const newStartIndex = Math.max(0, windowStartIndex - jumpSize);
      console.log('大步跳跃，从索引', windowStartIndex, '到', newStartIndex);
      
      // 强制刷新窗口索引
      this.data.windowStartIndex = -1;
      this.setData({
        windowStartIndex: newStartIndex
      }, () => {
        this.updateDisplayDateFromWindow();
        
        // 对于iOS设备，使用更激进的更新策略
        const systemInfo = wx.getSystemInfoSync();
        const isIOS = systemInfo.platform === 'ios';
        
        if (isIOS) {
          setTimeout(() => {
            this.updateChartWithWindow();
          }, 200);
        } else {
          wx.nextTick(() => {
            this.updateChartWithWindow();
          });
        }
      });
      return;
    }
    
    // 日视图保持原有逻辑
    const currentDate = new Date(this.data.currentDate);
    let newDate;

    switch (currentView) {
      case 'day':
        newDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        newDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, currentDate.getDate());
        break;
      case 'year':
        newDate = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), currentDate.getDate());
        break;
    }

    this.setData({
      currentDate: formatDate(newDate),
      displayDate: formatDisplayDate(newDate),
      windowStartIndex: 0, // 重置窗口位置
      allChartData: null
    }, () => {
      this.updateChart();
    });
  },

  // 后一天/周/月/年
  nextPeriod: function () {
    const { currentView, allChartData, windowStartIndex } = this.data;
    
    console.log('nextPeriod调用，当前视图:', currentView, '有数据:', !!allChartData);
    
    // 如果是周/月/年视图且有数据，使用大步跳跃
    if (currentView !== 'day' && allChartData) {
      // 根据视图类型设置窗口大小
      let windowSize = 7;
      if (this.data.currentView === 'week') {
        windowSize = 7;  // 周视图显示7天
      } else if (this.data.currentView === 'month') {
        windowSize = 15; // 月视图显示15天
      } else if (this.data.currentView === 'year') {
        windowSize = 8; // 年视图显示8个月
      }
      const maxStartIndex = Math.max(0, allChartData.xData.length - windowSize);
      let jumpSize = windowSize; // 默认跳跃一个窗口大小
      
      if (currentView === 'week') {
        jumpSize = 7; // 跳跃7天
      } else if (currentView === 'month') {
        jumpSize = 15; // 跳跃15天
      } else if (currentView === 'year') {
        jumpSize = windowSize; // 年视图：每次移动8个月
      }
      
      const newStartIndex = Math.min(maxStartIndex, windowStartIndex + jumpSize);
      console.log('大步跳跃，从索引', windowStartIndex, '到', newStartIndex);
      
      // 强制刷新窗口索引
      this.data.windowStartIndex = -1;
      this.setData({
        windowStartIndex: newStartIndex
      }, () => {
        this.updateDisplayDateFromWindow();
        
        // 对于iOS设备，使用更激进的更新策略
        const systemInfo = wx.getSystemInfoSync();
        const isIOS = systemInfo.platform === 'ios';
        
        if (isIOS) {
          setTimeout(() => {
            this.updateChartWithWindow();
          }, 200);
        } else {
          wx.nextTick(() => {
            this.updateChartWithWindow();
          });
        }
      });
      return;
    }
    
    // 日视图保持原有逻辑
    const currentDate = new Date(this.data.currentDate);
    let newDate;

    switch (currentView) {
      case 'day':
        newDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'week':
        newDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
        break;
      case 'year':
        newDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
        break;
    }

    this.setData({
      currentDate: formatDate(newDate),
      displayDate: formatDisplayDate(newDate),
      windowStartIndex: 0, // 重置窗口位置
      allChartData: null
    }, () => {
      this.updateChart();
    });
  },

  // 返回今天
  goToToday: function () {
    const today = new Date();
    this.setData({
      currentDate: formatDate(today),
      displayDate: formatDisplayDate(today),
      windowStartIndex: 0, // 重置窗口位置
      allChartData: null // 清空窗口数据，强制重新生成
    });
    this.updateChart();
    wx.showToast({
      title: '已返回今天',
      icon: 'none',
      duration: 1000
    });
  },

  // 显示添加记录对话框
  showAddRecord: function () {
    const now = new Date();
    const currentTime = `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`;

    this.setData({
      showAddDialog: true,
      newRecord: {
        systolic: '',
        diastolic: '',
        heartRate: '',
        time: currentTime,
        date: formatDate(now) // 初始化为当前日期
      }
    });
  },

  // 隐藏添加记录对话框
  hideAddRecord: function () {
    console.log('隐藏添加记录对话框');

    this.setData({
      showAddDialog: false
    }, () => {
      console.log('模态框状态已隐藏:', this.data.showAddDialog);

      // 重新调整图表大小
      setTimeout(() => {
        if (this.chart) {
          this.forceChartResize();
        }
      }, 300);
    });
  },

  // 阻止事件冒泡
  stopPropagation: function () {
    // 空函数，用于阻止事件冒泡
  },

  // 输入框变化
  onInputChange: function (e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`newRecord.${field}`]: value
    });
  },

  // 日期选择变化
  onDateChange: function (e) {
    const selectedDate = e.detail.value;
    this.setData({
      currentDate: selectedDate,
      displayDate: this.formatDisplayDate(new Date(selectedDate))
    });
  },

  // 日期选择器改变事件
  onDateChange: function (e) {
    this.setData({
      'newRecord.date': e.detail.value
    });
  },

  // 保存新记录
  saveRecord: function () {
    const { newRecord } = this.data;
    const systolic = parseInt(newRecord.systolic);
    const diastolic = parseInt(newRecord.diastolic);
    const heartRate = parseInt(newRecord.heartRate);
    const time = newRecord.time;
    const date = newRecord.date;

    // 校验时间格式
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      wx.showToast({
        title: '时间格式不正确 (HH:MM)',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 校验血压和心率是否为数字
    if (isNaN(systolic) || isNaN(diastolic) || isNaN(heartRate)) {
      wx.showToast({
        title: '血压和心率必须是有效数字',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 校验高压、低压、心率的正常值范围
    const BP_SYSTOLIC_MIN = 90;
    const BP_SYSTOLIC_MAX = 160;
    const BP_DIASTOLIC_MIN = 50;
    const BP_DIASTOLIC_MAX = 100;
    const HR_MIN = 50;
    const HR_MAX = 100;

    if (systolic < BP_SYSTOLIC_MIN || systolic > BP_SYSTOLIC_MAX) {
      wx.showToast({
        title: `收缩压应在 ${BP_SYSTOLIC_MIN}-${BP_SYSTOLIC_MAX} mmHg 之间`,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (diastolic < BP_DIASTOLIC_MIN || diastolic > BP_DIASTOLIC_MAX) {
      wx.showToast({
        title: `舒张压应在 ${BP_DIASTOLIC_MIN}-${BP_DIASTOLIC_MAX} mmHg 之间`,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (heartRate < HR_MIN || heartRate > HR_MAX) {
      wx.showToast({
        title: `心率应在 ${HR_MIN}-${HR_MAX} bpm 之间`,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 校验高压必须大于低压
    if (systolic <= diastolic) {
      wx.showToast({
        title: '收缩压必须大于舒张压',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const newRecordObj = {
      id: Date.now(),
      date: date, // 使用选择的日期
      time: time,
      systolic: systolic,
      diastolic: diastolic,
      heartRate: heartRate,
      timestamp: new Date(`${date} ${time}`).getTime() // 使用选择的日期和时间计算时间戳
    };

    console.log('新记录:', newRecordObj);

    const records = [...this.data.bpRecords, newRecordObj];
    records.sort((a, b) => b.timestamp - a.timestamp);

    wx.setStorageSync('bpRecords', records);
    this.setData({
      bpRecords: records,
      showAddDialog: false,
      newRecord: { // 重置newRecord
        systolic: '',
        diastolic: '',
        heartRate: '',
        time: '',
        date: ''
      }
    });
    this.updateChart();
  },

  // 重置数据
  resetData: function () {
    wx.showModal({
      title: '确认重置',
      content: '确定要清除所有血压记录吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.removeStorageSync('bpRecords');
            wx.removeStorageSync('bpInitialized');
            console.log('数据已清除');

            this.setData({
              bpRecords: []
            });

            this.updateChart();
            wx.showToast({
              title: '数据已重置',
              icon: 'success'
            });
          } catch (e) {
            console.error('重置数据失败:', e);
            wx.showToast({
              title: '重置失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 显示自定义提示框
  showCustomTooltip: function (dataIndex, seriesData) {
    // console.log('显示自定义提示框 - 数据索引:', dataIndex, '系列数据:', seriesData);

    const { currentView, allChartData, windowStartIndex } = this.data;
    
    // 根据是否使用滑动窗口选择数据源
    let chartData;
    let realDataIndex = dataIndex;
    
    if (currentView !== 'day' && allChartData) {
      // 对于周/月/年视图，使用全部数据并调整索引
      chartData = allChartData;
      realDataIndex = windowStartIndex + dataIndex;
      
      // 确保索引在有效范围内
      if (realDataIndex >= chartData.customBpSeriesData.length) {
        return;
      }
    } else {
      // 日视图直接使用当前数据
      chartData = this.getChartData();
    }

    if (!chartData.customBpSeriesData || realDataIndex >= chartData.customBpSeriesData.length) {
      // console.log('数据索引超出范围或数据不存在');
      return;
    }

    const dataPoint = chartData.customBpSeriesData[realDataIndex];
    if (!dataPoint || !dataPoint.value || dataPoint.value.length < 3) {
      // console.log('数据点格式错误:', dataPoint);
      return;
    }

    // dataPoint.value = [xCategory, diastolic, systolic]
    const xCategory = dataPoint.value[0];
    const diastolic = dataPoint.value[1];
    const systolic = dataPoint.value[2];
    const heartRate = chartData.heartRateData[realDataIndex]; // Get heart rate from the processed chart data
    
    // 如果血压数据全部为null，不显示提示框
    if (diastolic === null && systolic === null && heartRate === null) {
      console.log('数据为空，不显示提示框');
      return;
    }

    // 根据当前视图格式化时间标签
    let timeLabel = '';
    if (currentView === 'day') {
      timeLabel = `${xCategory}`;
    } else if (currentView === 'week' || currentView === 'month') {
      timeLabel = `${xCategory}`;
    } else if (currentView === 'year') {
      timeLabel = `${xCategory}`;
    }

    this.setData({
      showCustomTooltip: true,
      tooltipData: {
        timeLabel: timeLabel,
        systolic: systolic,
        diastolic: diastolic,
        heartRate: heartRate // Add heart rate to tooltip data
      }
    });

    // // console.log('提示框数据已设置:', this.data.tooltipData); // Commented out for debugging
  },

  // 隐藏自定义提示框
  hideCustomTooltip: function () {
    // // console.log('隐藏自定义提示框'); // Commented out for debugging
    this.setData({
      showCustomTooltip: false,
      tooltipData: {
        timeLabel: '',
        systolic: 0,
        diastolic: 0,
        heartRate: 0 // Reset heart rate
      }
    });
  },

  // 滑动窗口
  slideWindow: function (direction) {
    const { windowStartIndex, allChartData, currentView } = this.data;
    
    // 根据视图类型设置窗口大小
    let windowSize = 7;
    if (this.data.currentView === 'week') {
      windowSize = 7;  // 周视图显示7天
    } else if (this.data.currentView === 'month') {
      windowSize = 15; // 月视图显示15天
    } else if (this.data.currentView === 'year') {
      windowSize = 8;  // 年视图显示8个月
    }
    
    console.log('slideWindow调用，方向:', direction, '当前索引:', windowStartIndex);
    
    if (!allChartData || !allChartData.xData || allChartData.xData.length === 0) {
      console.log('没有可用的图表数据，尝试重新生成');
      
      // 如果没有数据，尝试重新生成连续数据
      const chartData = this.getContinuousChartData(currentView, this.data.currentDate, this.data.bpRecords);
      if (chartData && chartData.xData && chartData.xData.length > 0) {
        console.log('成功生成连续数据，长度:', chartData.xData.length);
        this.setData({
          allChartData: chartData
        }, () => {
          // 重新调用slideWindow
          this.slideWindow(direction);
        });
      } else {
        console.error('无法生成连续数据');
        wx.showToast({
          title: '暂无数据',
          icon: 'none',
          duration: 1500
        });
      }
      return;
    }
    
    console.log('数据详情:', {
      总长度: allChartData.xData.length,
      当前窗口: `${windowStartIndex} - ${windowStartIndex + windowSize}`,
      有效数据点数: allChartData.systolicData.filter(d => d !== null).length,
      前5个数据: allChartData.xData.slice(0, 5).join(', ')
    });
    
    const maxStartIndex = Math.max(0, allChartData.xData.length - windowSize);
    let newStartIndex = windowStartIndex;
    
    // 根据视图类型设置跳跃大小 - 滑动手势使用较小的步长
    let jumpSize = 1; // 默认值
    
    if (currentView === 'week') {
      jumpSize = windowSize; // 周视图：滑动一次移动7天，跟点击向左/向右一致
    } else if (currentView === 'month') {
      jumpSize = Math.round(windowSize / 2); // 月视图：窗口大小的一半 = 8天
    } else if (currentView === 'year') {
      jumpSize = windowSize; // 年视图：每次移动8个月，跟点击向左/向右一致
    }
    
    if (direction === 'left') {
      newStartIndex = Math.max(0, windowStartIndex - jumpSize);
    } else if (direction === 'right') {
      newStartIndex = Math.min(maxStartIndex, windowStartIndex + jumpSize);
    }
    
    console.log('滑动跳跃计算:', {
      方向: direction,
      当前索引: windowStartIndex,
      跳跃大小: jumpSize,
      新索引: newStartIndex,
      最大索引: maxStartIndex
    });
    
    console.log('计算后的新索引:', newStartIndex, '最大允许索引:', maxStartIndex);
    
    // 显示当前窗口的数据范围和内容
    if (allChartData.xData.length > 0) {
      const startLabel = allChartData.xData[newStartIndex];
      const endLabel = allChartData.xData[Math.min(newStartIndex + windowSize - 1, allChartData.xData.length - 1)];
      
      // 检查新窗口中是否有数据
      const windowData = allChartData.systolicData.slice(newStartIndex, newStartIndex + windowSize);
      const hasDataInWindow = windowData.some(d => d !== null);
      
      console.log('新窗口信息:', {
        数据范围: `${startLabel} 到 ${endLabel}`,
        包含数据: hasDataInWindow,
        窗口数据: windowData
      });
    }
    
    if (newStartIndex !== windowStartIndex) {
      // 强制刷新窗口索引
      this.data.windowStartIndex = -1;
      this.setData({
        windowStartIndex: newStartIndex
      }, () => {
        // 更新显示日期
        this.updateDisplayDateFromWindow();
        
        // 对于iOS设备，使用更激进的更新策略
        const systemInfo = wx.getSystemInfoSync();
        const isIOS = systemInfo.platform === 'ios';
        
        if (isIOS) {
          // iOS设备：立即更新并在延迟后再次更新
          this.updateChartWithWindow();
          setTimeout(() => {
            this.updateChartWithWindow();
          }, 200);
        } else {
          // 非iOS设备：使用wx.nextTick确保DOM更新
          wx.nextTick(() => {
            this.updateChartWithWindow();
          });
        }
      });
    } else {
      console.log('已到达边界，无法继续滑动');
      wx.showToast({
        title: direction === 'left' ? '已到最早记录' : '已到最新记录',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 根据窗口位置更新显示日期
  updateDisplayDateFromWindow: function () {
    const { currentView, allChartData, windowStartIndex } = this.data;
    
    if (!allChartData || allChartData.xData.length === 0) {
      return;
    }
    
    // 获取窗口中间位置的日期作为显示日期
    // 根据视图类型设置窗口大小
    let windowSize = 7;
    if (currentView === 'week') {
      windowSize = 7;  // 周视图显示7天
    } else if (currentView === 'month') {
      windowSize = 15; // 月视图显示15天
    } else if (currentView === 'year') {
      windowSize = 8; // 年视图显示8个月
    }
    const midIndex = Math.min(windowStartIndex + Math.floor(windowSize / 2), allChartData.xData.length - 1);
    const midLabel = allChartData.xData[midIndex];
    
    let displayDate = '';
    const currentDate = new Date(this.data.currentDate);
    
    if (currentView === 'week' || currentView === 'month') {
      // 从 MM-DD 格式解析日期
      if (midLabel && midLabel.includes('-')) {
        const [month, day] = midLabel.split('-').map(num => parseInt(num));
        
        // 计算年份（处理跨年的情况）
        let year = currentDate.getFullYear();
        
        // 如果是12月的数据但当前是1月，说明是去年的数据
        if (month === 12 && currentDate.getMonth() < 6) {
          year--;
        }
        // 如果是1月的数据但当前是12月，说明是明年的数据
        else if (month === 1 && currentDate.getMonth() > 6) {
          year++;
        }
        
        const midDate = new Date(year, month - 1, day);
        displayDate = formatDisplayDate(midDate);
      }
    } else if (currentView === 'year') {
      // 从 MM月 格式解析月份
      if (midLabel && midLabel.includes('月')) {
        const month = parseInt(midLabel.replace('月', ''));
        
        // 计算实际年份：年视图数据范围是24个月，从当前月往前
        const today = new Date();
        const dataStartDate = new Date(today);
        dataStartDate.setMonth(today.getMonth() - 23); // 24个月前
        dataStartDate.setDate(1);
        
        // 年视图按月组织数据，midIndex 对应第几个月
        // 从起始日期开始，向前推进 midIndex 个月
        const targetDate = new Date(dataStartDate);
        targetDate.setMonth(targetDate.getMonth() + midIndex);
        
        // 使用计算出的实际年份
        const actualYear = targetDate.getFullYear();
        displayDate = `${actualYear}年${month}月`;
      }
    }
    
    if (displayDate) {
      this.setData({ displayDate });
    }
  },

  // 使用窗口更新图表
  updateChartWithWindow: function () {
    if (!this.chart || !this.data.allChartData) {
      console.log('图表或数据未准备好');
      return;
    }
    
    console.log('更新窗口数据，当前窗口索引:', this.data.windowStartIndex);
    
    // 获取窗口数据（现在由getChartData()处理窗口逻辑）
    const windowData = this.getChartData();
    
    console.log('窗口数据准备完成，X轴数据:', windowData.xData);
    console.log('窗口数据详情:', {
      数据长度: windowData.xData.length,
      systolic: windowData.systolicData,
      diastolic: windowData.diastolicData,
      heartRate: windowData.heartRateData
    });
    
    // 验证数据是否正确
    if (!windowData.xData || windowData.xData.length === 0) {
      console.error('窗口数据为空，无法更新图表');
      return;
    }
    
    // 清除旧数据并设置新选项
    const option = this.getChartOption(windowData);
    
    // 添加时间戳确保图表识别为新数据
    option.timestamp = Date.now();
    
    // iOS设备特殊处理
    const systemInfo = wx.getSystemInfoSync();
    const isIOS = systemInfo.platform === 'ios';
    
    if (isIOS) {
      console.log('iOS设备检测到，使用完全重建策略');
      
      // iOS方案：完全销毁并重建图表
      try {
        // 1. 保存当前图表引用
        const oldChart = this.chart;
        
        // 2. 清空图表引用
        this.chart = null;
        
        // 3. 销毁旧图表
        if (oldChart) {
          oldChart.dispose();
        }
        
        // 4. 重新初始化图表组件
        const ecComponent = this.selectComponent('#mychart-dom-line');
        if (ecComponent && ecComponent.init) {
          console.log('重新初始化图表组件');
          
          // 5. 调用init重新创建图表
          ecComponent.init((canvas, ctx) => {
            const newChart = this.initChartComponent(canvas, ctx);
            if (newChart) {
              // 6. 设置新数据
              setTimeout(() => {
                newChart.setOption(option, true);
                console.log('iOS图表重建完成，数据已更新');
              }, 100);
            }
            return newChart;
          });
        } else {
          // 备用方案：使用隐藏/显示策略
          console.log('无法重新初始化，使用备用方案');
          this.setData({ forceRefresh: true }, () => {
            setTimeout(() => {
              this.setData({ forceRefresh: false }, () => {
                if (this.chart) {
                  this.chart.clear();
                  this.chart.setOption(option, true);
                  this.forceChartResize();
                }
              });
            }, 100);
          });
        }
      } catch (error) {
        console.error('iOS图表更新失败:', error);
        // 降级到标准更新
        if (this.chart) {
          this.chart.clear();
          this.chart.setOption(option, true, true); // 第三个参数true表示不合并
        }
      }
    } else {
      // 非iOS设备使用标准更新流程
      console.log('标准更新流程，清空并重设选项');
      
      // 完全清空旧选项
      this.chart.setOption({}, true, true);
      
      // 设置新选项
      setTimeout(() => {
        this.chart.setOption(option, true, true); // 不合并，完全替换
        
        // 强制刷新图表
        setTimeout(() => {
          if (this.chart) {
            this.chart.resize();
            this.triggerCanvasDraw();
          }
        }, 50);
      }, 50);
    }
  },

  // 更新图表
  updateChart: function () {
    console.log('开始更新图表，当前视图:', this.data.currentView);
    this.debugChartStatus();

    if (!this.chart) {
      console.log('图表未初始化，无法更新');
      // 尝试重新初始化图表
      setTimeout(() => {
        this.checkAndInitChart();
      }, 300);
      return;
    }

    // 对于周/月/年视图，先获取所有数据，然后使用窗口显示
    if (this.data.currentView !== 'day') {
      console.log('非日视图，准备使用滑动窗口');
      
      // 获取连续数据
      const continuousData = this.getContinuousChartData(this.data.currentView, this.data.currentDate, this.data.bpRecords);
      console.log('获取到的连续数据:', {
        数据长度: continuousData.xData.length,
        X轴数据: continuousData.xData.length > 10 ?
          `${continuousData.xData.slice(0, 5).join(', ')}...${continuousData.xData.slice(-5).join(', ')}` :
          continuousData.xData.join(', ')
      });
      
      // 确保有数据可以显示
      if (!continuousData.xData || continuousData.xData.length === 0) {
        console.error('连续数据生成失败，没有可显示的数据');
        wx.showToast({
          title: '暂无数据',
          icon: 'none',
          duration: 1500
        });
        return;
      }
      
      // 计算初始窗口位置
      let initialIndex = 0;
      // 根据视图类型设置窗口大小
      let windowSize = 7;
      if (this.data.currentView === 'week') {
        windowSize = 7;  // 周视图显示7天
      } else if (this.data.currentView === 'month') {
        windowSize = 15; // 月视图显示15天
      } else if (this.data.currentView === 'year') {
        windowSize = 8; // 年视图显示8个月
      }
      
      // 找到今天的位置 - 周视图和月视图应当以今天为终点，显示过去的数据
      const today = new Date();
      const currentView = this.data.currentView;
      
      if (currentView === 'week' || currentView === 'month') {
        // 始终以今天为终点，显示过去的数据
        const todayDateStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        console.log('查找今天日期:', todayDateStr);
        
        // 查找今天在数据中的位置（应该是数据数组的最后几个位置之一）
        const todayIndex = continuousData.xData.findIndex(x => x === todayDateStr);
        console.log('今天在数据中的索引:', todayIndex, '数据总长度:', continuousData.xData.length);
        
        if (todayIndex >= 0) {
          // 找到了今天，以今天为终点显示过去的数据
          if (currentView === 'week') {
            // 周视图：显示包括今天在内的过去7天，窗口从 todayIndex-6 开始到 todayIndex 结束
            initialIndex = Math.max(0, todayIndex - windowSize + 1);
            console.log('周视图 - 以今天为终点显示过去7天，今天索引:', todayIndex, '初始窗口索引:', initialIndex, '显示范围:', `${initialIndex} 到 ${todayIndex}`);
          } else if (currentView === 'month') {
            // 月视图：显示包括今天在内的过去15天，窗口从 todayIndex-14 开始到 todayIndex 结束
            initialIndex = Math.max(0, todayIndex - windowSize + 1);
            console.log('月视图 - 以今天为终点显示过去15天，今天索引:', todayIndex, '初始窗口索引:', initialIndex, '显示范围:', `${initialIndex} 到 ${todayIndex}`);
          }
        } else {
          // 如果找不到今天，使用数据的最后位置作为"今天"的替代
          console.log('未找到今天日期，使用数据最后位置作为终点');
          const lastIndex = continuousData.xData.length - 1;
          
          if (currentView === 'week') {
            // 周视图：以最后位置为终点，显示过去7天
            initialIndex = Math.max(0, lastIndex - windowSize + 1);
          } else if (currentView === 'month') {
            // 月视图：以最后位置为终点，显示过去15天
            initialIndex = Math.max(0, lastIndex - windowSize + 1);
          }
          console.log('数据最后位置索引:', lastIndex, '初始窗口索引:', initialIndex, '显示范围:', `${initialIndex} 到 ${lastIndex}`);
        }
      } else if (currentView === 'year') {
        // 年视图：以当前月为终点，显示过去8个月
        // 数据数组是从24个月前到当前月排序的，当前月是最后一个元素
        const lastIndex = continuousData.xData.length - 1;
        initialIndex = Math.max(0, lastIndex - windowSize + 1);
        console.log('年视图 - 以当前月为终点显示过去8个月，数据总长度:', continuousData.xData.length, '最后索引:', lastIndex, '初始窗口索引:', initialIndex, '显示范围:', `${initialIndex} 到 ${lastIndex}`);
      }
      
      console.log('最终初始窗口索引:', initialIndex, '数据总长度:', continuousData.xData.length);
      
      this.setData({
        allChartData: continuousData,
        windowStartIndex: initialIndex,
        isSwipeEnabled: true
      }, () => {
        // 确保数据设置完成后再更新窗口
        console.log('数据已存储，开始更新窗口显示');
        this.updateDisplayDateFromWindow();
        this.updateChartWithWindow();
      });
      return;
    }
    
    // 日视图直接显示所有数据，但保持滑动启用以支持日期切换
    this.setData({
      allChartData: null,
      windowStartIndex: 0,
      isSwipeEnabled: true
    });

    // 获取日视图的数据
    const chartData = this.getChartData();
    const option = this.getChartOption(chartData);
    // console.log('图表配置:', option);

    try {
      // 使用完全替换模式更新图表
      this.chart.setOption(option, true, true); // 第三个参数true表示不合并
      console.log('图表更新成功，使用完全替换模式');

      // 对于旧版Canvas，需要手动触发绘制
      setTimeout(() => {
        this.triggerCanvasDraw();

        // 双重保险：尝试重新设置一次图表选项并强制绘制
        setTimeout(() => {
          if (this.chart) {
            console.log('再次尝试刷新图表');
            this.chart.setOption(option, true, true); // 不合并

            // 尝试调用resize可能会触发重绘
            try {
              this.forceChartResize();
            } catch (e) {
              console.error('图表resize失败:', e);
            }
          }
        }, 200);
      }, 100);

    } catch (error) {
      console.error('图表更新失败:', error);
      // 如果更新失败，可能是图表对象有问题，尝试重新初始化
      this.chart = null;
      setTimeout(() => {
        this.checkAndInitChart();
      }, 300);
    }
  },

  // 触发Canvas绘制
  triggerCanvasDraw: function () {
    console.log('尝试触发Canvas绘制');
    try {
      // 通过选择器获取ec-canvas组件实例
      const query = this.createSelectorQuery();
      query.select('#mychart-dom-line')
        .fields({
          node: true,
          context: true
        })
        .exec((res) => {
          console.log('获取ec-canvas组件实例:', res);
          if (res && res[0]) {
            // 尝试多种方式获取并调用draw
            if (res[0].context && res[0].context.draw) {
              console.log('调用context.draw()');
              res[0].context.draw(true);
            } else if (res[0].node && res[0].node.getContext) {
              const ctx = res[0].node.getContext('2d');
              if (ctx && ctx.draw) {
                console.log('调用ctx.draw()');
                ctx.draw(true);
              }
            }

            // 尝试直接调用组件方法
            const ecComponent = this.selectComponent('#mychart-dom-line');
            if (ecComponent && ecComponent.chart) {
              console.log('尝试通过组件刷新图表');
              try {
                ecComponent.chart.resize();
              } catch (e) {
                console.error('图表resize失败:', e);
              }
            }
          }
        });
    } catch (error) {
      console.error('触发Canvas绘制失败:', error);
    }
  },

  // 获取图表数据
  getChartData: function () {
    const { currentView, currentDate, bpRecords, allChartData, windowStartIndex } = this.data;
    console.log('获取图表数据 - 当前视图:', currentView, '当前日期:', currentDate, '总记录数:', bpRecords.length);

    // 对于周/月/年视图，如果有窗口数据，返回窗口数据
    if (currentView !== 'day' && allChartData && typeof windowStartIndex === 'number') {
      console.log('使用窗口数据 - 当前窗口索引:', windowStartIndex);
      
      // 根据视图类型设置窗口大小
      let windowSize = 7;
      if (currentView === 'week') {
        windowSize = 7;  // 周视图显示7天
      } else if (currentView === 'month') {
        windowSize = 15; // 月视图显示15天
      } else if (currentView === 'year') {
        windowSize = 8; // 年视图显示8个月
      }
      
      const endIndex = Math.min(windowStartIndex + windowSize, allChartData.xData.length);
      
      // 创建窗口数据
      const windowData = {
        xData: allChartData.xData.slice(windowStartIndex, endIndex),
        systolicData: allChartData.systolicData.slice(windowStartIndex, endIndex),
        diastolicData: allChartData.diastolicData.slice(windowStartIndex, endIndex),
        heartRateData: allChartData.heartRateData.slice(windowStartIndex, endIndex),
        customBpSeriesData: allChartData.customBpSeriesData.slice(windowStartIndex, endIndex)
      };
      
      // 如果数据不足窗口大小，补充空位
      while (windowData.xData.length < windowSize) {
        windowData.xData.push('');
        windowData.systolicData.push(null);
        windowData.diastolicData.push(null);
        windowData.heartRateData.push(null);
        windowData.customBpSeriesData.push({
          value: ['', null, null],
          itemStyle: { color: 'transparent' }
        });
      }
      
      console.log('返回窗口数据:', {
        视图: currentView,
        窗口大小: windowSize,
        数据长度: windowData.xData.length,
        X轴数据: windowData.xData.join(', ')
      });
      
      return windowData;
    }
    
    // 对于周/月/年视图，如果没有窗口数据，获取连续的日期范围数据
    if (currentView !== 'day') {
      const continuousData = this.getContinuousChartData(currentView, currentDate, bpRecords);
      console.log('生成的连续数据:', {
        视图: currentView,
        数据长度: continuousData.xData.length,
        有效数据点: continuousData.systolicData.filter(v => v !== null).length,
        数据范围: continuousData.xData.length > 0 ?
          `${continuousData.xData[0]} 到 ${continuousData.xData[continuousData.xData.length - 1]}` :
          '无数据'
      });
      return continuousData;
    }

    // 日视图保持原有逻辑
    let filteredRecords = bpRecords.filter(record => record.date === currentDate);
    console.log('日视图过滤结果:', filteredRecords.length, '条记录');
    return this.processChartData(filteredRecords, currentView);
  },

  // 获取连续的图表数据（支持滑动）
  getContinuousChartData: function(view, centerDate, allRecords) {
    console.log('获取连续数据，视图:', view, '中心日期:', centerDate, '总记录数:', allRecords.length);
    
    // 确定数据范围
    let startDate, endDate;
    const center = new Date(centerDate);
    const today = new Date();
    
    // 确保今天是数据的终点
    today.setHours(23, 59, 59, 999); // 设置为今天的最后一刻
    
    if (view === 'week') {
      // 周视图：180天的数据范围（今天往前180天到今天）
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 179); // 包含今天，所以是179天前
    } else if (view === 'month') {
      // 月视图：365天的数据范围（今天往前365天到今天）
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 364); // 包含今天，所以是364天前
    } else if (view === 'year') {
      // 年视图：24个月的数据范围（当前月往前24个月到当前月）
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 23); // 包含当前月，所以是23个月前
      startDate.setDate(1); // 设置为每月第一天
    }
    
    console.log('数据范围:', formatDate(startDate), '到', formatDate(endDate));
    console.log('时间跨度天数:', Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
    
    // 创建日期到数据的映射
    const dataMap = {};
    let recordsInRange = 0;
    allRecords.forEach(record => {
      const date = new Date(record.date);
      if (date >= startDate && date <= endDate) {
        recordsInRange++;
        let key;
        if (view === 'week' || view === 'month') {
          key = record.date; // YYYY-MM-DD
        } else { // year
          key = record.date.substring(0, 7); // YYYY-MM
        }
        
        if (!dataMap[key]) {
          dataMap[key] = [];
        }
        dataMap[key].push(record);
      }
    });
    
    console.log('数据映射完成:', {
      范围内记录数: recordsInRange,
      有数据的日期数: Object.keys(dataMap).length,
      数据分布: Object.keys(dataMap).slice(0, 5).join(', ') + (Object.keys(dataMap).length > 5 ? '...' : '')
    });
    
    // 生成连续的日期序列
    const continuousData = [];
    let dataPointsWithData = 0;
    let debugSampleData = [];
    
    if (view === 'week' || view === 'month') {
      // 日视图逻辑：按天生成数据
      const current = new Date(startDate);
      while (current <= endDate) {
        const key = formatDate(current);
        const displayKey = `${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        
        // 添加数据点（如果有数据）或空数据点
        if (dataMap[key]) {
          // 有数据，计算平均值
          const dayRecords = dataMap[key];
          const avgSys = Math.round(dayRecords.reduce((sum, r) => sum + r.systolic, 0) / dayRecords.length);
          const avgDia = Math.round(dayRecords.reduce((sum, r) => sum + r.diastolic, 0) / dayRecords.length);
          const avgHr = Math.round(dayRecords.reduce((sum, r) => sum + r.heartRate, 0) / dayRecords.length);
          
          continuousData.push({
            date: key,
            displayKey: displayKey,
            systolic: avgSys,
            diastolic: avgDia,
            heartRate: avgHr,
            hasData: true
          });
          dataPointsWithData++;
          
          // 收集前几个有数据的样本
          if (debugSampleData.length < 3) {
            debugSampleData.push({
              date: key,
              display: displayKey,
              sys: avgSys,
              count: dayRecords.length
            });
          }
        } else {
          // 无数据，添加空数据点
          continuousData.push({
            date: key,
            displayKey: displayKey,
            systolic: null,
            diastolic: null,
            heartRate: null,
            hasData: false
          });
        }
        
        // 移动到下一天
        current.setDate(current.getDate() + 1);
      }
    } else { // year view
      // 年视图逻辑：按月生成数据，从当前月往前24个月
      const current = new Date(today);
      current.setDate(1); // 设置为每月第一天
      
      // 生成24个月的数据，从当前月往前
      for (let i = 0; i < 24; i++) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        const displayKey = `${current.getMonth() + 1}月`;
        
        // 计算该月的数据
        const monthRecords = [];
        Object.keys(dataMap).forEach(dateKey => {
          if (dateKey.startsWith(key)) {
            monthRecords.push(...dataMap[dateKey]);
          }
        });
        
        if (monthRecords.length > 0) {
          const avgSys = Math.round(monthRecords.reduce((sum, r) => sum + r.systolic, 0) / monthRecords.length);
          const avgDia = Math.round(monthRecords.reduce((sum, r) => sum + r.diastolic, 0) / monthRecords.length);
          const avgHr = Math.round(monthRecords.reduce((sum, r) => sum + r.heartRate, 0) / monthRecords.length);
          
          continuousData.push({
            date: key,
            displayKey: displayKey,
            systolic: avgSys,
            diastolic: avgDia,
            heartRate: avgHr,
            hasData: true
          });
          dataPointsWithData++;
          
          // 收集前几个有数据的样本
          if (debugSampleData.length < 3) {
            debugSampleData.push({
              date: key,
              display: displayKey,
              sys: avgSys,
              count: monthRecords.length
            });
          }
        } else {
          continuousData.push({
            date: key,
            displayKey: displayKey,
            systolic: null,
            diastolic: null,
            heartRate: null,
            hasData: false
          });
        }
        
        // 移动到上个月
        current.setMonth(current.getMonth() - 1);
      }
      
      // 年视图数据需要反转，因为我们是从当前月往前生成的
      continuousData.reverse();
    }
    
    console.log('连续数据生成完成:', {
      总数据点: continuousData.length,
      有效数据点: dataPointsWithData,
      数据覆盖率: (dataPointsWithData / continuousData.length * 100).toFixed(1) + '%',
      样本数据: debugSampleData
    });
    
    // 转换为图表格式
    const result = {
      xData: [],
      systolicData: [],
      diastolicData: [],
      heartRateData: [],
      customBpSeriesData: []
    };
    
    continuousData.forEach(point => {
      result.xData.push(point.displayKey);
      result.systolicData.push(point.systolic);
      result.diastolicData.push(point.diastolic);
      result.heartRateData.push(point.heartRate);
      
      if (point.hasData && point.systolic !== null) {
        result.customBpSeriesData.push({
          value: [point.displayKey, point.diastolic, point.systolic],
          itemStyle: { color: calculateColor(point.systolic, point.diastolic) }
        });
      } else {
        // 无数据时添加透明占位
        result.customBpSeriesData.push({
          value: [point.displayKey, null, null],
          itemStyle: { color: 'transparent' }
        });
      }
    });
    
    console.log('最终图表数据格式:', {
      xData长度: result.xData.length,
      前5个X轴标签: result.xData.slice(0, 5).join(', '),
      后5个X轴标签: result.xData.slice(-5).join(', '),
      有效血压数据点: result.customBpSeriesData.filter(d => d.value[1] !== null).length
    });
    
    return result;
  },

  // 处理图表数据
  processChartData: function (records, view) {
    // console.log('处理图表数据 - 记录数:', records.length, '视图:', view);

    if (records.length === 0) {
      // console.log('没有记录，返回空数据');
      return { xData: [], systolicData: [], diastolicData: [], heartRateData: [], customBpSeriesData: [] };
    }

    let xData = [];
    let systolicData = []; // Still useful for min/max calculations or if lines are overlaid
    let diastolicData = []; // Still useful for min/max calculations
    let heartRateData = [];
    let customBpSeriesData = [];

    if (view === 'day') {
      records.sort((a, b) => a.timestamp - b.timestamp);
      let recordsToDisplay = records;
      if (records.length > 20) { // Simple sampling for many data points in day view
        const samplingInterval = Math.ceil(records.length / 20);
        recordsToDisplay = records.filter((_, i) => i % samplingInterval === 0);
        // Ensure the last point is included if not already
        if (records.length > 0 && recordsToDisplay.length > 0 && recordsToDisplay[recordsToDisplay.length - 1].timestamp !== records[records.length - 1].timestamp) {
          recordsToDisplay.push(records[records.length - 1]);
        }
      }

      recordsToDisplay.forEach(record => {
        xData.push(record.time);
        const sys = record.systolic;
        const dia = record.diastolic;
        systolicData.push(sys); // Keep for potential y-axis scaling or other uses
        diastolicData.push(dia); // Keep for potential y-axis scaling
        heartRateData.push(record.heartRate);
        customBpSeriesData.push({
          value: [record.time, dia, sys], // [xCategory, diastolicValue, systolicValue]
          itemStyle: { color: calculateColor(sys, dia) }
        });
      });
      // console.log('日视图数据处理完成 - X轴:', xData.length, '自定义血压数据:', customBpSeriesData.length);
    } else { // week, month, year views - aggregate data
      const groupedData = {};
      records.forEach(record => {
        let key;
        if (view === 'week' || view === 'month') {
          // Group by full date for week/month views to get daily averages
          key = record.date;
        } else { // year view
          // Group by month for year view
          key = record.date.substring(0, 7); // YYYY-MM
        }
        if (!groupedData[key]) {
          groupedData[key] = { systolic: [], diastolic: [], heartRate: [], count: 0 };
        }
        groupedData[key].systolic.push(record.systolic);
        groupedData[key].diastolic.push(record.diastolic);
        groupedData[key].heartRate.push(record.heartRate);
        groupedData[key].count++;
      });

      Object.keys(groupedData).sort().forEach(key => {
        const data = groupedData[key];
        let displayKey = key;
        if (view === 'week' || view === 'month') {
          const date = new Date(key);
          displayKey = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; // MM-DD
        } else { // year view
          displayKey = key.substring(5, 7) + '月'; // MM月
        }
        xData.push(displayKey);
        const avgSys = Math.round(data.systolic.reduce((a, b) => a + b, 0) / data.count);
        const avgDia = Math.round(data.diastolic.reduce((a, b) => a + b, 0) / data.count);
        const avgHr = Math.round(data.heartRate.reduce((a, b) => a + b, 0) / data.count);

        systolicData.push(avgSys);
        diastolicData.push(avgDia);
        heartRateData.push(avgHr);
        customBpSeriesData.push({
          value: [displayKey, avgDia, avgSys],
          itemStyle: { color: calculateColor(avgSys, avgDia) }
        });
      });
      // console.log('非日视图数据处理完成 - X轴:', xData.length, '自定义血压数据:', customBpSeriesData.length);
    }
    const result = { xData, systolicData, diastolicData, heartRateData, customBpSeriesData };
    // console.log('最终处理结果:', result);
    return result;
  },

  // 获取图表配置
  getChartOption: function (data) {
    const { currentView } = this.data;
    const viewNames = {
      day: '日视图',
      week: '周视图',
      month: '月视图',
      year: '年视图'
    };

    // 获取设备信息进行适配
    let systemInfo;
    try {
      const deviceInfo = wx.getDeviceInfo();
      const windowInfo = wx.getWindowInfo();
      systemInfo = { ...deviceInfo, ...windowInfo };
    } catch (e) {
      console.warn('获取新版系统信息失败，使用旧版API:', e);
      systemInfo = wx.getSystemInfoSync();
    }

    const isWindows = systemInfo.platform === 'windows' || (systemInfo.system && systemInfo.system.toLowerCase().includes('windows'));
    const isIOS = systemInfo.platform === 'ios';

    // 根据设备类型调整字体大小和其他参数 - 缩小字体以让图表占用更多空间
    const fontSizes = {
      title: isWindows ? 8 : 7,
      legend: isWindows ? 6 : 5,  // 缩小图例字体
      axis: isWindows ? 5 : 4,    // 缩小坐标轴字体
      tooltip: isWindows ? 5 : 4
    };

    const lineWidths = {
      normal: isWindows ? 1 : 0.5
    };

    const symbolSizes = {
      normal: isWindows ? 3 : 2  // 增大手机设备上的数据点大小
    };

    // 使用合适的缩放比例
    const scaleFactor = isWindows ? 0.5 : 0.33;

    // 检查是否有有效数据（周视图/月视图特殊处理）
    const hasValidData = data.customBpSeriesData && data.customBpSeriesData.some(item =>
      item.value && item.value[1] !== null && item.value[2] !== null
    );
    
    // 如果没有数据，显示空状态
    if (!data.xData || data.xData.length === 0) {
      return {
        title: {
          text: `${viewNames[currentView]}`,
          left: 'center',
          textStyle: {
            color: '#333',
            fontSize: fontSizes.title
          },
          top: '1%',
          padding: [2, 0, 2, 0]
        },
        xAxis: {
          show: false
        },
        yAxis: {
          show: false
        }
      };
    }
    
    // 所有视图：当没有有效数据时，隐藏图例和X轴
    const shouldHideLegendAndXAxis = !hasValidData;

    return {
      title: {
        text: `${viewNames[currentView]}`,
        left: 'center',
        textStyle: {
          color: '#333',
          fontSize: fontSizes.title
        },
        top: '1%',
        padding: [2, 0, 2, 0]
      },
      graphic: {
        elements: [
          {
            type: 'group',
            left: 'center',
            top: 'center',
            children: []
          }
        ]
      },
      tooltip: {
        show: false // 禁用默认tooltip，使用自定义tooltip
      },
      legend: shouldHideLegendAndXAxis ? {
        show: false
      } : {
        data: ['血压范围', '心率'], // Updated legend
        left: 'center',
        top: isWindows ? '6%' : '6%',  // 减少顶部间距
        itemWidth: isWindows ? 8 : 5,  // 缩小图例图标
        itemHeight: isWindows ? 5 : 4,  // 缩小图例图标
        textStyle: {
          fontSize: fontSizes.legend,
          color: '#666'
        },
        padding: [2, 0, 0, 0],  // 减少内边距
        orient: 'horizontal',
        itemGap: isWindows ? 6 : 1,  // 减少图例间距
        selectedMode: false // 禁用点击切换
      },
      grid: isWindows ? {
        left: '0%',   // 减少左边距
        right: '0%',  // 减少右边距
        bottom: '3%', // 减少底部边距
        top: '13%',   // 减少顶部边距
        containLabel: true
      } : {
        left: '0%',   // 减少左边距
        right: '0%',  // 减少右边距
        bottom: '3%', // 减少底部边距
        top: '13%',   // 减少顶部边距
        containLabel: true
      },
      xAxis: shouldHideLegendAndXAxis ? {
        show: false
      } : {
        type: 'category',
        data: data.xData,
        axisLabel: {
          rotate: currentView === 'day' ? 0 : 45,
          fontSize: fontSizes.axis,
          interval: 'auto',
          hideOverlap: false,
          margin: 1,  // 减少边距
          showMinLabel: true,
          showMaxLabel: true
        }
      },
      yAxis: shouldHideLegendAndXAxis ? [
        { show: false },
        { show: false }
      ] : [
        {
          type: 'value',
          name: '',
          nameGap: 1,
          position: 'left',
          axisLabel: {
            formatter: '{value}',
            fontSize: fontSizes.axis,
            margin: 1,  // 减少边距
            showMinLabel: false,
            showMaxLabel: false,
            interval: 'auto'
          },
          nameTextStyle: {
            fontSize: fontSizes.axis,
            padding: [0, 0, 0, 0]
          },
          splitLine: {
            show: false // 隐藏血压Y轴横线
          },
          splitNumber: 12,
          scale: true,
          boundaryGap: ['5%', '5%'],
          min: function (value) {
            // 合理的显示范围，确保数据线条清晰可见
            const dataRange = value.max - value.min;
            const padding = Math.max(dataRange * 0.1, 5); // 10%的数据范围作为边距，最小5个单位
            return Math.max(0, value.min - padding);
          },
          max: 180 // 固定Y轴血压上限
        },
        {
          type: 'value',
          name: '',
          nameGap: 2,
          position: 'right',
          axisLabel: {
            formatter: '{value}',
            fontSize: fontSizes.axis,
            margin: 3,  // 减少边距
            showMinLabel: false,
            showMaxLabel: false,
            interval: 'auto'
          },
          nameTextStyle: {
            fontSize: fontSizes.axis,
            padding: [0, 0, 0, 0]
          },
          splitLine: {
            show: false // 隐藏心率Y轴横线
          },
          splitNumber: 12,
          scale: true,
          boundaryGap: ['5%', '5%'],
          min: function (value) {
            // 合理的显示范围，确保数据线条清晰可见
            const dataRange = value.max - value.min;
            const padding = Math.max(dataRange * 0.1, 3); // 10%的数据范围作为边距，最小3个单位
            return Math.max(0, value.min - padding);
          },
          max: 140 // 固定Y轴心率上限
        }
      ],
      series: [
        {
          name: '血压范围',
          type: 'custom',
          renderItem: function (params, api) {
            var categoryValue = api.value(0); // x轴分类值，如 '08:30'
            var diastolic = api.value(1);    // 舒张压
            var systolic = api.value(2);     // 收缩压

            // 获取分类值在x轴上的坐标点
            var pointDiastolic = api.coord([categoryValue, diastolic]);
            var pointSystolic = api.coord([categoryValue, systolic]);

            // x轴坐标 (条形图中心点)
            var barCenterX = pointDiastolic[0];

            // 计算条形图宽度 (占分类宽度的60%)
            var bandWidth = api.size([1, 0])[0]; // 单个分类的宽度
            var barWidth = bandWidth * 0.6;
            if (data.xData.length === 1) { // Special case for single data point
              barWidth = Math.min(bandWidth * 0.6, 30); // Max 30px wide for single point
            }


            return {
              type: 'rect',
              shape: {
                x: barCenterX - barWidth / 2,
                y: pointSystolic[1], // 矩形顶部的y坐标 (收缩压)
                width: barWidth,
                height: pointDiastolic[1] - pointSystolic[1] // 矩形高度 (舒张压y - 收缩压y)
              },
              style: api.style(), // 应用数据项中定义的itemStyle (包含颜色)
              emphasis: {
                style: {
                  stroke: 'rgba(0,0,0,0.5)',
                  lineWidth: 1
                }
              }
            };
          },
          data: data.customBpSeriesData,
          yAxisIndex: 0, // 使用第一个y轴 (血压轴)
          z: 2 // 控制层叠顺序
        },
        {
          name: '心率',
          type: 'line',
          yAxisIndex: 1,
          data: data.heartRateData,
          smooth: true,
          lineStyle: {
            color: '#0000ff',
            width: lineWidths.normal
          },
          itemStyle: {
            color: '#0000ff'
          },
          symbol: 'circle',
          symbolSize: symbolSizes.normal,
          showSymbol: true
        }
      ]
    };
  }
});
