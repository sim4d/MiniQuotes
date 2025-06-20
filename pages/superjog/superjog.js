Page({
    data: {
        // 用户统计数据
        continuousDays: 0,
        totalMinutes: 0,
        lastWorkout: '无',

        // 指导区域显示状态
        showGuide: false,

        // 时长选项 - 支持左右滑动
        durationOptions: [
            { value: 10, label: '10分钟', desc: '日常锻炼' },
            { value: 15, label: '15分钟', desc: '进阶训练' },
            { value: 20, label: '20分钟', desc: '深度锻炼' },
            { value: 30, label: '30分钟', desc: '专业训练' },
            { value: 45, label: '45分钟', desc: '超级挑战' }
        ],

        // 选中的锻炼时长
        selectedDuration: 15 // 默认选择15分钟，更适合大多数用户
    },

    onLoad: function (options) {
        this.loadUserStats();
    },

    onShow: function () {
        // 每次显示页面时更新数据
        this.loadUserStats();
    },

    // 加载用户统计数据
    loadUserStats: function () {
        try {
            const workoutData = wx.getStorageSync('superjog_data') || {
                continuousDays: 0,
                totalMinutes: 0,
                lastWorkoutDate: null,
                workoutHistory: []
            };

            // 计算连续天数
            const today = new Date();
            const lastDate = workoutData.lastWorkoutDate ? new Date(workoutData.lastWorkoutDate) : null;
            let continuousDays = workoutData.continuousDays || 0;

            if (lastDate) {
                const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
                if (daysDiff > 1) {
                    continuousDays = 0; // 超过一天未锻炼，重置连续天数
                }
            }

            // 格式化上次锻炼时间
            let lastWorkout = '无';
            if (lastDate) {
                const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
                if (daysDiff === 0) {
                    lastWorkout = '今天';
                } else if (daysDiff === 1) {
                    lastWorkout = '昨天';
                } else {
                    lastWorkout = `${daysDiff}天前`;
                }
            }

            this.setData({
                continuousDays: continuousDays,
                totalMinutes: workoutData.totalMinutes || 0,
                lastWorkout: lastWorkout
            });
        } catch (error) {
            console.error('加载用户数据失败:', error);
        }
    },

    // 切换指导区域显示
    toggleGuide: function () {
        this.setData({
            showGuide: !this.data.showGuide
        });
    },

    // 选择锻炼时长
    selectDuration: function (e) {
        const duration = e.currentTarget.dataset.duration;

        this.setData({
            selectedDuration: duration
        });

        // 轻微震动反馈
        wx.vibrateShort({
            type: 'light'
        });
    },

    // 开始锻炼
    startWorkout: function () {
        if (!this.data.selectedDuration) {
            wx.showToast({
                title: '请选择锻炼时长',
                icon: 'none'
            });
            return;
        }

        // 震动反馈
        wx.vibrateShort({
            type: 'medium'
        });

        // 导航到锻炼页面
        wx.navigateTo({
            url: `../superjog-workout/superjog-workout?duration=${this.data.selectedDuration}`
        });
    },

    // 分享功能
    onShareAppMessage: function () {
        return {
            title: '一起来超慢跑，享受健康生活！',
            path: '/pages/superjog/superjog',
            imageUrl: '/images/superjog-share.jpg' // 需要添加分享图片
        };
    }
}); 